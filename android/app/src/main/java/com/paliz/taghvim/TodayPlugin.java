package com.paliz.taghvim;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Today")
public class TodayPlugin extends Plugin {
    @PluginMethod
    public void set(PluginCall call) {
        String days = call.getString("days");
        if (days == null) {
            call.reject("days is required");
            return;
        }
        Today.save(getContext(), days, Boolean.TRUE.equals(call.getBoolean("ongoing", false)));
        Today.refresh(getContext());
        call.resolve();
    }

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
                .setTitle("باز کردن روزنگار")
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

    @PluginMethod
    public void takeToggles(PluginCall call) {
        try {
            call.resolve(new JSObject().put("toggles", new JSArray(Today.takeToggles(getContext()))));
        } catch (org.json.JSONException e) {
            call.reject("bad toggle queue");
        }
    }
}
