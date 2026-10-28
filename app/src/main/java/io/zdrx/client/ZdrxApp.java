package io.zdrx.client;

import android.app.Application;

public class ZdrxApp extends Application {

    @Override public void onCreate() {
        super.onCreate();
        Prefs.init(this);
        Zdrx.boot(false);
    }
}
