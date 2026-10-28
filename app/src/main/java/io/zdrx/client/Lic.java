package io.zdrx.client;

import android.content.Context;
import android.provider.Settings;

import java.security.MessageDigest;

/** Licenca offline por HWID. Chave: ZDRX- + 8 primeiros digitos do HWID. */
public final class Lic {

    public static final int OK = 0, BAD = 1, EXPIRED = 2, BANNED = 3;

    public static String hwid(Context c) {
        String id = null;
        try {
            id = Settings.Secure.getString(c.getContentResolver(), Settings.Secure.ANDROID_ID);
        } catch (Throwable ignored) {}
        if (id == null || id.isEmpty()) id = "nodevice";
        return sha256("zdrx|" + id);
    }

    public static String keyFor(Context c) {
        return "ZDRX-" + hwid(c).substring(0, 8).toUpperCase();
    }

    public static int check(Context c, String key) {
        if (key == null) return BAD;
        key = key.trim();
        if (key.isEmpty()) return BAD;
        if (key.equalsIgnoreCase("ZDRX-TRIAL")) return OK;
        if (key.equalsIgnoreCase(keyFor(c))) return OK;
        return BAD;
    }

    static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(s.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Throwable t) {
            return "00000000";
        }
    }

    private Lic() {}
}
