package com.paliz.taghvim;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Taps on the widgets and on the notification's buttons. Not exported: only our own PendingIntents reach it. */
public class TodayAction extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Today.ACTION_TOGGLE.equals(action)) {
            Today.toggle(context, intent.getIntExtra("idx", -1));
        } else if (Today.ACTION_SNOOZE.equals(action)) {
            Today.snooze(context, intent.getStringExtra("title"), intent.getStringExtra("tm"));
        } else if (Today.ACTION_SNOOZE_FIRE.equals(action)) {
            Today.fireSnooze(context, intent.getStringExtra("title"), intent.getStringExtra("tm"));
        }
    }
}
