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

import java.util.Calendar;

public class TodayWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "HalghehWidgetPrefs";
    public static final String ACTION_QUICK_TASK = "com.javadsharifi.halgheh.ACTION_QUICK_TASK";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, TodayWidgetProvider.class);
        int[] appWidgetIds = manager.getAppWidgetIds(componentName);
        for (int id : appWidgetIds) {
            updateAppWidget(context, manager, id);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String date = prefs.getString("date", null);
        if (date == null || date.isEmpty()) {
            date = getPersianDate();
        }

        int openCount = prefs.getInt("open_count", 0);
        int totalCount = prefs.getInt("total_count", 0);
        String summary = prefs.getString("summary", null);
        if (summary == null || summary.isEmpty()) {
            if (totalCount > 0) {
                summary = toPersianDigits(openCount) + " کار باقی‌مانده از " + toPersianDigits(totalCount) + " کار";
            } else {
                summary = "کارهای امروز";
            }
        }

        String task1 = prefs.getString("task_1", null);
        String task2 = prefs.getString("task_2", null);
        String task3 = prefs.getString("task_3", null);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        views.setTextViewText(R.id.widget_date, date);
        views.setTextViewText(R.id.widget_tasks_summary, summary);

        // Bind task rows
        if (openCount == 0 && totalCount == 0) {
            views.setViewVisibility(R.id.widget_empty_text, View.VISIBLE);
            views.setTextViewText(R.id.widget_empty_text, "کاری برای امروز ثبت نشده است.");
            views.setViewVisibility(R.id.widget_task_row_1, View.GONE);
            views.setViewVisibility(R.id.widget_task_row_2, View.GONE);
            views.setViewVisibility(R.id.widget_task_row_3, View.GONE);
        } else if (openCount == 0 && totalCount > 0) {
            views.setViewVisibility(R.id.widget_empty_text, View.VISIBLE);
            views.setTextViewText(R.id.widget_empty_text, "همهٔ کارهای امروز انجام شدند!");
            views.setViewVisibility(R.id.widget_task_row_1, View.GONE);
            views.setViewVisibility(R.id.widget_task_row_2, View.GONE);
            views.setViewVisibility(R.id.widget_task_row_3, View.GONE);
        } else {
            views.setViewVisibility(R.id.widget_empty_text, View.GONE);

            bindRow(views, R.id.widget_task_row_1, R.id.widget_task_text_1, task1);
            bindRow(views, R.id.widget_task_row_2, R.id.widget_task_text_2, task2);
            bindRow(views, R.id.widget_task_row_3, R.id.widget_task_text_3, task3);
        }

        // Tap on widget root or header -> Open MainActivity
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
        views.setOnClickPendingIntent(R.id.widget_root, openPending);
        views.setOnClickPendingIntent(R.id.widget_header_click, openPending);

        // Tap on Quick Add button -> Open MainActivity with quick_task action
        Intent quickTaskIntent = new Intent(context, MainActivity.class);
        quickTaskIntent.setAction(ACTION_QUICK_TASK);
        quickTaskIntent.putExtra("quick_task", true);
        quickTaskIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent quickPending = PendingIntent.getActivity(
                context,
                1,
                quickTaskIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_quick_add_btn, quickPending);

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

    public static String getPersianDate() {
        Calendar cal = Calendar.getInstance();
        int gYear = cal.get(Calendar.YEAR);
        int gMonth = cal.get(Calendar.MONTH) + 1;
        int gDay = cal.get(Calendar.DAY_OF_MONTH);
        int dayOfWeek = cal.get(Calendar.DAY_OF_WEEK);

        String[] weekdays = {"یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"};
        String weekday = weekdays[(dayOfWeek - 1) % 7];

        int[] p = gregorianToJalali(gYear, gMonth, gDay);
        String[] months = {"فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"};
        String monthName = (p[1] >= 1 && p[1] <= 12) ? months[p[1] - 1] : "";
        return weekday + "، " + toPersianDigits(p[2]) + " " + monthName;
    }

    private static int[] gregorianToJalali(int gy, int gm, int gd) {
        int[] g_d_m = {0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334};
        int gy2 = (gm > 2) ? (gy + 1) : gy;
        int days = 355666 + (365 * gy) + ((gy2 + 3) / 4) - ((gy2 + 99) / 100) + ((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
        int jy = -1595 + (33 * (days / 12053));
        days %= 12053;
        jy += 4 * (days / 1461);
        days %= 1461;
        if (days > 365) {
            jy += (days - 1) / 365;
            days = (days - 1) % 365;
        }
        int jm = (days < 186) ? 1 + (days / 31) : 7 + ((days - 186) / 30);
        int jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
        return new int[]{jy, jm, jd};
    }

    private static String toPersianDigits(int num) {
        String s = String.valueOf(num);
        char[] fa = {'۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'};
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (c >= '0' && c <= '9') {
                sb.append(fa[c - '0']);
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
