package com.lcars.padd;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

public final class PaddWidgetProvider extends AppWidgetProvider {
    private static final String PREFS = "lcars-padd";
    private static final String PAGE = "widget-page";
    private static final String MEDIA = "widget-media";
    private static final String VOLUME = "widget-volume";
    private static final String UPDATED = "widget-updated";

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    static void updateAll(Context context, JSONObject state) {
        if (state == null) return;
        String media = "NO ACTIVE MEDIA";
        if (state.optJSONArray("media") != null && state.optJSONArray("media").length() > 0) {
            JSONObject item = state.optJSONArray("media").optJSONObject(0);
            if (item != null) media = item.optString("title", item.optString("name", media));
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(PAGE, state.optString("page", "overview").toUpperCase())
            .putString(MEDIA, media)
            .putInt(VOLUME, state.optInt("volume", 0))
            .putLong(UPDATED, System.currentTimeMillis())
            .apply();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, PaddWidgetProvider.class);
        for (int id : manager.getAppWidgetIds(component)) manager.updateAppWidget(id, views(context));
    }

    private static RemoteViews views(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.padd_widget);
        views.setTextViewText(R.id.widget_page, preferences.getString(PAGE, "LINK STANDBY"));
        views.setTextViewText(R.id.widget_media, preferences.getString(MEDIA, "OPEN THE PADD TO CONNECT"));
        views.setTextViewText(R.id.widget_volume, "MASTER " + preferences.getInt(VOLUME, 0) + "%");
        Intent launch = new Intent(context, HomeActivity.class);
        launch.putExtra("open-page", "companion");
        PendingIntent pending = PendingIntent.getActivity(context, 280, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);
        return views;
    }
}
