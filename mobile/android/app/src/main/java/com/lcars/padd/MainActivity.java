package com.lcars.padd;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/**
 * Launcher entry retained for upgrades and shortcuts. Version 30.2 presents the
 * Companion as a first-class page inside the unified Home activity.
 */
public final class MainActivity extends Activity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        openUnifiedInterface();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openUnifiedInterface();
    }

    private void openUnifiedInterface() {
        Intent home = new Intent(this, HomeActivity.class);
        home.putExtra("open-page", "companion");
        home.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(home);
        overridePendingTransition(0, 0);
        finish();
    }
}
