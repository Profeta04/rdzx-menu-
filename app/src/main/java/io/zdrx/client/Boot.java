package io.zdrx.client;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.VpnService;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.util.TypedValue;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

import io.zdrx.client.net.ZdrxVpn;
import io.zdrx.client.overlay.ZdrxOverlay;

public class Boot extends Activity {

    private static final int REQ_PERM = 1001;
    private static final int REQ_VPN  = 1002;

    private TextView out;
    private TextView licStatus;
    private Button startBtn;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(ui());
        ask();

        Lic.fetchLatestNotificationAsync(this, (id, title, msg, ca) -> {
            if (id != null && !id.isEmpty() && !id.equals(Prefs.getLastNotifId())) {
                Prefs.putLastNotifId(id);
                new android.app.AlertDialog.Builder(Boot.this)
                        .setTitle("📢 " + title)
                        .setMessage(msg)
                        .setPositiveButton("OK", null)
                        .show();
            }
        });
    }

    private View ui() {
        ScrollView sc = new ScrollView(this);
        LinearLayout r = new LinearLayout(this);
        r.setOrientation(LinearLayout.VERTICAL);
        r.setPadding(dp(18), dp(18), dp(18), dp(18));
        r.setBackgroundColor(Color.parseColor("#0b1220"));
        sc.addView(r);

        TextView t = new TextView(this);
        t.setText(Zdrx.NAME + "  " + Zdrx.VER);
        t.setTextColor(Color.parseColor("#22d3ee"));
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        r.addView(t);

        TextView hw = new TextView(this);
        hw.setText("HWID: " + Lic.hwid(this).substring(0, 16));
        hw.setTextColor(Color.parseColor("#8b9ab5"));
        hw.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        r.addView(hw);

        licStatus = new TextView(this);
        licStatus.setPadding(0, dp(8), 0, dp(4));
        licStatus.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        if (Prefs.isLicenseActive()) {
            licStatus.setText("Licença ativa: " + Lic.formatRemaining(Prefs.getExpiry()));
            licStatus.setTextColor(Color.parseColor("#4ade80"));
        } else {
            licStatus.setText("Nenhuma licença ativa. Insira sua chave.");
            licStatus.setTextColor(Color.parseColor("#fbbf24"));
        }
        r.addView(licStatus);

        final EditText keyInput = new EditText(this);
        keyInput.setHint("Cole sua key (ex: ZDRX-D-...)");
        keyInput.setTextColor(Color.WHITE);
        keyInput.setHintTextColor(Color.parseColor("#5b6b86"));
        keyInput.setInputType(InputType.TYPE_CLASS_TEXT);
        String savedKey = Prefs.getKey();
        if (savedKey != null && !savedKey.isEmpty()) {
            keyInput.setText(savedKey);
        }
        r.addView(keyInput);

        startBtn = new Button(this);
        startBtn.setText("ATIVAR E INICIAR");
        startBtn.setOnClickListener(v -> activate(keyInput.getText().toString()));
        r.addView(startBtn);

        Button stop = new Button(this);
        stop.setText("PARAR");
        stop.setOnClickListener(v -> {
            Zdrx.boot(false);
            stopService(new Intent(this, ZdrxVpn.class));
            stopService(new Intent(this, ZdrxOverlay.class));
            say("serviços parados");
        });
        r.addView(stop);

        out = new TextView(this);
        out.setTextColor(Color.parseColor("#9ca3af"));
        out.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        out.setPadding(0, dp(10), 0, 0);
        r.addView(out);

        loop();
        return sc;
    }

    private void loop() {
        out.postDelayed(new Runnable() {
            @Override public void run() {
                try {
                    Zdrx.tick();
                    String tr = Zdrx.traceDrain();
                    if (tr != null && !tr.trim().isEmpty()) say(tr.trim());

                    if (Prefs.isLicenseActive()) {
                        licStatus.setText("Licença ativa: " + Lic.formatRemaining(Prefs.getExpiry()));
                        licStatus.setTextColor(Color.parseColor("#4ade80"));
                    }
                } catch (Throwable ignored) {}
                out.postDelayed(this, 1500);
            }
        }, 1500);
    }

    private void say(String s) { out.setText(s + "\n" + out.getText()); }

    private void ask() {
        List<String> need = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                   != PackageManager.PERMISSION_GRANTED) {
            need.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!need.isEmpty()) requestPermissions(need.toArray(new String[0]), REQ_PERM);

        if (!Settings.canDrawOverlays(this)) {
            say("conceda \"Sobrepor a outros apps\"");
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION));
        }
    }

    private void activate(String keyStr) {
        final String clean = keyStr != null ? keyStr.trim().toUpperCase() : "";
        if (clean.isEmpty()) {
            Toast.makeText(this, "Informe a chave de licença", Toast.LENGTH_SHORT).show();
            say("erro: chave em branco");
            return;
        }

        startBtn.setEnabled(false);
        startBtn.setText("VALIDANDO NO SUPABASE...");
        say("validando chave com servidor...");

        Lic.checkAsync(this, clean, (status, msg, expiresAtMs) -> {
            startBtn.setEnabled(true);
            startBtn.setText("ATIVAR E INICIAR");

            if (status == Lic.OK) {
                say("licenca OK: " + Lic.formatRemaining(expiresAtMs));
                licStatus.setText("Licença ativa: " + Lic.formatRemaining(expiresAtMs));
                licStatus.setTextColor(Color.parseColor("#4ade80"));
                Toast.makeText(Boot.this, "Licença válida!", Toast.LENGTH_SHORT).show();
                proceedToStart();
            } else {
                say("licenca RECUSADA: " + msg);
                licStatus.setText(msg);
                licStatus.setTextColor(Color.parseColor("#f87171"));
                Toast.makeText(Boot.this, msg, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void proceedToStart() {
        if (!Settings.canDrawOverlays(this)) {
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION));
            return;
        }

        Intent vpn = VpnService.prepare(this);
        if (vpn != null) { startActivityForResult(vpn, REQ_VPN); return; }
        launch();
    }

    private void launch() {
        if (!Prefs.isLicenseActive()) {
            say("erro: sem licença válida para iniciar");
            Toast.makeText(this, "Licença expirada ou inválida", Toast.LENGTH_SHORT).show();
            return;
        }
        Zdrx.boot(true);
        Prefs.loadCfg();
        startService(new Intent(this, ZdrxVpn.class));
        startService(new Intent(this, ZdrxOverlay.class));
        say("motor ONLINE - VPN + overlay ativos");
    }

    @Override protected void onActivityResult(int req, int res, Intent d) {
        super.onActivityResult(req, res, d);
        if (req == REQ_VPN) {
            if (res == RESULT_OK) launch();
            else say("VPN recusada pelo usuário");
        }
    }

    @Override protected void onPause() {
        super.onPause();
        try { Prefs.saveCfg(); } catch (Throwable ignored) {}
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v,
                getResources().getDisplayMetrics());
    }
}
