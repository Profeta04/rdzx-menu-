package io.zdrx.client.net;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.util.HashMap;
import java.util.Map;

import io.zdrx.client.Zdrx;

/** tun0 + tabela de conexoes (um socket protegido por endpoint remoto). */
public class ZdrxVpn extends VpnService implements Runnable {

    private static final String TAG = "ZDRX/VPN";
    private static final int MTU = 1500;

    private static final class Ep {
        InetAddress remote;
        int rport;
        byte[] lip, rip;
        int lport;
        DatagramSocket sock;
    }

    private ParcelFileDescriptor tun;
    private FileInputStream in;
    private FileOutputStream out;

    private Thread worker;
    private volatile boolean running;

    private final Map<String, Ep> eps = new HashMap<>();
    private volatile Ep last;

    @Override public int onStartCommand(Intent i, int f, int s) {
        if (worker == null) {
            if (!establish()) return START_STICKY;
            running = true;
            worker = new Thread(this, "zdrx-vpn");
            worker.start();
            notifyForeground();
        }
        return START_STICKY;
    }

    private boolean establish() {
        try {
            Builder b = new Builder();
            b.setSession(Zdrx.NAME);
            b.setMtu(MTU);
            b.addAddress("10.7.0.2", 24);
            b.addDnsServer("1.1.1.1");
            b.addRoute("0.0.0.0", 0);

            try {
                getPackageManager().getPackageInfo(Zdrx.GAME, 0);
                b.addAllowedApplication(Zdrx.GAME);
            } catch (PackageManager.NameNotFoundException e) {
                Log.w(TAG, "jogo ausente - VPN global");
            }

            tun = b.establish();
            if (tun == null) return false;

            in  = new FileInputStream(tun.getFileDescriptor());
            out = new FileOutputStream(tun.getFileDescriptor());
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "establish", t);
            return false;
        }
    }

    @Override public void run() {
        byte[] buf = new byte[MTU + 64];

        while (running) {
            try {
                int n = in.read(buf);
                if (n < 28 || !Pkt.isV4(buf) || !Pkt.isUdp(buf)) continue;

                int ihl = Pkt.ihl(buf);
                if (n < ihl + 8) continue;

                int sport = Pkt.u16(buf, ihl);
                int dport = Pkt.u16(buf, ihl + 2);
                int plen  = Pkt.u16(buf, ihl + 4) - 8;
                if (plen <= 0 || ihl + 8 + plen > n) continue;

                byte[] sip = Pkt.ipAt(buf, 12);
                byte[] dip = Pkt.ipAt(buf, 16);

                byte[] pay = new byte[plen];
                System.arraycopy(buf, ihl + 8, pay, 0, plen);

                String key = key(dip, dport);
                Ep ep = eps.get(key);
                if (ep == null) {
                    ep = open(sip, sport, dip, dport);
                    if (ep == null) continue;
                    eps.put(key, ep);
                }

                byte[] mod = Zdrx.onC2S(pay);
                if (mod != null) pay = mod;

                ep.sock.send(new DatagramPacket(pay, pay.length, ep.remote, ep.rport));
                last = ep;

                poll(ep);
                drain();
            } catch (Throwable t) {
                Log.w(TAG, "run: " + t);
            }
        }
    }

    private void poll(Ep ep) {
        byte[] r = new byte[MTU + 64];
        long end = System.currentTimeMillis() + 60;

        while (System.currentTimeMillis() < end) {
            try {
                DatagramPacket p = new DatagramPacket(r, r.length);
                ep.sock.receive(p);

                byte[] d = new byte[p.getLength()];
                System.arraycopy(p.getData(), 0, d, 0, p.getLength());

                byte[] mod = Zdrx.onS2C(d);
                if (mod != null) d = mod;

                out.write(Pkt.frame(p.getAddress().getAddress(), ep.lip,
                                    p.getPort(), ep.lport, d));
            } catch (Throwable t) {
                break;
            }
        }
    }

    private void drain() {
        try {
            byte[][] q = Zdrx.drainOut();
            Ep ep = last;
            if (q == null || ep == null) return;
            for (byte[] p : q) {
                if (p == null || p.length == 0) continue;
                ep.sock.send(new DatagramPacket(p, p.length, ep.remote, ep.rport));
            }
        } catch (Throwable ignored) {}
    }

    private Ep open(byte[] sip, int sport, byte[] dip, int dport) {
        try {
            Ep e = new Ep();
            e.lip = sip;   e.lport = sport;
            e.rip = dip;   e.rport = dport;
            e.remote = InetAddress.getByAddress(dip);
            e.sock = new DatagramSocket();
            protect(e.sock);
            e.sock.setSoTimeout(15);
            return e;
        } catch (Throwable t) {
            return null;
        }
    }

    private static String key(byte[] ip, int port) {
        return (ip[0] & 0xff) + "." + (ip[1] & 0xff) + "."
             + (ip[2] & 0xff) + "." + (ip[3] & 0xff) + ":" + port;
    }

    private void notifyForeground() {
        if (Build.VERSION.SDK_INT < 26) return;
        String ch = "zdrx";
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(
                new NotificationChannel(ch, Zdrx.NAME, NotificationManager.IMPORTANCE_LOW));
        Notification n = new Notification.Builder(this, ch)
                .setContentTitle(Zdrx.NAME)
                .setContentText("interceptando trafego do jogo")
                .setSmallIcon(android.R.drawable.ic_menu_compass)
                .build();
        startForeground(7, n);
    }

    @Override public void onRevoke() { shutdown(); }

    @Override public void onDestroy() { shutdown(); super.onDestroy(); }

    private void shutdown() {
        running = false;
        try { if (tun != null) tun.close(); } catch (Throwable ignored) {}
        for (Ep e : eps.values()) {
            try { e.sock.close(); } catch (Throwable ignored) {}
        }
        eps.clear();
        worker = null;
    }
}
