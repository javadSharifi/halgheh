package com.javadsharifi.halgheh;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

/** The "upcoming" widget: the next three birthdays and group occasions, filled by syncWidget() from the web app. */
public class UpcomingWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, UpcomingWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, manager, id);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(TodayWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);

        String line1 = prefs.getString("upcoming_1", null);
        String line2 = prefs.getString("upcoming_2", null);
        String line3 = prefs.getString("upcoming_3", null);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_upcoming);

        if (line1 == null && line2 == null && line3 == null) {
            views.setViewVisibility(R.id.upcoming_empty_text, View.VISIBLE);
        } else {
            views.setViewVisibility(R.id.upcoming_empty_text, View.GONE);
        }
        bindRow(views, R.id.upcoming_row_1, R.id.upcoming_text_1, line1);
        bindRow(views, R.id.upcoming_row_2, R.id.upcoming_text_2, line2);
        bindRow(views, R.id.upcoming_row_3, R.id.upcoming_text_3, line3);

        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setAction(Intent.ACTION_MAIN);
        openAppIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
                context,
                0,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.upcoming_root, openPending);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static void bindRow(RemoteViews views, int rowId, int textId, String text) {
        if (text != null && !text.trim().isEmpty()) {
            views.setViewVisibility(rowId, View.VISIBLE);
            views.setTextViewText(textId, text.trim());
        } else {
            views.setViewVisibility(rowId, View.GONE);
        }
    }
}
