package com.lcars.padd;

import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String PREFS = "lcars-padd";
    private static final String LAST_STATION = "last-station";
    private static final int LOCAL_NETWORK_REQUEST = 271;
    private static final int BLACK = Color.rgb(0, 0, 0);
    private static final int PANEL = Color.rgb(18, 16, 22);
    private static final int ORANGE = Color.rgb(255, 152, 104);
    private static final int PEACH = Color.rgb(244, 182, 107);
    private static final int BLUE = Color.rgb(130, 154, 241);
    private static final int VIOLET = Color.rgb(182, 157, 232);

    private SharedPreferences preferences;
    private WebView webView;
    private String stationRoot = "";
    private boolean showingStation;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        getWindow().setStatusBarColor(BLACK);
        getWindow().setNavigationBarColor(BLACK);
        requestLocalNetworkAccess();
        showConnectionScreen("");
    }

    private void requestLocalNetworkAccess() {
        if (Build.VERSION.SDK_INT >= 37
            && checkSelfPermission("android.permission.ACCESS_LOCAL_NETWORK") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.ACCESS_LOCAL_NETWORK"}, LOCAL_NETWORK_REQUEST);
        }
    }

    private void showConnectionScreen(String alert) {
        showingStation = false;
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        LinearLayout root = column(BLACK);
        root.setPadding(dp(12), dp(18), dp(12), dp(18));

        LinearLayout header = row(PANEL);
        header.setPadding(dp(18), dp(14), dp(14), dp(14));
        TextView title = label("LCARS 27.1\nPADD COMPANION", Color.WHITE, 24, true);
        TextView badge = label("ANDROID", BLACK, 12, true);
        badge.setBackgroundColor(ORANGE);
        badge.setGravity(Gravity.CENTER);
        header.addView(title, new LinearLayout.LayoutParams(0, dp(72), 1));
        header.addView(badge, new LinearLayout.LayoutParams(dp(96), dp(72)));
        root.addView(header, matchWrap(dp(8)));

        LinearLayout panel = column(PANEL);
        panel.setPadding(dp(22), dp(26), dp(22), dp(26));
        TextView eyebrow = label("LOCAL STATION ACQUISITION", PEACH, 11, true);
        TextView heading = label("CONNECT TO LCARS", Color.WHITE, 27, true);
        TextView instructions = label("On the desktop, open Settings → PADD Companion Link and arm a pairing code. Enter the private station address shown there; port 8766 is added automatically.", Color.LTGRAY, 15, false);
        instructions.setLineSpacing(0, 1.18f);
        EditText station = new EditText(this);
        station.setSingleLine(true);
        station.setHint("192.168.1.42");
        station.setText(preferences.getString(LAST_STATION, ""));
        station.setTextColor(Color.WHITE);
        station.setHintTextColor(Color.GRAY);
        station.setTextSize(18);
        station.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        station.setImeOptions(EditorInfo.IME_ACTION_GO);
        station.setPadding(dp(12), dp(10), dp(12), dp(10));
        station.setBackgroundColor(BLACK);
        Button connect = button("CONNECT TO STATION", ORANGE);
        TextView security = label("TRUSTED LOCAL NETWORK ONLY · VIEWER / OPERATOR / COMMAND AUTHORITY IS ENFORCED BY THE DESKTOP", BLUE, 11, true);
        TextView message = label(alert, Color.rgb(255, 125, 133), 13, true);
        View.OnClickListener launch = ignored -> {
            try {
                connectToStation(StationAddress.normalize(station.getText().toString()));
            } catch (IllegalArgumentException error) {
                message.setText(error.getMessage());
            }
        };
        connect.setOnClickListener(launch);
        station.setOnEditorActionListener((view, action, event) -> {
            if (action == EditorInfo.IME_ACTION_GO) {
                launch.onClick(view);
                return true;
            }
            return false;
        });
        panel.addView(eyebrow, matchWrap(dp(5)));
        panel.addView(heading, matchWrap(dp(14)));
        panel.addView(instructions, matchWrap(dp(20)));
        panel.addView(station, matchWrap(dp(10)));
        panel.addView(connect, matchWrap(dp(14)));
        panel.addView(security, matchWrap(dp(10)));
        panel.addView(message, matchWrap(0));
        root.addView(panel, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(root);
        station.requestFocus();
    }

    private void connectToStation(String root) {
        stationRoot = root;
        showingStation = true;
        LinearLayout shell = column(BLACK);
        LinearLayout toolbar = row(PANEL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(14), dp(7), dp(7), dp(7));
        TextView title = label("LCARS PADD · CONNECTED STATION", PEACH, 12, true);
        Button stationButton = button("STATION", VIOLET);
        stationButton.setOnClickListener(ignored -> showConnectionScreen(""));
        toolbar.addView(title, new LinearLayout.LayoutParams(0, dp(48), 1));
        toolbar.addView(stationButton, new LinearLayout.LayoutParams(dp(104), dp(48)));
        shell.addView(toolbar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(62)));

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);
        webView.setBackgroundColor(BLACK);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String requested = request.getUrl().toString();
                if (StationAddress.isAllowedUrl(requested, stationRoot)) return false;
                Toast.makeText(MainActivity.this, "External navigation blocked by LCARS", Toast.LENGTH_SHORT).show();
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (StationAddress.isAllowedUrl(url, stationRoot)) {
                    preferences.edit().putString(LAST_STATION, Uri.parse(stationRoot).getHost()).apply();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    String detail = error == null ? "The LCARS station did not respond." : error.getDescription().toString();
                    view.post(() -> showConnectionScreen("CONNECTION FAILED · " + detail));
                }
            }
        });
        shell.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(shell);
        webView.loadUrl(stationRoot);
    }

    @Override
    public void onBackPressed() {
        if (showingStation) {
            showConnectionScreen("");
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
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
        view.setTextSize(13);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setBackgroundColor(color);
        view.setAllCaps(false);
        return view;
    }

    private LinearLayout.LayoutParams matchWrap(int bottomMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = bottomMargin;
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
