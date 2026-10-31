package com.javadsharifi.halgheh;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Today")
public class TodayPlugin extends Plugin {
    /** The status and gesture bars show the window background: paint it like the page so no white strips appear. */
    @PluginMethod
    public void setBars(PluginCall call) {
        String bg = call.getString("bg");
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        int color;
        try {
            color = android.graphics.Color.parseColor(bg);
        } catch (RuntimeException e) {
            call.reject("bad colour");
            return;
        }
        getActivity().runOnUiThread(() -> {
            android.view.Window w = getActivity().getWindow();
            w.getDecorView().setBackgroundColor(color);
            androidx.core.view.WindowInsetsControllerCompat c = androidx.core.view.WindowCompat.getInsetsController(w, w.getDecorView());
            c.setAppearanceLightStatusBars(!dark);
            c.setAppearanceLightNavigationBars(!dark);
            call.resolve();
        });
    }

    /** Fingerprint/face is offered only when the phone has one enrolled (framework prompt, Android 9+). */
    @PluginMethod
    public void biometricAvailable(PluginCall call) {
        boolean ok = false;
        try {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.hardware.biometrics.BiometricManager m = getContext().getSystemService(android.hardware.biometrics.BiometricManager.class);
                ok = m != null && m.canAuthenticate(android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_WEAK) == android.hardware.biometrics.BiometricManager.BIOMETRIC_SUCCESS;
            } else if (android.os.Build.VERSION.SDK_INT >= 28) {
                android.content.pm.PackageManager pm = getContext().getPackageManager();
                ok = pm.hasSystemFeature(android.content.pm.PackageManager.FEATURE_FINGERPRINT);
            }
        } catch (RuntimeException e) {
            ok = false; // a phone that refuses the question simply gets PIN-only
        }
        call.resolve(new JSObject().put("ok", ok));
    }

    @PluginMethod
    public void biometricAuth(PluginCall call) {
        if (android.os.Build.VERSION.SDK_INT < 28) {
            call.resolve(new JSObject().put("ok", false));
            return;
        }
        getActivity().runOnUiThread(() -> {
            java.util.concurrent.Executor ex = androidx.core.content.ContextCompat.getMainExecutor(getContext());
            android.hardware.biometrics.BiometricPrompt.Builder b = new android.hardware.biometrics.BiometricPrompt.Builder(getContext())
                .setTitle("باز کردن حلقه")
                .setNegativeButton("استفاده از پین", ex, (d, w) -> call.resolve(new JSObject().put("ok", false)));
            b.build().authenticate(new android.os.CancellationSignal(), ex, new android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(android.hardware.biometrics.BiometricPrompt.AuthenticationResult r) {
                    call.resolve(new JSObject().put("ok", true));
                }

                @Override
                public void onAuthenticationError(int code, CharSequence msg) {
                    call.resolve(new JSObject().put("ok", false));
                }
            });
        });
    }

    /** While the lock is on, hide the app from screenshots and the recent-apps card. */
    @PluginMethod
    public void setSecure(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            android.view.Window w = getActivity().getWindow();
            if (on) w.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
            else w.clearFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }

    /** Synchronize today's tasks and date to the Android Home Screen widget */
    @PluginMethod
    public void syncWidgetData(PluginCall call) {
        String date = call.getString("date");
        String summary = call.getString("summary");
        Integer openCount = call.getInt("openCount", 0);
        Integer totalCount = call.getInt("totalCount", 0);
        com.getcapacitor.JSArray tasks = call.getArray("tasks");

        android.content.SharedPreferences prefs = getContext().getSharedPreferences(
            TodayWidgetProvider.PREFS_NAME,
            android.content.Context.MODE_PRIVATE
        );
        android.content.SharedPreferences.Editor editor = prefs.edit();

        if (date != null) editor.putString("date", date);
        if (summary != null) editor.putString("summary", summary);
        editor.putInt("open_count", openCount != null ? openCount : 0);
        editor.putInt("total_count", totalCount != null ? totalCount : 0);

        editor.remove("task_1");
        editor.remove("task_2");
        editor.remove("task_3");

        if (tasks != null) {
            try {
                for (int i = 0; i < tasks.length() && i < 3; i++) {
                    editor.putString("task_" + (i + 1), tasks.getString(i));
                }
            } catch (org.json.JSONException e) {
                // ignore
            }
        }
        editor.apply();

        TodayWidgetProvider.updateAllWidgets(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getWidgetAction(PluginCall call) {
        boolean quick = MainActivity.consumePendingQuickTask();
        call.resolve(new JSObject().put("quickTask", quick));
    }
}
