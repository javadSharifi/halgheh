package com.paliz.taghvim;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** The 2x1 widget without a background: the date and open tasks. */
public class TodayMiniWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        Today.refresh(context);
    }
}
