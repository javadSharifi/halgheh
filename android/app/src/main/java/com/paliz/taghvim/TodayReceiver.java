package com.paliz.taghvim;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Midnight alarm, reboot, and clock/timezone changes: all just mean "redraw today". */
public class TodayReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Today.refresh(context);
    }
}
