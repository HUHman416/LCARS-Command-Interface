package com.lcars.padd;

import android.app.Activity;
import android.app.role.RoleManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.LauncherActivityInfo;
import android.content.pm.LauncherApps;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.StatFs;
import android.os.UserHandle;
import android.os.UserManager;
import android.provider.Settings;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.text.Collator;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Optional Version 29 Home surface. Pairing and privileged desktop controls remain in MainActivity. */
public final class HomeActivity extends Activity {
    private static final String HOME_PREFS = "lcars-home-v29";
    private static final String FAVORITES = "favorite-components";
    private static final String PADD_PREFS = "lcars-padd";
    private static final int HOME_ROLE_REQUEST = 291;
    private static final int BLACK = Color.rgb(0, 0, 0);
    private static final int PANEL = Color.rgb(18, 16, 22);
    private static final int DIM = Color.rgb(40, 35, 46);
    private static final int ORANGE = Color.rgb(255, 152, 104);
    private static final int PEACH = Color.rgb(244, 182, 107);
    private static final int PINK = Color.rgb(233, 155, 197);
    private static final int BLUE = Color.rgb(130, 154, 241);
    private static final int VIOLET = Color.rgb(182, 157, 232);

    private final Handler clockHandler = new Handler(Looper.getMainLooper());
    private final ArrayList<LaunchEntry> allApps = new ArrayList<>();
    private SharedPreferences preferences;
    private LauncherApps launcherApps;
    private UserManager userManager;
    private GridLayout favoriteGrid;
    private GridLayout applicationGrid;
    private TextView favoriteSummary;
    private TextView applicationSummary;
    private TextView clock;
    private TextView homeState;
    private LinearLayout statusDeck;
    private EditText search;

    private final Runnable updateClock = new Runnable() {
        @Override public void run() {
            if (clock != null) clock.setText(new SimpleDateFormat("h:mm a", Locale.getDefault()).format(System.currentTimeMillis()).toUpperCase(Locale.ROOT));
            clockHandler.postDelayed(this, 30000);
        }
    };

    private final LauncherApps.Callback packageCallback = new LauncherApps.Callback() {
        @Override public void onPackageRemoved(String packageName, UserHandle user) { reloadApps(); }
        @Override public void onPackageAdded(String packageName, UserHandle user) { reloadApps(); }
        @Override public void onPackageChanged(String packageName, UserHandle user) { reloadApps(); }
        @Override public void onPackagesAvailable(String[] packageNames, UserHandle user, boolean replacing) { reloadApps(); }
        @Override public void onPackagesUnavailable(String[] packageNames, UserHandle user, boolean replacing) { reloadApps(); }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BLACK);
        getWindow().setNavigationBarColor(BLACK);
        if (Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);
        preferences = getSharedPreferences(HOME_PREFS, MODE_PRIVATE);
        launcherApps = (LauncherApps) getSystemService(Context.LAUNCHER_APPS_SERVICE);
        userManager = (UserManager) getSystemService(Context.USER_SERVICE);
        buildHome();
        if (launcherApps != null) launcherApps.registerCallback(packageCallback, new Handler(Looper.getMainLooper()));
        reloadApps();
    }

    @Override protected void onResume() {
        super.onResume();
        refreshHomeState();
        renderStatusDeck();
        reloadApps();
        clockHandler.removeCallbacks(updateClock);
        clockHandler.post(updateClock);
    }

    @Override protected void onPause() {
        clockHandler.removeCallbacks(updateClock);
        super.onPause();
    }

    @Override protected void onDestroy() {
        if (launcherApps != null) launcherApps.unregisterCallback(packageCallback);
        clockHandler.removeCallbacks(updateClock);
        super.onDestroy();
    }

    private void buildHome() {
        LinearLayout root = column(BLACK);
        root.setPadding(dp(10), dp(10), dp(10), dp(10));
        root.addView(buildMasthead(), matchWrap(dp(6)));
        root.addView(buildModeControls(), matchWrap(dp(6)));

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout content = column(BLACK);
        statusDeck = column(BLACK);
        content.addView(statusDeck, matchWrap(dp(7)));

        LinearLayout searchDeck = panel(BLUE);
        searchDeck.addView(label("UNIVERSAL APPLICATION SEARCH", PEACH, 11, true), matchWrap(dp(4)));
        search = input("SEARCH INSTALLED APPLICATIONS…");
        search.setSingleLine(true);
        search.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        search.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence value, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence value, int start, int before, int count) { renderApplications(); }
            @Override public void afterTextChanged(Editable value) {}
        });
        searchDeck.addView(search, matchWrap(0));
        content.addView(searchDeck, matchWrap(dp(7)));

        favoriteSummary = sectionHeader("FAVORITE APPLICATIONS", "LONG-PRESS OR USE ★ TO CHANGE");
        content.addView(favoriteSummary, matchWrap(dp(4)));
        favoriteGrid = new GridLayout(this);
        content.addView(favoriteGrid, matchWrap(dp(8)));

        applicationSummary = sectionHeader("APPLICATION LIBRARY", "LOCAL DEVICE");
        content.addView(applicationSummary, matchWrap(dp(4)));
        applicationGrid = new GridLayout(this);
        content.addView(applicationGrid, matchWrap(dp(18)));
        scroll.addView(content, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(root);
    }

    private View buildMasthead() {
        LinearLayout header = row(BLACK);
        TextView brand = label("LCARS\n29.1 DEV", BLACK, 20, true);
        brand.setGravity(Gravity.CENTER_VERTICAL);
        brand.setBackground(shape(ORANGE, 34, 3, 3, 34));
        brand.setPadding(dp(16), dp(8), dp(16), dp(8));
        header.addView(brand, weightedHeight(0.72f, dp(84), dp(5)));

        TextView title = label("MOBILE COMMAND ENVIRONMENT\nSTANDALONE HOME", Color.WHITE, 22, true);
        title.setGravity(Gravity.CENTER_VERTICAL);
        title.setBackground(shape(PANEL, 3, 3, 3, 3));
        title.setPadding(dp(14), dp(8), dp(10), dp(8));
        header.addView(title, weightedHeight(2f, dp(84), dp(5)));

        clock = label("--:--", BLACK, 18, true);
        clock.setGravity(Gravity.CENTER);
        clock.setBackground(shape(BLUE, 3, 34, 34, 3));
        header.addView(clock, weightedHeight(0.9f, dp(84), 0));
        return header;
    }

    private View buildModeControls() {
        LinearLayout controls = row(BLACK);
        Button companion = button("PADD COMPANION", VIOLET);
        companion.setOnClickListener(ignored -> startActivity(new Intent(this, MainActivity.class)));
        homeState = button("MAKE LCARS HOME", ORANGE);
        homeState.setOnClickListener(ignored -> requestHomeRole());
        Button settings = button("HOME SETTINGS", BLUE);
        settings.setOnClickListener(ignored -> openHomeSettings());
        controls.addView(companion, weightedHeight(1, dp(48), dp(4)));
        controls.addView(homeState, weightedHeight(1, dp(48), dp(4)));
        controls.addView(settings, weightedHeight(1, dp(48), 0));
        return controls;
    }

    private void renderStatusDeck() {
        if (statusDeck == null) return;
        statusDeck.removeAllViews();
        statusDeck.addView(sectionHeader("LOCAL DEVICE OPERATIONS", pairedStatus()), matchWrap(dp(4)));
        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(statusColumns());
        int battery = batteryPercent();
        addStatus(grid, "BATTERY", battery < 0 ? "UNKNOWN" : battery + "%", battery >= 30 ? BLUE : ORANGE);
        addStatus(grid, "NETWORK", networkLabel(), VIOLET);
        addStatus(grid, "STORAGE FREE", storageFree(), PINK);
        addStatus(grid, "APPLICATIONS", Integer.toString(allApps.size()), ORANGE);
        statusDeck.addView(grid, matchWrap(0));
    }

    private void addStatus(GridLayout grid, String title, String value, int color) {
        LinearLayout card = panel(color);
        card.addView(label(title, PEACH, 10, true), matchWrap(dp(4)));
        card.addView(label(value, Color.WHITE, 22, true), matchWrap(0));
        grid.addView(card, gridCell(dp(3)));
    }

    private void reloadApps() {
        if (launcherApps == null || userManager == null) return;
        runOnUiThread(() -> {
            allApps.clear();
            try {
                List<UserHandle> profiles = launcherApps.getProfiles();
                for (UserHandle profile : profiles) {
                    long serial = userManager.getSerialNumberForUser(profile);
                    for (LauncherActivityInfo info : launcherApps.getActivityList(null, profile)) {
                        ComponentName component = info.getComponentName();
                        if (component.getPackageName().equals(getPackageName()) && component.getClassName().equals(HomeActivity.class.getName())) continue;
                        allApps.add(new LaunchEntry(info, serial + "|" + component.flattenToString(), serial));
                    }
                }
                Collator collator = Collator.getInstance();
                allApps.sort((left, right) -> collator.compare(left.label(), right.label()));
            } catch (RuntimeException error) {
                Toast.makeText(this, "APPLICATION LIBRARY UNAVAILABLE · " + error.getMessage(), Toast.LENGTH_LONG).show();
            }
            renderStatusDeck();
            renderApplications();
        });
    }

    private void renderApplications() {
        if (favoriteGrid == null || applicationGrid == null) return;
        String query = search == null ? "" : search.getText().toString().trim().toLowerCase(Locale.ROOT);
        Set<String> favorites = favoriteKeys();
        ArrayList<LaunchEntry> visible = new ArrayList<>();
        ArrayList<LaunchEntry> favoriteEntries = new ArrayList<>();
        for (LaunchEntry entry : allApps) {
            if (query.isEmpty() || entry.label().toLowerCase(Locale.ROOT).contains(query) || entry.info.getComponentName().getPackageName().toLowerCase(Locale.ROOT).contains(query)) visible.add(entry);
            if (favorites.contains(entry.key)) favoriteEntries.add(entry);
        }
        int columns = appColumns();
        favoriteGrid.removeAllViews();
        favoriteGrid.setColumnCount(columns);
        applicationGrid.removeAllViews();
        applicationGrid.setColumnCount(columns);
        favoriteSummary.setText("FAVORITE APPLICATIONS\n" + favoriteEntries.size() + " PINNED · LONG-PRESS OR USE ★ TO CHANGE");
        applicationSummary.setText("APPLICATION LIBRARY\n" + visible.size() + " SHOWN · " + allApps.size() + " INSTALLED");
        if (favoriteEntries.isEmpty()) favoriteGrid.addView(emptyState("NO FAVORITES YET · PRESS ☆ ON AN APPLICATION"), fullGridCell(columns));
        else for (LaunchEntry entry : favoriteEntries) favoriteGrid.addView(appCard(entry, true), gridCell(dp(3)));
        if (visible.isEmpty()) applicationGrid.addView(emptyState("NO APPLICATIONS MATCH THIS SEARCH"), fullGridCell(columns));
        else for (LaunchEntry entry : visible) applicationGrid.addView(appCard(entry, favorites.contains(entry.key)), gridCell(dp(3)));
    }

    private View appCard(LaunchEntry entry, boolean favorite) {
        LinearLayout card = column(PANEL);
        card.setPadding(dp(8), dp(8), dp(8), dp(7));
        card.setBackground(shape(PANEL, 24, 3, 24, 24));
        card.setMinimumHeight(dp(112));
        card.setContentDescription("Open " + entry.label());
        card.setOnClickListener(ignored -> launch(entry));
        card.setOnLongClickListener(ignored -> { toggleFavorite(entry); return true; });

        LinearLayout top = row(PANEL);
        ImageView icon = new ImageView(this);
        try { icon.setImageDrawable(entry.info.getBadgedIcon(getResources().getDisplayMetrics().densityDpi)); } catch (RuntimeException ignored) {}
        top.addView(icon, new LinearLayout.LayoutParams(dp(42), dp(42)));
        Button star = button(favorite ? "★" : "☆", favorite ? ORANGE : DIM);
        star.setContentDescription((favorite ? "Remove " : "Add ") + entry.label() + (favorite ? " from favorites" : " to favorites"));
        star.setOnClickListener(ignored -> toggleFavorite(entry));
        LinearLayout.LayoutParams starParams = new LinearLayout.LayoutParams(dp(42), dp(42));
        starParams.leftMargin = dp(6);
        top.addView(star, starParams);
        card.addView(top, matchWrap(dp(6)));
        TextView name = label(entry.label().toUpperCase(Locale.ROOT), Color.WHITE, 12, true);
        name.setMaxLines(2);
        card.addView(name, matchWrap(dp(2)));
        card.addView(label(entry.serial == userManager.getSerialNumberForUser(android.os.Process.myUserHandle()) ? "PERSONAL" : "PROFILE", PEACH, 8, true), matchWrap(0));
        return card;
    }

    private void launch(LaunchEntry entry) {
        try { launcherApps.startMainActivity(entry.info.getComponentName(), entry.info.getUser(), null, null); }
        catch (RuntimeException error) { Toast.makeText(this, "COULD NOT OPEN " + entry.label().toUpperCase(Locale.ROOT), Toast.LENGTH_SHORT).show(); }
    }

    private void toggleFavorite(LaunchEntry entry) {
        Set<String> favorites = favoriteKeys();
        if (!favorites.add(entry.key)) favorites.remove(entry.key);
        preferences.edit().putStringSet(FAVORITES, favorites).apply();
        renderApplications();
    }

    private Set<String> favoriteKeys() {
        return new HashSet<>(preferences.getStringSet(FAVORITES, new HashSet<>()));
    }

    private void requestHomeRole() {
        if (Build.VERSION.SDK_INT >= 29) {
            RoleManager roles = getSystemService(RoleManager.class);
            if (roles != null && roles.isRoleAvailable(RoleManager.ROLE_HOME) && !roles.isRoleHeld(RoleManager.ROLE_HOME)) {
                startActivityForResult(roles.createRequestRoleIntent(RoleManager.ROLE_HOME), HOME_ROLE_REQUEST);
                return;
            }
        }
        openHomeSettings();
    }

    private void refreshHomeState() {
        boolean held = false;
        if (Build.VERSION.SDK_INT >= 29) {
            RoleManager roles = getSystemService(RoleManager.class);
            held = roles != null && roles.isRoleHeld(RoleManager.ROLE_HOME);
        }
        if (homeState != null) {
            homeState.setText(held ? "LCARS IS CURRENT HOME" : "MAKE LCARS HOME");
            homeState.setBackground(shape(held ? BLUE : ORANGE, 22, 3, 22, 22));
        }
    }

    private void openHomeSettings() {
        try { startActivity(new Intent(Settings.ACTION_HOME_SETTINGS)); }
        catch (RuntimeException ignored) { startActivity(new Intent(Settings.ACTION_SETTINGS)); }
    }

    private String pairedStatus() {
        SharedPreferences padd = getSharedPreferences(PADD_PREFS, MODE_PRIVATE);
        return padd.getString("station-token", "").isEmpty() ? "COMPANION NOT PAIRED" : "PADD COMPANION PAIRED";
    }

    private int batteryPercent() {
        BatteryManager manager = (BatteryManager) getSystemService(BATTERY_SERVICE);
        return manager == null ? -1 : manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
    }

    private String networkLabel() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (manager == null) return "OFFLINE";
        Network network = manager.getActiveNetwork();
        NetworkCapabilities capabilities = network == null ? null : manager.getNetworkCapabilities(network);
        if (capabilities == null) return "OFFLINE";
        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return "WI-FI";
        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) return "CELLULAR";
        if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) return "ETHERNET";
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) ? "ONLINE" : "LOCAL";
    }

    private String storageFree() {
        StatFs stats = new StatFs(Environment.getDataDirectory().getAbsolutePath());
        long bytes = stats.getAvailableBytes();
        if (bytes >= 1024L * 1024L * 1024L) return String.format(Locale.ROOT, "%.1f GB", bytes / (1024d * 1024d * 1024d));
        return Math.max(0, bytes / (1024L * 1024L)) + " MB";
    }

    private int appColumns() {
        int width = getResources().getConfiguration().screenWidthDp;
        if (width >= 900) return 7;
        if (width >= 720) return 6;
        if (width >= 560) return 5;
        if (width >= 400) return 4;
        return 3;
    }

    private int statusColumns() {
        return getResources().getConfiguration().screenWidthDp >= 620 ? 4 : 2;
    }

    private TextView sectionHeader(String title, String detail) {
        TextView view = label(title + "\n" + detail, Color.WHITE, 15, true);
        view.setBackground(shape(ORANGE, 26, 3, 3, 26));
        view.setTextColor(BLACK);
        view.setPadding(dp(14), dp(8), dp(14), dp(8));
        return view;
    }

    private TextView emptyState(String text) {
        TextView view = label(text, PEACH, 11, true);
        view.setGravity(Gravity.CENTER);
        view.setBackground(shape(PANEL, 22, 3, 22, 22));
        view.setPadding(dp(12), dp(18), dp(12), dp(18));
        return view;
    }

    private LinearLayout panel(int accent) {
        LinearLayout view = column(PANEL);
        view.setPadding(dp(12), dp(10), dp(12), dp(10));
        GradientDrawable background = shape(PANEL, 22, 3, 22, 22);
        background.setStroke(dp(2), accent);
        view.setBackground(background);
        return view;
    }

    private EditText input(String hint) {
        EditText view = new EditText(this);
        view.setHint(hint);
        view.setHintTextColor(Color.rgb(132, 126, 139));
        view.setTextColor(Color.WHITE);
        view.setSingleLine(true);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        view.setPadding(dp(12), dp(10), dp(12), dp(10));
        view.setBackground(shape(Color.rgb(29, 26, 33), 22, 3, 22, 22));
        return view;
    }

    private Button button(String text, int color) {
        Button view = new Button(this);
        view.setAllCaps(false);
        view.setText(text);
        view.setTextColor(BLACK);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        view.setPadding(dp(7), dp(5), dp(7), dp(5));
        view.setBackground(shape(color, 22, 3, 22, 22));
        return view;
    }

    private TextView label(String text, int color, int size, boolean bold) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(color);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, size);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private LinearLayout row(int color) { LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.HORIZONTAL); view.setGravity(Gravity.CENTER_VERTICAL); view.setBackgroundColor(color); return view; }
    private LinearLayout column(int color) { LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.VERTICAL); view.setBackgroundColor(color); return view; }

    private GradientDrawable shape(int color, int topLeft, int topRight, int bottomRight, int bottomLeft) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadii(new float[]{dp(topLeft),dp(topLeft),dp(topRight),dp(topRight),dp(bottomRight),dp(bottomRight),dp(bottomLeft),dp(bottomLeft)});
        return drawable;
    }

    private LinearLayout.LayoutParams matchWrap(int bottomMargin) { LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT); params.bottomMargin = bottomMargin; return params; }
    private LinearLayout.LayoutParams weightedHeight(float weight, int height, int rightMargin) { LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, height, weight); params.rightMargin = rightMargin; return params; }

    private GridLayout.LayoutParams gridCell(int margin) {
        GridLayout.LayoutParams params = new GridLayout.LayoutParams();
        params.width = 0;
        params.height = ViewGroup.LayoutParams.WRAP_CONTENT;
        params.columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f);
        params.setGravity(Gravity.FILL);
        params.setMargins(0, 0, margin, margin);
        return params;
    }

    private GridLayout.LayoutParams fullGridCell(int columns) {
        GridLayout.LayoutParams params = new GridLayout.LayoutParams();
        params.width = 0;
        params.columnSpec = GridLayout.spec(0, columns, 1f);
        params.setGravity(Gravity.FILL);
        params.bottomMargin = dp(4);
        return params;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private static final class LaunchEntry {
        final LauncherActivityInfo info;
        final String key;
        final long serial;
        LaunchEntry(LauncherActivityInfo info, String key, long serial) { this.info = info; this.key = key; this.serial = serial; }
        String label() { return info.getLabel() == null ? info.getComponentName().getPackageName() : info.getLabel().toString(); }
    }
}
