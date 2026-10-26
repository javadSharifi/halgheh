package com.paliz.taghvim;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TodayPlugin.class);
        super.onCreate(savedInstanceState);
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
}
