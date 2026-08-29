package com.lcars.padd;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Notification;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.text.InputType;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String PREFS = "lcars-padd";
    private static final String LAST_STATION = "last-station";
    private static final String DEVICE_NAME = "device-name";
    private static final String TOKEN = "station-token";
    private static final String SIGNAL = "last-signal-v28";
    private static final String NOTICE = "last-notice-v28";
    private static final String MEDIA_TARGET = "media-target-v28";
    private static final String CHANNEL = "lcars-connected-operations";
    private static final int LOCAL_NETWORK_REQUEST = 271;
    private static final int NOTIFICATION_REQUEST = 281;
    private static final int BLACK = Color.rgb(0, 0, 0);
    private static final int PANEL = Color.rgb(18, 16, 22);
    private static final int DIM_PANEL = Color.rgb(28, 25, 32);
    private static final int ORANGE = Color.rgb(255, 152, 104);
    private static final int PEACH = Color.rgb(244, 182, 107);
    private static final int PINK = Color.rgb(233, 155, 197);
    private static final int BLUE = Color.rgb(130, 154, 241);
    private static final int VIOLET = Color.rgb(182, 157, 232);

    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private final Handler poller = new Handler(Looper.getMainLooper());
    private SharedPreferences preferences;
    private String stationRoot = "";
    private String token = "";
    private String activeTab = "status";
    private boolean consoleActive;
    private JSONObject latest;
    private LinearLayout consoleContent;
    private TextView linkBadge;
    private TextView consoleMessage;
    private float remoteFontScale = 1f;
    private String linkStatus = "LINK";
    private int linkColor = ORANGE;

    private final Runnable poll = new Runnable() {
        @Override public void run() {
            if (!consoleActive) return;
            refreshState(false);
            poller.postDelayed(this, 2500);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        getWindow().setStatusBarColor(BLACK);
        getWindow().setNavigationBarColor(BLACK);
        if (Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        requestLocalNetworkAccess();
        prepareNotifications();
        stationRoot = preferences.getString(LAST_STATION, "");
        token = preferences.getString(TOKEN, "");
        if (!stationRoot.isEmpty() && !token.isEmpty()) showConsole();
        else showSetup("");
    }

    private void requestLocalNetworkAccess() {
        if (Build.VERSION.SDK_INT >= 37
            && checkSelfPermission("android.permission.ACCESS_LOCAL_NETWORK") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.ACCESS_LOCAL_NETWORK"}, LOCAL_NETWORK_REQUEST);
        }
    }

    private void prepareNotifications() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && manager != null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "LCARS Communications", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Priority communications from a paired LCARS station");
            manager.createNotificationChannel(channel);
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, NOTIFICATION_REQUEST);
        }
    }

    private void showSetup(String alert) {
        consoleActive = false;
        latest = null;
        poller.removeCallbacks(poll);
        LinearLayout page = column(BLACK);
        page.addView(masthead("STANDALONE PADD", "SETUP"), matchWrap(dp(8)));

        LinearLayout intro = panel(BLUE);
        intro.addView(label("NATIVE LCARS COMPANION", PEACH, 10, true), matchWrap(dp(3)));
        intro.addView(label("CONNECT THIS PADD", Color.WHITE, 28, true), matchWrap(dp(8)));
        TextView copy = label("The interface is installed on this device. Pair it once with the private station address and six-digit code shown in Desktop Settings; afterward it reconnects automatically.", Color.LTGRAY, 15, false);
        copy.setLineSpacing(0, 1.16f);
        intro.addView(copy, matchWrap(0));
        page.addView(intro, matchWrap(dp(6)));

        LinearLayout steps = row(BLACK);
        steps.addView(step("01", "DESKTOP", "Settings → Connected"), weightedWrap(1, dp(3)));
        steps.addView(step("02", "ARM CODE", "Five-minute window"), weightedWrap(1, dp(3)));
        steps.addView(step("03", "PAIR", "Station + code"), weightedWrap(1, 0));
        page.addView(steps, matchWrap(dp(6)));

        LinearLayout form = panel(ORANGE);
        EditText station = input("STATION ADDRESS · 192.168.1.42", preferences.getString(LAST_STATION, ""), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        EditText name = input("PADD NAME", preferences.getString(DEVICE_NAME, "Personal PADD"), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        EditText code = input("SIX-DIGIT PAIRING CODE", "", InputType.TYPE_CLASS_NUMBER);
        code.setMaxLines(1);
        code.setImeOptions(EditorInfo.IME_ACTION_GO);
        Button pair = button("PAIR WITH LCARS", ORANGE);
        TextView message = label(alert, Color.rgb(255, 125, 133), 13, true);
        View.OnClickListener submit = ignored -> pairStation(station.getText().toString(), name.getText().toString(), code.getText().toString(), message, pair);
        pair.setOnClickListener(submit);
        code.setOnEditorActionListener((view, action, event) -> {
            if (action == EditorInfo.IME_ACTION_GO) {
                submit.onClick(view);
                return true;
            }
            return false;
        });
        form.addView(fieldLabel("PRIVATE STATION ADDRESS"), matchWrap(dp(4)));
        form.addView(station, matchWrap(dp(10)));
        form.addView(fieldLabel("DEVICE NAME"), matchWrap(dp(4)));
        form.addView(name, matchWrap(dp(10)));
        form.addView(fieldLabel("ONE-USE CODE"), matchWrap(dp(4)));
        form.addView(code, matchWrap(dp(10)));
        form.addView(pair, matchWrap(dp(8)));
        form.addView(message, matchWrap(0));
        page.addView(form, matchWrap(dp(6)));

        TextView security = label("TRUSTED PRIVATE NETWORK ONLY · TOKENS ARE REVOCABLE · TERMINAL, FILE, PROCESS, AND POWER ACCESS ARE NEVER EXPOSED", BLUE, 10, true);
        security.setPadding(dp(8), dp(8), dp(8), dp(8));
        security.setBackgroundColor(PANEL);
        page.addView(security, matchWrap(0));
        setScrollableContent(page);
    }

    private void pairStation(String rawStation, String deviceName, String code, TextView message, Button pairButton) {
        final String normalized;
        try {
            normalized = StationAddress.normalize(rawStation);
        } catch (IllegalArgumentException error) {
            message.setText(error.getMessage());
            return;
        }
        if (!code.matches("[0-9]{6}")) {
            message.setText("ENTER THE SIX-DIGIT CODE SHOWN BY LCARS SETTINGS");
            return;
        }
        stationRoot = normalized;
        pairButton.setEnabled(false);
        pairButton.setText("PAIRING…");
        message.setText("CONTACTING LOCAL STATION…");
        JSONObject body = new JSONObject();
        try {
            body.put("name", deviceName.trim().isEmpty() ? "Personal PADD" : deviceName.trim());
            body.put("code", code);
        } catch (Exception ignored) {}
        network.execute(() -> {
            try {
                JSONObject result = request("POST", "api/padd/pair", body, "");
                token = result.getString("token");
                preferences.edit()
                    .putString(LAST_STATION, stationRoot)
                    .putString(DEVICE_NAME, deviceName.trim().isEmpty() ? "Personal PADD" : deviceName.trim())
                    .putString(TOKEN, token)
                    .apply();
                runOnUiThread(this::showConsole);
            } catch (Exception error) {
                runOnUiThread(() -> {
                    pairButton.setEnabled(true);
                    pairButton.setText("PAIR WITH LCARS");
                    message.setText("PAIRING FAILED · " + error.getMessage());
                });
            }
        });
    }

    private void showConsole() {
        showConsole(true);
    }

    private void showConsole(boolean requestRefresh) {
        consoleActive = true;
        poller.removeCallbacks(poll);
        LinearLayout shell = column(BLACK);
        LinearLayout header = masthead("LCARS VERSION 28 · STABLE", linkStatus);
        linkBadge = (TextView) header.getChildAt(2);
        linkBadge.setBackground(shape(linkColor, 3, 28, 28, 3));
        shell.addView(header, matchWrap(dp(5)));

        LinearLayout tabs = row(BLACK);
        tabs.addView(tabButton("STATUS", "status", 0, 5), weightedHeight(1, dp(48), dp(3)));
        tabs.addView(tabButton("MEDIA", "media", 1, 5), weightedHeight(1, dp(48), dp(3)));
        tabs.addView(tabButton("COMMS", "communications", 2, 5), weightedHeight(1, dp(48), dp(3)));
        tabs.addView(tabButton("CMD", "command", 3, 5), weightedHeight(1, dp(48), dp(3)));
        tabs.addView(tabButton("MORE", "more", 4, 5), weightedHeight(1, dp(48), 0));
        shell.addView(tabs, matchWrap(dp(5)));

        consoleContent = column(BLACK);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(consoleContent, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        shell.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        LinearLayout footer = row(BLACK);
        Button refresh = button("REFRESH", BLUE);
        Button station = button("STATION SETTINGS", VIOLET);
        refresh.setOnClickListener(ignored -> refreshState(true));
        station.setOnClickListener(ignored -> showSetup(""));
        footer.addView(refresh, weightedHeight(1, dp(46), dp(3)));
        footer.addView(station, weightedHeight(1, dp(46), 0));
        shell.addView(footer, matchWrap(dp(4)));
        consoleMessage = label("ACQUIRING STATION STATE…", PEACH, 11, true);
        shell.addView(consoleMessage, matchWrap(0));
        boolean expanded = getResources().getConfiguration().smallestScreenWidthDp >= 600 || getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
        setInsetAwareContent(shell, expanded ? 18 : 8, 10, expanded ? 18 : 8, 8);
        if (latest != null) renderConsole();
        if (requestRefresh || latest == null) refreshState(true);
        poller.postDelayed(poll, 2500);
    }

    private Button tabButton(String title, String tab, int index, int count) {
        Button button = button(title, activeTab.equals(tab) ? ORANGE : DIM_PANEL);
        button.setTextColor(activeTab.equals(tab) ? BLACK : Color.LTGRAY);
        int color = activeTab.equals(tab) ? ORANGE : DIM_PANEL;
        if (index == 0) button.setBackground(shape(color, 24, 3, 3, 24));
        else if (index == count - 1) button.setBackground(shape(color, 3, 24, 24, 3));
        else button.setBackground(shape(color, 3, 3, 3, 3));
        button.setOnClickListener(ignored -> {
            activeTab = tab;
            showConsole(false);
        });
        return button;
    }

    private void refreshState(boolean announce) {
        if (!consoleActive) return;
        if (announce && consoleMessage != null) consoleMessage.setText("REFRESHING LOCAL LINK…");
        network.execute(() -> {
            try {
                long started = System.currentTimeMillis();
                JSONObject result = request("GET", "api/padd/state", null, token);
                long latency = Math.max(0, System.currentTimeMillis() - started);
                sendHeartbeat(latency);
                latest = result;
                PaddWidgetProvider.updateAll(this, result.optJSONObject("state"));
                runOnUiThread(() -> {
                    if (!consoleActive) return;
                    if (linkBadge != null) {
                        linkStatus = "ONLINE";
                        linkColor = ORANGE;
                        linkBadge.setText(linkStatus);
                        linkBadge.setBackground(shape(linkColor, 3, 28, 28, 3));
                    }
                    if (consoleMessage != null) consoleMessage.setText(announce ? "STATION STATE SYNCHRONIZED" : "");
                    processSignal(result.optJSONObject("signal"));
                    processPriorityNotice(result.optJSONObject("state"));
                    renderConsole();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    if (!consoleActive) return;
                    if (error.getMessage() != null && error.getMessage().toLowerCase().contains("authorization")) {
                        forgetToken();
                        showSetup("THIS PADD ACCESS WAS REVOKED · ARM A NEW PAIRING CODE");
                        return;
                    }
                    if (linkBadge != null) {
                        linkStatus = "OFFLINE";
                        linkColor = PINK;
                        linkBadge.setText(linkStatus);
                        linkBadge.setBackground(shape(linkColor, 3, 28, 28, 3));
                    }
                    if (consoleMessage != null) consoleMessage.setText("LINK STANDBY · " + error.getMessage());
                });
            }
        });
    }

    private void sendHeartbeat(long latency) {
        JSONObject body = new JSONObject();
        try {
            body.put("battery", batteryLevel());
            body.put("network", networkLabel());
            body.put("latencyMs", latency);
            body.put("version", "28.0.0");
            request("POST", "api/padd/heartbeat", body, token);
        } catch (Exception ignored) {}
    }

    private int batteryLevel() {
        BatteryManager battery = getSystemService(BatteryManager.class);
        return battery == null ? -1 : battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
    }

    private String networkLabel() {
        ConnectivityManager manager = getSystemService(ConnectivityManager.class);
        if (manager == null) return "unknown";
        Network network = manager.getActiveNetwork();
        NetworkCapabilities capabilities = manager.getNetworkCapabilities(network);
        if (capabilities == null) return "offline";
        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return "wifi";
        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) return "ethernet";
        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) return "cellular";
        return "local-network";
    }

    private void processSignal(JSONObject signal) {
        if (signal == null) return;
        String id = signal.optString("id", "");
        if (id.isEmpty() || id.equals(preferences.getString(SIGNAL, ""))) return;
        preferences.edit().putString(SIGNAL, id).apply();
        vibrate(180);
        Toast.makeText(this, "LCARS IDENTIFY · THIS IS " + preferences.getString(DEVICE_NAME, "PADD"), Toast.LENGTH_LONG).show();
    }

    private void processPriorityNotice(JSONObject state) {
        if (state == null) return;
        JSONArray notices = state.optJSONArray("notices");
        if (notices == null) return;
        JSONObject device = latest == null ? null : latest.optJSONObject("device");
        JSONObject settings = device == null ? null : device.optJSONObject("notifications");
        boolean priorityOnly = settings == null || settings.optBoolean("priorityOnly", true);
        boolean connectionEvents = settings == null || settings.optBoolean("connectionEvents", true);
        boolean routineResults = settings == null || settings.optBoolean("routineResults", true);
        for (int index = 0; index < notices.length(); index++) {
            JSONObject notice = notices.optJSONObject(index);
            if (notice == null || notice.optBoolean("read", false)) continue;
            String priority = notice.optString("priority", notice.optString("status", "")).toLowerCase();
            boolean urgent = priority.contains("critical") || priority.contains("priority") || priority.contains("error");
            if (priorityOnly && !urgent) continue;
            String category = (notice.optString("source", "") + " " + notice.optString("name", "") + " " + notice.optString("kind", "")).toLowerCase();
            if (!connectionEvents && (category.contains("connection") || category.contains("link"))) continue;
            if (!routineResults && category.contains("routine")) continue;
            String id = notice.optString("id", "");
            if (id.isEmpty() || id.equals(preferences.getString(NOTICE, ""))) continue;
            preferences.edit().putString(NOTICE, id).apply();
            Intent open = new Intent(this, MainActivity.class);
            PendingIntent intent = PendingIntent.getActivity(this, 28, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification notification = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(android.R.drawable.stat_notify_more)
                .setContentTitle(notice.optString("name", "LCARS PRIORITY SIGNAL"))
                .setContentText(notice.optString("text", notice.optString("detail", "Open the PADD Communications console")))
                .setContentIntent(intent).setAutoCancel(true).build();
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null && (Build.VERSION.SDK_INT < 33 || checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED)) manager.notify(id.hashCode(), notification);
            return;
        }
    }

    private void vibrate(int milliseconds) {
        Vibrator vibrator;
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager manager = getSystemService(VibratorManager.class);
            vibrator = manager == null ? null : manager.getDefaultVibrator();
        } else vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE));
        else vibrator.vibrate(milliseconds);
    }

    private void renderConsole() {
        if (consoleContent == null || latest == null) return;
        consoleContent.removeAllViews();
        JSONObject state = latest.optJSONObject("state");
        JSONObject device = latest.optJSONObject("device");
        JSONObject capabilities = latest.optJSONObject("capabilities");
        if (state == null) state = new JSONObject();
        if (capabilities == null) capabilities = new JSONObject();
        JSONObject accessibility = state.optJSONObject("accessibility");
        double requestedScale = accessibility == null ? 1 : accessibility.optDouble("fontScale", 1);
        if (requestedScale > 2) requestedScale /= 100;
        remoteFontScale = Math.max(.9f, Math.min(1.35f, (float) requestedScale));
        String role = device == null ? "PAIRED" : device.optString("role", "operator").toUpperCase();
        if (activeTab.equals("media")) renderMedia(state, capabilities, role);
        else if (activeTab.equals("communications")) renderCommunications(state, capabilities, role);
        else if (activeTab.equals("command")) renderCommand(state, capabilities, role);
        else if (activeTab.equals("more")) renderMore(state, capabilities, role, device);
        else renderStatus(state, capabilities, role);
    }

    private void renderStatus(JSONObject state, JSONObject capabilities, String role) {
        consoleContent.addView(sectionHeader("CONNECTED STATION", "STATUS", role), matchWrap(dp(5)));
        JSONArray widgets = state.optJSONArray("widgets");
        if (widgets == null || contains(widgets, "status")) {
            LinearLayout cards = row(BLACK);
            cards.addView(statusCard("ACTIVE PAGE", state.optString("page", "overview").toUpperCase(), ORANGE), weightedWrap(1, dp(3)));
            cards.addView(statusCard("MASTER AUDIO", state.optInt("volume", 0) + "%", BLUE), weightedWrap(1, 0));
            consoleContent.addView(cards, matchWrap(dp(5)));
        }
        JSONArray meters = state.optJSONArray("meters");
        if ((widgets == null || contains(widgets, "telemetry")) && meters != null) {
            for (int index = 0; index < meters.length(); index++) {
                JSONObject item = meters.optJSONObject(index);
                if (item == null) continue;
                consoleContent.addView(meter(item.optString("label", item.optString("name", "SYSTEM")), item.optInt("value", 0)), matchWrap(dp(3)));
            }
        }
        if (widgets == null || contains(widgets, "media")) {
            consoleContent.addView(subhead("NOW PLAYING", count(state.optJSONArray("media")) + " SOURCES"), matchWrap(dp(3)));
            addReadOnlyList(state.optJSONArray("media"), "NO ACTIVE MEDIA SOURCES");
        }
        if (widgets == null || contains(widgets, "communications")) {
            consoleContent.addView(subhead("COMMUNICATIONS", count(state.optJSONArray("notices")) + " SIGNALS"), matchWrap(dp(3)));
            addReadOnlyList(state.optJSONArray("notices"), "NO PRIORITY SIGNALS");
        }
        if (widgets == null || contains(widgets, "quick-actions")) {
            consoleContent.addView(subhead("QUICK ACTIONS", capabilities.optBoolean("quick") ? "READY" : "OPERATOR ROLE REQUIRED"), matchWrap(dp(3)));
            addCommandList(state.optJSONArray("quickActions"), "quick", capabilities.optBoolean("quick"), "NO QUICK ACTIONS SHARED");
        }
        JSONArray running = state.optJSONArray("routineStatus");
        if (running != null && running.length() > 0) {
            consoleContent.addView(subhead("ACTIVE OPERATIONS", running.length() + " RUNNING"), matchWrap(dp(3)));
            addReadOnlyList(running, "NO ACTIVE ROUTINES");
        }
    }

    private void renderCommunications(JSONObject state, JSONObject capabilities, String role) {
        consoleContent.addView(sectionHeader("PRIORITY RELAY", "COMMUNICATIONS", role), matchWrap(dp(5)));
        JSONArray notices = state.optJSONArray("notices");
        if (notices == null || notices.length() == 0) {
            consoleContent.addView(emptyState("NO ACTIVE COMMUNICATIONS"), matchWrap(dp(5)));
            return;
        }
        consoleContent.addView(actionButton("DISMISS ALL", "notice-dismiss-all", "all", capabilities.optBoolean("notice-dismiss-all"), PINK), matchWrap(dp(5)));
        for (int index = 0; index < notices.length(); index++) {
            JSONObject item = notices.optJSONObject(index);
            if (item == null) continue;
            LinearLayout card = panel(index % 2 == 0 ? ORANGE : BLUE);
            card.addView(label(item.optString("name", "LCARS CORE"), PEACH, 10, true), matchWrap(dp(2)));
            card.addView(label(item.optString("text", item.optString("detail", "SIGNAL")), Color.WHITE, 15, false), matchWrap(dp(7)));
            LinearLayout actions = row(PANEL);
            actions.addView(actionButton("ACKNOWLEDGE", "notice-read", item.optString("id", ""), capabilities.optBoolean("notice-read"), BLUE), weightedHeight(1, dp(44), dp(3)));
            actions.addView(actionButton("ARCHIVE", "notice-archive", item.optString("id", ""), capabilities.optBoolean("notice-archive"), VIOLET), weightedHeight(1, dp(44), 0));
            card.addView(actions, matchWrap(0));
            consoleContent.addView(card, matchWrap(dp(5)));
        }
    }

    private void renderMedia(JSONObject state, JSONObject capabilities, String role) {
        consoleContent.addView(sectionHeader("REMOTE AUDIO BUS", "MEDIA CONTROL", role), matchWrap(dp(5)));
        JSONArray media = state.optJSONArray("media");
        JSONObject target = preferredMedia(media);
        String playerId = target == null ? "" : target.optString("id", "");
        boolean mediaReady = capabilities.optBoolean("media") && !playerId.isEmpty();
        addMediaSourceList(media);
        if (target != null) consoleContent.addView(subhead("CONTROL TARGET", target.optString("name", "ACTIVE PLAYER").toUpperCase()), matchWrap(dp(3)));
        LinearLayout transport = row(BLACK);
        transport.addView(actionButton("|◀", "media", mediaRequest(playerId, "previous"), mediaReady, BLUE), weightedHeight(1, dp(52), dp(3)));
        transport.addView(actionButton("▶ / Ⅱ", "media", mediaRequest(playerId, "play-pause"), mediaReady, ORANGE), weightedHeight(1, dp(52), dp(3)));
        transport.addView(actionButton("▶|", "media", mediaRequest(playerId, "next"), mediaReady, BLUE), weightedHeight(1, dp(52), 0));
        consoleContent.addView(transport, matchWrap(dp(6)));
        LinearLayout volume = panel(VIOLET);
        TextView value = label(state.optInt("volume", 0) + "%", Color.WHITE, 24, true);
        SeekBar seek = new SeekBar(this);
        seek.setMax(100);
        seek.setProgress(state.optInt("volume", 0));
        seek.setEnabled(capabilities.optBoolean("volume"));
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar bar, int progress, boolean fromUser) { value.setText(progress + "%"); }
            @Override public void onStartTrackingTouch(SeekBar bar) {}
            @Override public void onStopTrackingTouch(SeekBar bar) { sendAction("volume", bar.getProgress()); }
        });
        volume.addView(fieldLabel("MASTER VOLUME"), matchWrap(dp(4)));
        volume.addView(value, matchWrap(dp(2)));
        volume.addView(seek, matchWrap(0));
        consoleContent.addView(volume, matchWrap(0));
    }

    private JSONObject preferredMedia(JSONArray media) {
        if (media == null) return null;
        String selected = preferences.getString(MEDIA_TARGET, "");
        JSONObject fallback = null;
        for (int index = 0; index < media.length(); index++) {
            JSONObject item = media.optJSONObject(index);
            if (item == null) continue;
            if (fallback == null) fallback = item;
            if (!selected.isEmpty() && selected.equals(item.optString("id", ""))) return item;
        }
        for (int index = 0; index < media.length(); index++) {
            JSONObject item = media.optJSONObject(index);
            if (item != null && "playing".equalsIgnoreCase(item.optString("status", ""))) return item;
        }
        return fallback;
    }

    private void addMediaSourceList(JSONArray media) {
        if (media == null || media.length() == 0) {
            consoleContent.addView(emptyState("NO ACTIVE MEDIA SOURCES"), matchWrap(dp(5)));
            return;
        }
        String selected = preferredMedia(media) == null ? "" : preferredMedia(media).optString("id", "");
        for (int index = 0; index < media.length(); index++) {
            JSONObject item = media.optJSONObject(index);
            if (item == null) continue;
            String id = item.optString("id", "");
            boolean active = id.equals(selected);
            String title = (active ? "✓ " : "") + String.format("%02d · %s · %s", index + 1, item.optString("name", "MEDIA"), item.optString("status", "READY"));
            Button source = button(title, active ? ORANGE : DIM_PANEL);
            source.setTextColor(active ? BLACK : Color.LTGRAY);
            source.setOnClickListener(ignored -> {
                preferences.edit().putString(MEDIA_TARGET, id).apply();
                renderConsole();
                if (consoleMessage != null) consoleMessage.setText("MEDIA TARGET SELECTED · " + item.optString("name", "MEDIA"));
            });
            consoleContent.addView(source, matchWrap(dp(3)));
        }
    }

    private JSONObject mediaRequest(String player, String command) {
        JSONObject request = new JSONObject();
        try {
            request.put("player", player);
            request.put("command", command);
        } catch (Exception ignored) {}
        return request;
    }

    private void renderCommand(JSONObject state, JSONObject capabilities, String role) {
        consoleContent.addView(sectionHeader("ROLE-GUARDED CONTROL", "COMMAND DECK", role), matchWrap(dp(5)));
        String[][] pages = {{"STATUS","overview"},{"SYSTEMS","system"},{"MEDIA","media"},{"NETWORK","network"},{"UPDATES","updates"},{"SETTINGS","settings"}};
        LinearLayout grid = column(BLACK);
        for (int index = 0; index < pages.length; index += 2) {
            LinearLayout pageRow = row(BLACK);
            pageRow.addView(actionButton(pages[index][0], "navigate", pages[index][1], capabilities.optBoolean("navigate"), index % 4 == 0 ? VIOLET : BLUE), weightedHeight(1, dp(48), dp(3)));
            pageRow.addView(actionButton(pages[index + 1][0], "navigate", pages[index + 1][1], capabilities.optBoolean("navigate"), index % 4 == 0 ? BLUE : VIOLET), weightedHeight(1, dp(48), 0));
            grid.addView(pageRow, matchWrap(dp(3)));
        }
        boolean nextDnd = !state.optBoolean("doNotDisturb", false);
        grid.addView(actionButton(nextDnd ? "ENABLE DO NOT DISTURB" : "DISABLE DO NOT DISTURB", "dnd", nextDnd, capabilities.optBoolean("dnd"), PINK), matchWrap(dp(6)));
        consoleContent.addView(grid, matchWrap(dp(2)));
        consoleContent.addView(subhead("OPERATIONS ROUTINES", capabilities.optBoolean("routine") ? "COMMAND READY" : "COMMAND ROLE REQUIRED"), matchWrap(dp(3)));
        addCommandList(state.optJSONArray("routines"), "routine", capabilities.optBoolean("routine"), "NO ROUTINES SHARED");
        consoleContent.addView(subhead("APPLICATIONS", capabilities.optBoolean("app") ? "COMMAND READY" : "COMMAND ROLE REQUIRED"), matchWrap(dp(3)));
        addCommandList(state.optJSONArray("apps"), "app", capabilities.optBoolean("app"), "NO APPLICATIONS SHARED");
        consoleContent.addView(subhead("CONNECTED WORKSTATIONS", capabilities.optBoolean("workstation") ? "APPROVAL-GUARDED" : "COMMAND ROLE REQUIRED"), matchWrap(dp(3)));
        addCommandList(state.optJSONArray("workstations"), "workstation", capabilities.optBoolean("workstation"), "NO WORKSTATIONS SHARED");
        consoleContent.addView(subhead("QUICK ACTIONS", capabilities.optBoolean("quick") ? "READY" : "OPERATOR ROLE REQUIRED"), matchWrap(dp(3)));
        addCommandList(state.optJSONArray("quickActions"), "quick", capabilities.optBoolean("quick"), "NO QUICK ACTIONS SHARED");
        JSONObject handoff = state.optJSONObject("handoff");
        if (handoff != null) consoleContent.addView(actionButton("HAND OFF " + handoff.optString("title", "ACTIVE CONSOLE"), "handoff", handoff.optString("page", "overview"), capabilities.optBoolean("handoff"), ORANGE), matchWrap(dp(5)));
        Button forget = button("FORGET THIS STATION", PINK);
        forget.setOnClickListener(ignored -> {
            forgetToken();
            showSetup("THIS PADD FORGOT ITS TOKEN · REVOKE THE OLD DEVICE IN DESKTOP SETTINGS IF NEEDED");
        });
        consoleContent.addView(forget, matchWrap(0));
    }

    private void renderMore(JSONObject state, JSONObject capabilities, String role, JSONObject device) {
        consoleContent.addView(sectionHeader("PERSONAL PADD", "LAYOUT + TOOLS", role), matchWrap(dp(5)));
        JSONArray selected = state.optJSONArray("widgets");
        String[][] choices = {{"status","STATION STATUS"},{"media","NOW PLAYING"},{"communications","COMMUNICATIONS"},{"telemetry","TELEMETRY"},{"quick-actions","QUICK ACTIONS"}};
        LinearLayout widgetPanel = panel(VIOLET);
        widgetPanel.addView(fieldLabel("PADD WIDGETS"), matchWrap(dp(5)));
        for (String[] choice : choices) {
            boolean enabled = contains(selected, choice[0]);
            Button toggle = button((enabled ? "✓ " : "+ ") + choice[1], enabled ? BLUE : DIM_PANEL);
            toggle.setTextColor(enabled ? BLACK : Color.LTGRAY);
            toggle.setOnClickListener(ignored -> saveWidgetPreference(selected, choice[0], !enabled));
            widgetPanel.addView(toggle, matchWrap(dp(3)));
        }
        consoleContent.addView(widgetPanel, matchWrap(dp(5)));
        LinearLayout clipboard = panel(PINK);
        clipboard.addView(fieldLabel("OPT-IN TEXT CLIPBOARD"), matchWrap(dp(4)));
        EditText text = input("TEXT TO REQUEST ON THE DESKTOP", "", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        text.setSingleLine(false);text.setMaxLines(4);
        Button transmit = actionButton("REQUEST DESKTOP CLIPBOARD", "clipboard", "", capabilities.optBoolean("clipboard"), PINK);
        transmit.setOnClickListener(ignored -> sendAction("clipboard", text.getText().toString()));
        clipboard.addView(text, matchWrap(dp(5)));clipboard.addView(transmit, matchWrap(0));
        consoleContent.addView(clipboard, matchWrap(dp(5)));
        JSONObject release = state.optJSONObject("release");
        LinearLayout releasePanel = panel(BLUE);
        releasePanel.addView(fieldLabel("RELEASE MATRIX"), matchWrap(dp(4)));
        releasePanel.addView(label("STABLE · " + (release == null ? "UNKNOWN" : release.optString("stable", "UNKNOWN")), Color.WHITE, 17, true), matchWrap(dp(3)));
        releasePanel.addView(label("DEVELOPMENT · " + (release == null ? "UNKNOWN" : release.optString("development", "UNKNOWN")), PEACH, 17, true), matchWrap(dp(3)));
        releasePanel.addView(label("CLIENT · VERSION 28 STABLE", Color.LTGRAY, 11, true), matchWrap(0));
        consoleContent.addView(releasePanel, matchWrap(dp(5)));
        if (device != null) {
            String diagnostics = device.optString("network", "NETWORK UNKNOWN").toUpperCase() + " · " + device.optInt("latencyMs", 0) + " MS · " + device.optInt("battery", -1) + "% BATTERY";
            consoleContent.addView(subhead("LINK DIAGNOSTICS", diagnostics), matchWrap(dp(5)));
        }
        String compatibility = latest == null ? "unknown" : latest.optString("compatibility", "unknown");
        String stationVersion = latest == null ? "unknown" : latest.optString("stationVersion", "unknown");
        LinearLayout recovery = panel(compatibility.equals("compatible") ? BLUE : PINK);
        recovery.addView(fieldLabel("CONNECTION RECOVERY"), matchWrap(dp(4)));
        recovery.addView(label(compatibility.equals("compatible") ? "CLIENT AND STATION VERSIONS ALIGNED" : "VERSION ATTENTION · " + compatibility.replace('-', ' ').toUpperCase(), compatibility.equals("compatible") ? BLUE : PINK, 13, true), matchWrap(dp(3)));
        recovery.addView(label("STATION " + stationVersion.toUpperCase() + " · CLIENT VERSION 28", Color.LTGRAY, 10, true), matchWrap(dp(7)));
        LinearLayout recoveryActions = row(PANEL);
        Button retry = button("RETRY LINK", BLUE);
        retry.setOnClickListener(ignored -> refreshState(true));
        Button repair = button("PAIR AGAIN", VIOLET);
        repair.setOnClickListener(ignored -> showSetup("REPAIR MODE · ARM A NEW ONE-USE CODE ON THE DESKTOP"));
        recoveryActions.addView(retry, weightedHeight(1, dp(44), dp(3)));
        recoveryActions.addView(repair, weightedHeight(1, dp(44), 0));
        recovery.addView(recoveryActions, matchWrap(0));
        consoleContent.addView(recovery, matchWrap(dp(5)));
    }

    private boolean contains(JSONArray values, String target) {
        if (values == null) return false;
        for (int index = 0; index < values.length(); index++) if (target.equals(values.optString(index))) return true;
        return false;
    }

    private void saveWidgetPreference(JSONArray current, String id, boolean enabled) {
        JSONArray next = new JSONArray();
        if (current != null) for (int index = 0; index < current.length(); index++) {
            String value = current.optString(index);
            if (!value.equals(id)) next.put(value);
        }
        if (enabled) next.put(id);
        JSONObject body = new JSONObject();
        try { body.put("widgets", next); } catch (Exception ignored) {}
        network.execute(() -> {
            try { request("POST", "api/padd/preferences", body, token); runOnUiThread(() -> refreshState(true)); }
            catch (Exception error) { runOnUiThread(() -> { if (consoleMessage != null) consoleMessage.setText("LAYOUT SAVE FAILED · " + error.getMessage()); }); }
        });
    }

    private void addReadOnlyList(JSONArray items, String empty) {
        if (items == null || items.length() == 0) {
            consoleContent.addView(emptyState(empty), matchWrap(dp(5)));
            return;
        }
        for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index);
            if (item == null) continue;
            consoleContent.addView(listRow(index, item.optString("name", item.optString("title", item.optString("text", "LCARS SIGNAL"))), item.optString("detail", item.optString("status", ""))), matchWrap(dp(3)));
        }
    }

    private void addCommandList(JSONArray items, String action, boolean enabled, String empty) {
        if (items == null || items.length() == 0) {
            consoleContent.addView(emptyState(empty), matchWrap(dp(5)));
            return;
        }
        for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index);
            if (item == null) continue;
            String name = item.optString("name", item.optString("title", "LCARS COMMAND"));
            Button command = actionButton(String.format("%02d · %s", index + 1, name), action, item.optString("id", ""), enabled, index % 2 == 0 ? VIOLET : BLUE);
            consoleContent.addView(command, matchWrap(dp(3)));
        }
    }

    private Button actionButton(String title, String action, Object value, boolean enabled, int color) {
        Button button = button(title, color);
        button.setEnabled(enabled);
        button.setAlpha(enabled ? 1f : .38f);
        button.setOnClickListener(ignored -> sendAction(action, value));
        return button;
    }

    private void sendAction(String action, Object value) {
        if (!consoleActive) return;
        if (consoleMessage != null) consoleMessage.setText("TRANSMITTING " + action.toUpperCase() + "…");
        vibrate(45);
        JSONObject body = new JSONObject();
        try {
            body.put("action", action);
            body.put("value", value);
        } catch (Exception ignored) {}
        network.execute(() -> {
            try {
                JSONObject result = request("POST", "api/padd/action", body, token);
                runOnUiThread(() -> {
                    if (consoleMessage != null) consoleMessage.setText(result.optString("message", "COMMAND TRANSMITTED"));
                    poller.postDelayed(() -> refreshState(false), 350);
                });
            } catch (Exception error) {
                runOnUiThread(() -> { if (consoleMessage != null) consoleMessage.setText("COMMAND REJECTED · " + error.getMessage()); });
            }
        });
    }

    private JSONObject request(String method, String path, JSONObject body, String bearer) throws Exception {
        URL url = new URL(stationRoot + path);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(6000);
        connection.setReadTimeout(8000);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Accept", "application/json");
        if (bearer != null && !bearer.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + bearer);
        if (body != null) {
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setFixedLengthStreamingMode(bytes.length);
            connection.getOutputStream().write(bytes);
        }
        int status = connection.getResponseCode();
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        StringBuilder text = new StringBuilder();
        if (stream != null) {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                for (String line; (line = reader.readLine()) != null;) text.append(line);
            }
        }
        connection.disconnect();
        JSONObject result = text.length() == 0 ? new JSONObject() : new JSONObject(text.toString());
        if (status >= 400 || (result.has("ok") && !result.optBoolean("ok"))) {
            throw new IOException(result.optString("error", "LCARS station rejected the request"));
        }
        return result;
    }

    private LinearLayout masthead(String eyebrow, String badgeText) {
        LinearLayout header = row(BLACK);
        TextView index = label("28", BLACK, 12, true);
        index.setGravity(Gravity.CENTER);
        index.setBackground(shape(ORANGE, 28, 3, 3, 28));
        LinearLayout titles = column(PANEL);
        titles.setPadding(dp(12), dp(7), dp(8), dp(7));
        titles.setBackground(shape(PANEL, 3, 3, 3, 3));
        titles.addView(label(eyebrow, PEACH, 10, true), matchWrap(dp(1)));
        titles.addView(fittedLabel("PADD COMPANION", Color.WHITE, 14, 21, true), matchWrap(0));
        TextView badge = label(badgeText, BLACK, 11, true);
        badge.setBackground(shape(ORANGE, 3, 28, 28, 3));
        badge.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams indexParams = new LinearLayout.LayoutParams(dp(42), dp(64));
        indexParams.rightMargin = dp(3);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, dp(64), 1);
        titleParams.rightMargin = dp(3);
        header.addView(index, indexParams);
        header.addView(titles, titleParams);
        header.addView(badge, new LinearLayout.LayoutParams(dp(82), dp(64)));
        return header;
    }

    private LinearLayout sectionHeader(String eyebrow, String title, String badgeText) {
        LinearLayout header = row(BLACK);
        View rail = new View(this);
        rail.setBackground(shape(ORANGE, 18, 3, 3, 18));
        LinearLayout text = column(PANEL);
        text.setPadding(dp(11), dp(7), dp(8), dp(7));
        text.setBackground(shape(PANEL, 3, 3, 3, 3));
        text.addView(label(eyebrow, PEACH, 9, true), matchWrap(0));
        text.addView(fittedLabel(title, Color.WHITE, 13, 21, true), matchWrap(0));
        TextView badge = label(badgeText, BLUE, 11, true);
        badge.setBackground(shape(PANEL, 3, 20, 20, 3));
        badge.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams railParams = new LinearLayout.LayoutParams(dp(18), dp(58));
        railParams.rightMargin = dp(3);
        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(0, dp(58), 1);
        textParams.rightMargin = dp(3);
        header.addView(rail, railParams);
        header.addView(text, textParams);
        header.addView(badge, new LinearLayout.LayoutParams(dp(88), dp(58)));
        return header;
    }

    private LinearLayout subhead(String title, String detail) {
        LinearLayout header = row(PANEL);
        header.setPadding(dp(10), dp(8), dp(10), dp(8));
        header.setBackground(shape(PANEL, 18, 3, 3, 18));
        header.addView(label(title, Color.WHITE, 14, true), new LinearLayout.LayoutParams(0, dp(38), 1));
        TextView value = label(detail, PEACH, 9, true);
        value.setGravity(Gravity.CENTER_VERTICAL | Gravity.RIGHT);
        header.addView(value, new LinearLayout.LayoutParams(0, dp(38), 1));
        return header;
    }

    private LinearLayout step(String number, String title, String detail) {
        LinearLayout item = column(PANEL);
        item.setPadding(dp(8), dp(8), dp(8), dp(8));
        item.setBackground(shape(PANEL, 18, 3, 18, 18));
        item.addView(label(number, ORANGE, 17, true), matchWrap(dp(2)));
        item.addView(label(title, Color.WHITE, 12, true), matchWrap(dp(2)));
        item.addView(label(detail, Color.GRAY, 9, false), matchWrap(0));
        return item;
    }

    private LinearLayout panel(int accent) {
        LinearLayout layout = column(PANEL);
        layout.setPadding(dp(12), dp(12), dp(12), dp(12));
        layout.setBackground(shape(PANEL, 22, 3, 22, 22));
        TextView bar = new TextView(this);
        bar.setBackgroundColor(accent);
        LinearLayout.LayoutParams barParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(6));
        barParams.bottomMargin = dp(8);
        layout.addView(bar, barParams);
        return layout;
    }

    private LinearLayout statusCard(String title, String value, int accent) {
        LinearLayout card = column(PANEL);
        card.setPadding(dp(10), dp(10), dp(10), dp(10));
        card.setBackground(shape(PANEL, 18, 3, 18, 18));
        card.addView(label(title, PEACH, 9, true), matchWrap(dp(3)));
        card.addView(fittedLabel(value, Color.WHITE, 11, 18, true), matchWrap(dp(6)));
        TextView bar = new TextView(this);
        bar.setBackgroundColor(accent);
        card.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(6)));
        return card;
    }

    private LinearLayout meter(String title, int value) {
        int safeValue = Math.max(0, Math.min(100, value));
        LinearLayout outer = column(PANEL);
        outer.setPadding(dp(10), dp(7), dp(10), dp(7));
        outer.setBackground(shape(PANEL, 16, 3, 16, 16));
        LinearLayout top = row(PANEL);
        top.addView(label(title.toUpperCase(), Color.LTGRAY, 11, true), new LinearLayout.LayoutParams(0, dp(28), 1));
        TextView reading = label(safeValue + "%", PEACH, 12, true);
        reading.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        top.addView(reading, new LinearLayout.LayoutParams(dp(62), dp(28)));
        outer.addView(top, matchWrap(dp(3)));
        LinearLayout track = row(DIM_PANEL);
        TextView fill = new TextView(this);
        fill.setBackgroundColor(BLUE);
        track.addView(fill, new LinearLayout.LayoutParams(0, dp(8), Math.max(1, safeValue)));
        track.addView(new View(this), new LinearLayout.LayoutParams(0, dp(8), Math.max(1, 100 - safeValue)));
        outer.addView(track, matchWrap(0));
        return outer;
    }

    private LinearLayout listRow(int index, String title, String detail) {
        LinearLayout itemRow = row(PANEL);
        itemRow.setBackground(shape(PANEL, 18, 3, 18, 18));
        TextView number = label(String.format("%02d", index + 1), BLACK, 12, true);
        number.setBackgroundColor(index % 2 == 0 ? ORANGE : BLUE);
        number.setGravity(Gravity.CENTER);
        LinearLayout text = column(PANEL);
        text.setPadding(dp(9), dp(6), dp(9), dp(6));
        text.addView(label(title, Color.WHITE, 14, true), matchWrap(dp(2)));
        text.addView(label(detail, Color.GRAY, 10, false), matchWrap(0));
        itemRow.addView(number, new LinearLayout.LayoutParams(dp(42), dp(52)));
        itemRow.addView(text, new LinearLayout.LayoutParams(0, dp(52), 1));
        return itemRow;
    }

    private TextView emptyState(String text) {
        TextView empty = label(text, Color.GRAY, 11, true);
        empty.setPadding(dp(12), dp(16), dp(12), dp(16));
        empty.setBackground(shape(PANEL, 18, 3, 18, 18));
        return empty;
    }

    private EditText input(String hint, String value, int inputType) {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setHint(hint);
        input.setText(value);
        input.setTextColor(Color.WHITE);
        input.setHintTextColor(Color.GRAY);
        input.setTextSize(17);
        input.setInputType(inputType);
        input.setPadding(dp(12), dp(9), dp(12), dp(9));
        GradientDrawable background = shape(DIM_PANEL, 18, 3, 18, 18);
        background.setStroke(dp(1), ORANGE);
        input.setBackground(background);
        return input;
    }

    private TextView fieldLabel(String text) { return label(text, PEACH, 10, true); }

    private TextView label(String text, int color, int size, boolean bold) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(color);
        view.setTextSize(size * remoteFontScale);
        view.setTypeface(Typeface.create("sans-serif-condensed", bold ? Typeface.BOLD : Typeface.NORMAL));
        view.setGravity(Gravity.CENTER_VERTICAL);
        return view;
    }

    private TextView fittedLabel(String text, int color, int minimumSize, int maximumSize, boolean bold) {
        TextView view = label(text, color, maximumSize, bold);
        view.setSingleLine(true);
        view.setEllipsize(TextUtils.TruncateAt.END);
        if (Build.VERSION.SDK_INT >= 26) {
            int minimum = Math.max(8, Math.round(minimumSize * remoteFontScale));
            int maximum = Math.max(minimum, Math.round(maximumSize * remoteFontScale));
            view.setAutoSizeTextTypeUniformWithConfiguration(minimum, maximum, 1, TypedValue.COMPLEX_UNIT_SP);
        }
        return view;
    }

    private Button button(String text, int color) {
        Button view = new Button(this);
        view.setText(text);
        view.setTextColor(BLACK);
        view.setTextSize(13);
        view.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
        view.setBackground(shape(color, 22, 3, 22, 22));
        view.setGravity(Gravity.CENTER);
        view.setMinHeight(dp(44));
        view.setPadding(dp(10), dp(6), dp(10), dp(6));
        view.setElevation(0);
        view.setStateListAnimator(null);
        view.setLetterSpacing(.025f);
        view.setAllCaps(false);
        return view;
    }

    private LinearLayout column(int color) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(color);
        return layout;
    }

    private LinearLayout row(int color) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setBackgroundColor(color);
        return layout;
    }

    private void setScrollableContent(LinearLayout page) {
        page.setPadding(dp(10), dp(14), dp(10), dp(18));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(page, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setInsetAwareContent(scroll, 0, 0, 0, 8);
    }

    private void setInsetAwareContent(View content, int left, int top, int right, int bottom) {
        final int baseLeft = dp(left);
        final int baseTop = dp(top);
        final int baseRight = dp(right);
        final int baseBottom = dp(bottom);
        content.setBackgroundColor(BLACK);
        content.setPadding(baseLeft, baseTop, baseRight, baseBottom);
        content.setOnApplyWindowInsetsListener((view, insets) -> {
            int insetLeft;
            int insetTop;
            int insetRight;
            int insetBottom;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                insetLeft = bars.left;
                insetTop = bars.top;
                insetRight = bars.right;
                insetBottom = bars.bottom;
            } else {
                insetLeft = insets.getSystemWindowInsetLeft();
                insetTop = insets.getSystemWindowInsetTop();
                insetRight = insets.getSystemWindowInsetRight();
                insetBottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(baseLeft + insetLeft, baseTop + insetTop, baseRight + insetRight, baseBottom + insetBottom);
            return insets;
        });
        setContentView(content);
        content.requestApplyInsets();
    }

    private GradientDrawable shape(int color, int topLeft, int topRight, int bottomRight, int bottomLeft) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadii(new float[]{
            dp(topLeft), dp(topLeft), dp(topRight), dp(topRight),
            dp(bottomRight), dp(bottomRight), dp(bottomLeft), dp(bottomLeft)
        });
        return drawable;
    }

    private void forgetToken() {
        token = "";
        preferences.edit().remove(TOKEN).apply();
    }

    private int count(JSONArray values) { return values == null ? 0 : values.length(); }

    private LinearLayout.LayoutParams matchWrap(int bottomMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = bottomMargin;
        return params;
    }

    private LinearLayout.LayoutParams weightedWrap(float weight, int rightMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, weight);
        params.rightMargin = rightMargin;
        return params;
    }

    private LinearLayout.LayoutParams weightedHeight(float weight, int height, int rightMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, height, weight);
        params.rightMargin = rightMargin;
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onBackPressed() {
        if (consoleActive) {
            showSetup("");
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        consoleActive = false;
        poller.removeCallbacks(poll);
        network.shutdownNow();
        super.onDestroy();
    }
}
