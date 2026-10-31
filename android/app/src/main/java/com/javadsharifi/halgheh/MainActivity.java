package com.javadsharifi.halgheh;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static boolean pendingQuickTask = false;

    public static synchronized boolean consumePendingQuickTask() {
        boolean val = pendingQuickTask;
        pendingQuickTask = false;
        return val;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TodayPlugin.class);
        super.onCreate(savedInstanceState);
        checkWidgetAction(getIntent());

        // the page decides what back means (close a sheet, leave an editor...); when it says no, the app goes to the background
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) {
                    moveTaskToBack(true);
                    return;
                }
                getBridge().getWebView().evaluateJavascript(
                    "(function(){try{return window.__appBack?window.__appBack():false}catch(e){return false}})()",
                    value -> {
                        if (!"true".equals(value)) moveTaskToBack(true);
                    });
            }
        });
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        checkWidgetAction(intent);
    }

    private void checkWidgetAction(android.content.Intent intent) {
        if (intent != null && (TodayWidgetProvider.ACTION_QUICK_TASK.equals(intent.getAction()) || intent.getBooleanExtra("quick_task", false))) {
            pendingQuickTask = true;
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().postDelayed(() -> {
                    getBridge().getWebView().evaluateJavascript(
                        "(function(){try{if(window.__onWidgetQuickTask)window.__onWidgetQuickTask();}catch(e){}})()",
                        null
                    );
                }, 300);
            }
        }
    }
}
