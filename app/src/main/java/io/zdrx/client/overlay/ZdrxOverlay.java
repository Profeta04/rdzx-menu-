package io.zdrx.client.overlay;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;

import io.zdrx.client.Prefs;
import io.zdrx.client.Zdrx;

/** Janela flutuante com ESP + menu tocavel. O toque passa para o jogo. */
public class ZdrxOverlay extends Service {

    private WindowManager wm;
    private FrameLayout root;
    private EspView esp;

    private final Handler h = new Handler(Looper.getMainLooper());
    private volatile boolean running;

    @Override public void onCreate() {
        super.onCreate();

        wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);

        root = new FrameLayout(this);

        esp = new EspView(this);
        root.addView(esp, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        MenuView menu = new MenuView(this);
        FrameLayout.LayoutParams mp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        mp.gravity = Gravity.TOP | Gravity.START;
        mp.leftMargin = 40;
        mp.topMargin = 220;
        root.addView(menu, mp);

        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;

        wm.addView(root, lp);

        running = true;
        h.post(frame);
    }

    private final Runnable frame = new Runnable() {
        @Override public void run() {
            if (!running) return;
            esp.invalidate();
            h.postDelayed(this, 16);
        }
    };

    @Override public int onStartCommand(Intent i, int f, int s) { return START_STICKY; }

    @Override public void onDestroy() {
        running = false;
        h.removeCallbacks(frame);
        try { Prefs.saveCfg(); } catch (Throwable ignored) {}
        try { if (root != null) wm.removeView(root); } catch (Throwable ignored) {}
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent i) { return null; }

    static class EspView extends View {

        private final FloatBuffer buf = ByteBuffer.allocateDirect(Zdrx.ESP_CAP * 4)
                .order(ByteOrder.nativeOrder()).asFloatBuffer();

        private final Paint box  = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint ray  = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint txt  = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint hpBg = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint hpFg = new Paint(Paint.ANTI_ALIAS_FLAG);

        private static final float FOV = 880f;

        EspView(Context c) {
            super(c);

            box.setStyle(Paint.Style.STROKE);
            box.setStrokeWidth(3f);
            box.setColor(0xFF22D3EE);

            ray.setStrokeWidth(2f);
            ray.setColor(0x80F59E0B);

            txt.setColor(0xFFFFFFFF);
            txt.setTextSize(26f);
            txt.setShadowLayer(4f, 0f, 0f, 0xFF000000);

            hpBg.setColor(0x99000000);
            hpFg.setColor(0xFF34D399);
        }

        @Override public boolean onTouchEvent(MotionEvent e) { return false; }

        @Override protected void onDraw(Canvas cv) {
            if (!Zdrx.live()) return;

            buf.clear();
            int n;
            try { n = Zdrx.espInto(buf); } catch (Throwable t) { return; }
            if (n <= 0) return;

            buf.position(0);
            float px = buf.get(0), py = buf.get(1), pz = buf.get(2);
            float yaw = buf.get(3), pitch = buf.get(4);
            buf.get(5); buf.get(6); buf.get(7);

            int w = getWidth(), hgt = getHeight();
            float cx = w / 2f, cy = hgt / 2f;

            double ry = Math.toRadians(-yaw);
            double rp = Math.toRadians(-pitch);
            float cosY = (float) Math.cos(ry), sinY = (float) Math.sin(ry);
            float cosP = (float) Math.cos(rp), sinP = (float) Math.sin(rp);

            for (int i = 0; i < n; i++) {
                int b = 8 + i * 6;
                float ex = buf.get(b), ey = buf.get(b + 1), ez = buf.get(b + 2);
                float id = buf.get(b + 3);
                float hp = buf.get(b + 4);

                float dx = ex - px, dy = ey - py, dz = ez - pz;

                float x1 = dx * cosY - dy * sinY;
                float y1 = dx * sinY + dy * cosY;

                float y2 = y1 * cosP - dz * sinP;
                float z2 = y1 * sinP + dz * cosP;
                if (z2 < 1f) continue;

                float sx = cx + (x1 / z2) * FOV;
                float sy = cy - (y2 / z2) * FOV;

                float dist = (float) Math.sqrt(x1 * x1 + y2 * y2 + z2 * z2);
                if (dist > 300f) continue;

                float size = Math.max(30f, 2400f / dist);
                float half = size / 2f;
                float top = sy - half * 1.7f;
                float bottom = sy + half * 0.3f;

                cv.drawRect(sx - half, top, sx + half, bottom, box);
                cv.drawLine(cx, hgt, sx, bottom, ray);

                if (hp > 0f && hp <= 100f) {
                    float hh = (bottom - top) * (hp / 100f);
                    cv.drawRect(sx - half - 9f, top, sx - half - 4f, bottom, hpBg);
                    cv.drawRect(sx - half - 9f, bottom - hh, sx - half - 4f, bottom, hpFg);
                }

                cv.drawText("ID " + (int) id, sx - half, top - 8f, txt);
                cv.drawText(String.format("%.0fm", dist), sx - half, bottom + 28f, txt);
            }
        }
    }
}
