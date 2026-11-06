package io.zdrx.client;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Validador de Licenças de Alta Segurança ZDRX.
 * Implementa:
 *  - Assinatura HMAC-SHA256 em tempo real
 *  - Anti-Replay com Nonce criptográfico e Janela de Timestamp
 *  - Suporte a Takeover automático de HWID com Cooldown
 *  - Sessões únicas com heartbeat ativo e auto-logout
 *  - Kill-switch e checagem de integridade
 */
public final class Lic {

    public static final int OK = 0;
    public static final int BAD = 1;
    public static final int EXPIRED = 2;
    public static final int BANNED = 3;
    public static final int HWID_MISMATCH = 4;
    public static final int NET_ERROR = 5;
    public static final int KILL_SWITCH = 6;
    public static final int OUTDATED_VERSION = 7;
    public static final int RATE_LIMITED = 8;
    public static final int TAKEOVER_COOLDOWN = 9;
    public static final int DEVICE_CONFLICT = 10;

    public static final String SUPABASE_URL = "https://edkwbqbwkatdqfpvhnfa.supabase.co";
    public static final String SUPABASE_ANON_KEY =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
            + "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVka3dicWJ3a2F0ZHFmcHZobmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MjA4MDIsImV4cCI6MjEwOTQ5NjgwMn0."
            + "8875_UgXiXgCRcytYeUg0MNvzrtU046PN_Biljdzjso";

    private static final String HMAC_SECRET = "zdrx_sec_99a8b7c6d5e4f3a2b10c9d8e7f6a5b4c";

    public interface Callback {
        void onResult(int status, String message, long expiresAtMs);
    }

    public interface NotificationCallback {
        void onNotification(String id, String title, String message, String createdAt);
    }

    public static String hwid(Context c) {
        String id = null;
        try {
            id = Settings.Secure.getString(c.getContentResolver(), Settings.Secure.ANDROID_ID);
        } catch (Throwable ignored) {}
        if (id == null || id.isEmpty()) id = "nodevice";
        return sha256("zdrx|" + id);
    }

    public static void checkAsync(Context c, String key, Callback cb) {
        verifyRequest(c, key, false, cb);
    }

    public static void heartbeatAsync(Context c, Callback cb) {
        String key = Prefs.getKey();
        if (key == null || key.isEmpty()) {
            cb.onResult(BAD, "Nenhuma chave ativa", 0L);
            return;
        }
        verifyRequest(c, key, true, cb);
    }

    private static void verifyRequest(Context c, String key, boolean isHeartbeat, Callback cb) {
        final Context appCtx = c.getApplicationContext();
        final Handler mainHandler = new Handler(Looper.getMainLooper());
        final String cleanKey = key != null ? key.trim().toUpperCase() : "";
        final String deviceHwid = hwid(appCtx);
        final String sessionId = Prefs.getSessionId();

        if (cleanKey.isEmpty()) {
            mainHandler.post(() -> cb.onResult(BAD, "Informe uma chave de licença", 0L));
            return;
        }

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(SUPABASE_URL + "/rest/v1/rpc/verify_license_secure");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
                conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setDoOutput(true);

                long nowMs = System.currentTimeMillis();
                String nonce = "nonce-" + UUID.randomUUID().toString().replace("-", "");

                // Mensagem de integridade: POST|/verify|timestamp|nonce|key|hwid|sessionId
                String sigMessage = "POST|/verify|" + nowMs + "|" + nonce + "|" + cleanKey + "|" + deviceHwid + "|" + sessionId;
                String signature = hmacSha256(HMAC_SECRET, sigMessage);

                JSONObject payload = new JSONObject();
                payload.put("p_key", cleanKey);
                payload.put("p_hwid", deviceHwid);
                payload.put("p_session_id", sessionId);
                payload.put("p_version", Zdrx.VER);
                payload.put("p_nonce", nonce);
                payload.put("p_timestamp", nowMs);
                payload.put("p_signature", signature);
                payload.put("p_is_heartbeat", isHeartbeat);
                payload.put("p_ip", "0.0.0.0"); // Capturado na borda

                byte[] outBytes = payload.toString().getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(outBytes.length);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(outBytes);
                    os.flush();
                }

                int code = conn.getResponseCode();
                InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
                StringBuilder sb = new StringBuilder();
                if (is != null) {
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = reader.readLine()) != null) sb.append(line);
                    }
                }

                if (code >= 200 && code < 300) {
                    JSONObject res = new JSONObject(sb.toString());
                    boolean valid = res.optBoolean("valid", false);
                    String status = res.optString("status", "BAD");
                    String message = res.optString("message", "");
                    long remainingSec = res.optLong("remaining_seconds", 0L);

                    if (valid && "OK".equalsIgnoreCase(status)) {
                        long expiresAtMs = System.currentTimeMillis() + (remainingSec * 1000L);
                        Prefs.putKey(cleanKey);
                        Prefs.putExpiry(expiresAtMs);
                        mainHandler.post(() -> cb.onResult(OK, message, expiresAtMs));
                    } else {
                        int stCode = BAD;
                        if ("EXPIRED".equalsIgnoreCase(status)) stCode = EXPIRED;
                        else if ("BANNED".equalsIgnoreCase(status)) stCode = BANNED;
                        else if ("HWID_MISMATCH".equalsIgnoreCase(status)) stCode = HWID_MISMATCH;
                        else if ("KILL_SWITCH".equalsIgnoreCase(status)) stCode = KILL_SWITCH;
                        else if ("OUTDATED_VERSION".equalsIgnoreCase(status)) stCode = OUTDATED_VERSION;
                        else if ("RATE_LIMITED".equalsIgnoreCase(status)) stCode = RATE_LIMITED;
                        else if ("TAKEOVER_COOLDOWN".equalsIgnoreCase(status)) stCode = TAKEOVER_COOLDOWN;
                        else if ("SESSION_REVOKED".equalsIgnoreCase(status) || "DEVICE_CONFLICT".equalsIgnoreCase(status)) stCode = DEVICE_CONFLICT;

                        Prefs.putExpiry(0L);
                        final int fCode = stCode;
                        final String fMsg = message.isEmpty() ? "Chave recusada" : message;
                        mainHandler.post(() -> cb.onResult(fCode, fMsg, 0L));
                    }
                } else {
                    mainHandler.post(() -> cb.onResult(NET_ERROR, "Servidor retornou código " + code, 0L));
                }
            } catch (Exception e) {
                if (cleanKey.equalsIgnoreCase(Prefs.getKey()) && Prefs.isLicenseActive()) {
                    long cachedExp = Prefs.getExpiry();
                    mainHandler.post(() -> cb.onResult(OK, "Modo seguro offline (cache local)", cachedExp));
                } else {
                    mainHandler.post(() -> cb.onResult(NET_ERROR, "Falha de rede: " + e.getMessage(), 0L));
                }
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    public static String formatRemaining(long expiresAtMs) {
        long diff = expiresAtMs - System.currentTimeMillis();
        if (diff <= 0) return "Expirada";
        long sec = diff / 1000L;
        long min = sec / 60L;
        long hours = min / 60L;
        long days = hours / 24L;

        if (days > 0) {
            return String.format(Locale.getDefault(), "%dd %02dh restantes", days, hours % 24);
        } else if (hours > 0) {
            return String.format(Locale.getDefault(), "%02dh %02dm restantes", hours, min % 60);
        } else {
            return String.format(Locale.getDefault(), "%02dm %02ds restantes", min, sec % 60);
        }
    }

    public static String hmacSha256(String key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] bytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Throwable t) {
            return "00000000";
        }
    }

    public static void fetchLatestNotificationAsync(Context c, NotificationCallback cb) {
        final Handler mainHandler = new Handler(Looper.getMainLooper());
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(SUPABASE_URL + "/rest/v1/notifications?select=id,title,message,created_at&order=created_at.desc&limit=1");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
                conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_ANON_KEY);
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);

                if (conn.getResponseCode() == 200) {
                    BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = r.readLine()) != null) sb.append(line);
                    r.close();

                    JSONArray arr = new JSONArray(sb.toString());
                    if (arr.length() > 0) {
                        JSONObject obj = arr.getJSONObject(0);
                        String id = obj.optString("id", "");
                        String t = obj.optString("title", "");
                        String m = obj.optString("message", "");
                        String ca = obj.optString("created_at", "");
                        mainHandler.post(() -> cb.onNotification(id, t, m, ca));
                        return;
                    }
                }
                mainHandler.post(() -> cb.onNotification(null, null, null, null));
            } catch (Throwable ignored) {
                mainHandler.post(() -> cb.onNotification(null, null, null, null));
            } finally {
                if (conn != null) conn.disconnect();
            }
        }).start();
    }

    private Lic() {}
}
