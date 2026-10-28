package io.zdrx.client.net;

import java.nio.ByteBuffer;

public final class Pkt {

    public static final int IP  = 20;
    public static final int UDP = 8;

    public static boolean isV4(byte[] b)  { return b.length > 20 && (b[0] >> 4) == 4; }
    public static boolean isUdp(byte[] b) { return b.length > 24 && (b[9] & 0xff) == 17; }
    public static int  ihl(byte[] b)      { return (b[0] & 0x0f) * 4; }
    public static int  u16(byte[] b, int o){ return ((b[o] & 0xff) << 8) | (b[o + 1] & 0xff); }

    public static byte[] ipAt(byte[] b, int o) {
        return new byte[]{ b[o], b[o + 1], b[o + 2], b[o + 3] };
    }

    public static byte[] frame(byte[] srcIp, byte[] dstIp,
                               int sport, int dport, byte[] payload) {
        int total = IP + UDP + payload.length;
        ByteBuffer b = ByteBuffer.allocate(total);
        b.put((byte) 0x45).put((byte) 0);
        b.putShort((short) total);
        b.putShort((short) 0);
        b.putShort((short) 0x4000);
        b.put((byte) 64).put((byte) 17);
        b.putShort((short) 0);
        b.put(srcIp).put(dstIp);

        byte[] out = b.array();
        int sum = 0;
        for (int i = 0; i < IP; i += 2) sum += ((out[i] & 0xff) << 8) | (out[i + 1] & 0xff);
        while ((sum >> 16) != 0) sum = (sum & 0xffff) + (sum >> 16);
        out[10] = (byte) (~sum >> 8);
        out[11] = (byte) (~sum);

        ByteBuffer u = ByteBuffer.wrap(out, IP, UDP + payload.length);
        u.putShort((short) sport)
         .putShort((short) dport)
         .putShort((short) (UDP + payload.length))
         .putShort((short) 0)
         .put(payload);
        return out;
    }

    private Pkt() {}
}
