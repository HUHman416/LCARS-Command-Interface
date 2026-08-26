package com.lcars.padd;

import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

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
    private static final int LOCAL_NETWORK_REQUEST = 271;
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
        requestLocalNetworkAccess();
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

    private void showSetup(String alert) {
        consoleActive = false;
        latest = null;
        poller.removeCallbacks(poll);
        LinearLayout page = column(BLACK);
        page.setPadding(dp(10), dp(14), dp(10), dp(18));
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
        consoleActive = true;
        poller.removeCallbacks(poll);
        LinearLayout shell = column(BLACK);
        shell.setPadding(dp(8), dp(10), dp(8), dp(10));
        LinearLayout header = masthead("LCARS 27.2", "LINK");
        linkBadge = (TextView) header.getChildAt(1);
        shell.addView(header, matchWrap(dp(5)));

        LinearLayout tabs = row(BLACK);
        tabs.addView(tabButton("STATUS", "status"), weightedWrap(1, dp(3)));
        tabs.addView(tabButton("MEDIA", "media"), weightedWrap(1, dp(3)));
        tabs.addView(tabButton("COMMAND", "command"), weightedWrap(1, 0));
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
        setContentView(shell);
        refreshState(true);
        poller.postDelayed(poll, 2500);
    }

    private Button tabButton(String title, String tab) {
        Button button = button(title, activeTab.equals(tab) ? ORANGE : DIM_PANEL);
        button.setTextColor(activeTab.equals(tab) ? BLACK : Color.LTGRAY);
        button.setOnClickListener(ignored -> {
            activeTab = tab;
            showConsole();
        });
        return button;
    }

    private void refreshState(boolean announce) {
        if (!consoleActive) return;
        if (announce && consoleMessage != null) consoleMessage.setText("REFRESHING LOCAL LINK…");
        network.execute(() -> {
            try {
                JSONObject result = request("GET", "api/padd/state", null, token);
                latest = result;
                runOnUiThread(() -> {
                    if (!consoleActive) return;
                    if (linkBadge != null) {
                        linkBadge.setText("ONLINE");
                        linkBadge.setBackgroundColor(ORANGE);
                    }
                    if (consoleMessage != null) consoleMessage.setText(announce ? "STATION STATE SYNCHRONIZED" : "");
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
                        linkBadge.setText("OFFLINE");
                        linkBadge.setBackgroundColor(PINK);
                    }
                    if (consoleMessage != null) consoleMessage.setText("LINK STANDBY · " + error.getMessage());
                });
            }
        });
    }

    private void renderConsole() {
        if (consoleContent == null || latest == null) return;
        consoleContent.removeAllViews();
        JSONObject state = latest.optJSONObject("state");
        JSONObject device = latest.optJSONObject("device");
        JSONObject capabilities = latest.optJSONObject("capabilities");
        if (state == null) state = new JSONObject();
        if (capabilities == null) capabilities = new JSONObject();
        String role = device == null ? "PAIRED" : device.optString("role", "operator").toUpperCase();
        if (activeTab.equals("media")) renderMedia(state, capabilities, role);
        else if (activeTab.equals("command")) renderCommand(state, capabilities, role);
        else renderStatus(state, role);
    }

    private void renderStatus(JSONObject state, String role) {
        consoleContent.addView(sectionHeader("CONNECTED STATION", "STATUS", role), matchWrap(dp(5)));
        LinearLayout cards = row(BLACK);
        cards.addView(statusCard("ACTIVE PAGE", state.optString("page", "overview").toUpperCase(), ORANGE), weightedWrap(1, dp(3)));
        cards.addView(statusCard("MASTER AUDIO", state.optInt("volume", 0) + "%", BLUE), weightedWrap(1, 0));
        consoleContent.addView(cards, matchWrap(dp(5)));
        JSONArray meters = state.optJSONArray("meters");
        if (meters != null) {
            for (int index = 0; index < meters.length(); index++) {
                JSONObject item = meters.optJSONObject(index);
                if (item == null) continue;
                consoleContent.addView(meter(item.optString("label", item.optString("name", "SYSTEM")), item.optInt("value", 0)), matchWrap(dp(3)));
            }
        }
        consoleContent.addView(subhead("COMMUNICATIONS", count(state.optJSONArray("notices")) + " SIGNALS"), matchWrap(dp(3)));
        addReadOnlyList(state.optJSONArray("notices"), "NO PRIORITY SIGNALS");
    }

    private void renderMedia(JSONObject state, JSONObject capabilities, String role) {
        consoleContent.addView(sectionHeader("REMOTE AUDIO BUS", "MEDIA CONTROL", role), matchWrap(dp(5)));
        addReadOnlyList(state.optJSONArray("media"), "NO ACTIVE MEDIA SOURCES");
        LinearLayout transport = row(BLACK);
        transport.addView(actionButton("|◀", "media", "previous", capabilities.optBoolean("media"), BLUE), weightedHeight(1, dp(52), dp(3)));
        transport.addView(actionButton("▶ / Ⅱ", "media", "play-pause", capabilities.optBoolean("media"), ORANGE), weightedHeight(1, dp(52), dp(3)));
        transport.addView(actionButton("▶|", "media", "next", capabilities.optBoolean("media"), BLUE), weightedHeight(1, dp(52), 0));
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
        Button forget = button("FORGET THIS STATION", PINK);
        forget.setOnClickListener(ignored -> {
            forgetToken();
            showSetup("THIS PADD FORGOT ITS TOKEN · REVOKE THE OLD DEVICE IN DESKTOP SETTINGS IF NEEDED");
        });
        consoleContent.addView(forget, matchWrap(0));
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
        button.setOnClickListener(ignored -> sendAction(action, value));
        return button;
    }

    private void sendAction(String action, Object value) {
        if (!consoleActive) return;
        if (consoleMessage != null) consoleMessage.setText("TRANSMITTING " + action.toUpperCase() + "…");
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
        LinearLayout header = row(PANEL);
        header.setPadding(dp(16), dp(10), dp(8), dp(10));
        LinearLayout titles = column(PANEL);
        titles.addView(label(eyebrow, PEACH, 10, true), matchWrap(dp(1)));
        titles.addView(label("PADD COMPANION", Color.WHITE, 25, true), matchWrap(0));
        TextView badge = label(badgeText, BLACK, 11, true);
        badge.setBackgroundColor(ORANGE);
        badge.setGravity(Gravity.CENTER);
        header.addView(titles, new LinearLayout.LayoutParams(0, dp(64), 1));
        header.addView(badge, new LinearLayout.LayoutParams(dp(98), dp(64)));
        return header;
    }

    private LinearLayout sectionHeader(String eyebrow, String title, String badgeText) {
        LinearLayout header = row(PANEL);
        header.setPadding(dp(12), dp(8), dp(8), dp(8));
        LinearLayout text = column(PANEL);
        text.addView(label(eyebrow, PEACH, 9, true), matchWrap(0));
        text.addView(label(title, Color.WHITE, 23, true), matchWrap(0));
        TextView badge = label(badgeText, BLUE, 11, true);
        badge.setGravity(Gravity.CENTER);
        header.addView(text, new LinearLayout.LayoutParams(0, dp(58), 1));
        header.addView(badge, new LinearLayout.LayoutParams(dp(98), dp(58)));
        return header;
    }

    private LinearLayout subhead(String title, String detail) {
        LinearLayout header = row(PANEL);
        header.setPadding(dp(10), dp(8), dp(10), dp(8));
        header.addView(label(title, Color.WHITE, 14, true), new LinearLayout.LayoutParams(0, dp(38), 1));
        TextView value = label(detail, PEACH, 9, true);
        value.setGravity(Gravity.CENTER_VERTICAL | Gravity.RIGHT);
        header.addView(value, new LinearLayout.LayoutParams(0, dp(38), 1));
        return header;
    }

    private LinearLayout step(String number, String title, String detail) {
        LinearLayout item = column(PANEL);
        item.setPadding(dp(8), dp(8), dp(8), dp(8));
        item.addView(label(number, ORANGE, 17, true), matchWrap(dp(2)));
        item.addView(label(title, Color.WHITE, 12, true), matchWrap(dp(2)));
        item.addView(label(detail, Color.GRAY, 9, false), matchWrap(0));
        return item;
    }

    private LinearLayout panel(int accent) {
        LinearLayout layout = column(PANEL);
        layout.setPadding(dp(18), dp(18), dp(18), dp(18));
        TextView bar = new TextView(this);
        bar.setBackgroundColor(accent);
        layout.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(7)));
        return layout;
    }

    private LinearLayout statusCard(String title, String value, int accent) {
        LinearLayout card = column(PANEL);
        card.setPadding(dp(10), dp(10), dp(10), dp(10));
        card.addView(label(title, PEACH, 9, true), matchWrap(dp(3)));
        card.addView(label(value, Color.WHITE, 18, true), matchWrap(dp(6)));
        TextView bar = new TextView(this);
        bar.setBackgroundColor(accent);
        card.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(6)));
        return card;
    }

    private LinearLayout meter(String title, int value) {
        int safeValue = Math.max(0, Math.min(100, value));
        LinearLayout outer = column(PANEL);
        outer.setPadding(dp(10), dp(7), dp(10), dp(7));
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
        empty.setBackgroundColor(PANEL);
        empty.setPadding(dp(12), dp(16), dp(12), dp(16));
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
        input.setBackgroundColor(BLACK);
        return input;
    }

    private TextView fieldLabel(String text) { return label(text, PEACH, 10, true); }

    private TextView label(String text, int color, int size, boolean bold) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(color);
        view.setTextSize(size);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setGravity(Gravity.CENTER_VERTICAL);
        return view;
    }

    private Button button(String text, int color) {
        Button view = new Button(this);
        view.setText(text);
        view.setTextColor(BLACK);
        view.setTextSize(12);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setBackgroundColor(color);
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
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(page, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(scroll);
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
