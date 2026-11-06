package io.zdrx.client;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.UUID;

public final class Prefs {

    private static final String STORE = "zdrx";
    private static SharedPreferences sp;

    public static void init(Context c) {
        sp = c.getApplicationContext().getSharedPreferences(STORE, Context.MODE_PRIVATE);
    }

    public static String str(String k, String def) {
        return sp == null ? def : sp.getString(k, def);
    }

    public static void putStr(String k, String v) {
        if (sp != null) sp.edit().putString(k, v).apply();
    }

    public static long getLong(String k, long def) {
        return sp == null ? def : sp.getLong(k, def);
    }

    public static void putLong(String k, long v) {
        if (sp != null) sp.edit().putLong(k, v).apply();
    }

    public static String getKey() {
        return str("lic_key", "");
    }

    public static void putKey(String k) {
        putStr("lic_key", k != null ? k.trim().toUpperCase() : "");
    }

    public static long getExpiry() {
        return getLong("lic_expiry", 0L);
    }

    public static void putExpiry(long ms) {
        putLong("lic_expiry", ms);
    }

    public static String getSessionId() {
        String s = str("lic_session_id", "");
        if (s == null || s.isEmpty()) {
            s = "sess-" + UUID.randomUUID().toString();
            putStr("lic_session_id", s);
        }
        return s;
    }

    public static void newSessionId() {
        putStr("lic_session_id", "sess-" + UUID.randomUUID().toString());
    }

    public static boolean isLicenseActive() {
        long exp = getExpiry();
        return exp > 0 && System.currentTimeMillis() < exp;
    }

    public static String getLastNotifId() {
        return str("last_notif_id", "");
    }

    public static void putLastNotifId(String id) {
        putStr("last_notif_id", id != null ? id : "");
    }

    public static void saveCfg() { putStr("cfg", Zdrx.cfgJson()); }

    public static void loadCfg() {
        String j = str("cfg", null);
        if (j != null && j.length() > 2) Zdrx.setJson(j);
    }

    private Prefs() {}
}
