package io.zdrx.client;

import java.nio.FloatBuffer;

/** Ponte com libzdrx.so. A UI se monta a partir da tabela nativa. */
public final class Zdrx {

    public static final String NAME = "ZDRX Client";
    public static final String VER  = "1.0.0";
    public static final String PKG  = "io.zdrx.client";
    public static final String GAME = "com.dts.freefireth";

    public static final int ESP_CAP = 8 + 96 * 6;

    static { System.loadLibrary("zdrx"); }

    public static native void boot(boolean enable);
    public static native void wipe();
    public static native void tick();
    public static native boolean live();

    public static native void set(int f, int v);
    public static native void setJson(String json);
    public static native String cfgJson();

    public static native String statusJson();
    public static native String traceDrain();

    public static native int featCount();
    public static native String featKey(int i);
    public static native String featLabel(int i);
    public static native int featType(int i);
    public static native int featDef(int i);
    public static native int featLo(int i);
    public static native int featHi(int i);

    public static native boolean looksLikeGame(byte[] pkt);
    public static native byte[] onS2C(byte[] pkt);
    public static native byte[] onC2S(byte[] pkt);
    public static native byte[][] drainOut();

    public static native int espInto(FloatBuffer buf);

    public static native boolean firing();

    private Zdrx() {}
}
