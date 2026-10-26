package com.paliz.taghvim;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** The 2x2 widget: today's date and how many tasks are left. */
public class TodaySmallWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        Today.refresh(context);
    }
}
