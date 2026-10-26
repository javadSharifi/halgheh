package com.paliz.taghvim;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Draws "today" on both home-screen widgets and the ongoing notification from the plan the web app saved.
 * Everything here works offline: the plan holds the next 30 days, already formatted by the web app.
 */
final class Today {
    static final String ACTION_REFRESH = "com.paliz.taghvim.REFRESH";
    static final String ACTION_TOGGLE = "com.paliz.taghvim.TOGGLE";
    static final String ACTION_SNOOZE = "com.paliz.taghvim.SNOOZE";
    static final String ACTION_SNOOZE_FIRE = "com.paliz.taghvim.SNOOZE_FIRE";
    private static final String PREFS = "today";
    private static final String CHANNEL = "today";
    private static final String SNOOZE_CHANNEL = "snooze";
    private static final int NOTIFICATION_ID = 1;
    private static final int SNOOZE_NOTIFICATION_ID = 2;
    private static final long SNOOZE_MS = 15 * 60 * 1000L;
    private static final int ROWS = 4;
    private static final int[] ROW = {R.id.w_r0, R.id.w_r1, R.id.w_r2, R.id.w_r3};
    private static final int[] BOX = {R.id.w_b0, R.id.w_b1, R.id.w_b2, R.id.w_b3};
    private static final int[] TITLE = {R.id.w_t0, R.id.w_t1, R.id.w_t2, R.id.w_t3};
    private static final int[] TIME = {R.id.w_m0, R.id.w_m1, R.id.w_m2, R.id.w_m3};

    private Today() {}

    /** One line of today: a birthday (no id) or a task. `idx` is its position in the saved plan, which the tick queue refers to. */
    static final class Item {
        String text;
        String id;
        String time = "";
        boolean done;
        int idx;

        boolean isTask() {
            return id != null;
        }
    }

    /** Today's slice of the plan, with the lines already in display order: birthdays, open tasks, done tasks. */
    static final class Model {
        String title = "", sub = "", wd = "", day = "", my = "", g = "", dm = "", ev = "";
        boolean hol;
        final List<Item> items = new ArrayList<>();
        int tasks, done;

        List<Item> open() {
            List<Item> l = new ArrayList<>();
            for (Item i : items) if (i.isTask() && !i.done) l.add(i);
            return l;
        }
    }

    private static String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static String fa(int n) {
        StringBuilder sb = new StringBuilder();
        for (char ch : String.valueOf(n).toCharArray()) sb.append(ch >= '0' && ch <= '9' ? (char) ('۰' + (ch - '0')) : ch);
        return sb.toString();
    }

    static void save(Context c, String days, boolean ongoing) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("days", days).putBoolean("ongoing", ongoing).apply();
    }

    /** Widget or notification tap: flip the done flag of today's task number `idx`, remember it for the app, redraw. */
    static synchronized void toggle(Context c, int idx) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONObject days = new JSONObject(p.getString("days", "{}"));
            String key = todayKey();
            JSONObject item = days.getJSONObject(key).getJSONArray("items").getJSONObject(idx);
            if (!item.has("id")) return;
            int d = 1 - item.getInt("d");
            item.put("d", d);
            JSONArray queue = new JSONArray(p.getString("toggles", "[]"));
            queue.put(new JSONObject().put("id", item.getString("id")).put("date", key).put("d", d).put("at", System.currentTimeMillis()));
            p.edit().putString("days", days.toString()).putString("toggles", queue.toString()).apply();
        } catch (JSONException ignored) {
            return; // stale row: nothing to flip
        }
        refresh(c);
    }

    /** Returns the queued ticks as a JSON array string and clears the queue. */
    static synchronized String takeToggles(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String q = p.getString("toggles", "[]");
        p.edit().remove("toggles").apply();
        return q;
    }

    /** Today's model, or null when the saved plan does not reach today (the app has not been opened for 30 days). */
    static Model load(SharedPreferences p) {
        try {
            JSONObject day = new JSONObject(p.getString("days", "{}")).optJSONObject(todayKey());
            if (day == null) return null;
            Model m = new Model();
            m.title = day.optString("title");
            m.sub = day.optString("sub");
            m.wd = day.optString("wd");
            m.day = day.optString("day");
            m.my = day.optString("my");
            m.g = day.optString("g");
            m.dm = day.optString("dm");
            m.ev = day.optString("ev");
            m.hol = day.optInt("hol") == 1;
            JSONArray arr = day.getJSONArray("items");
            List<Item> births = new ArrayList<>(), open = new ArrayList<>(), done = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.getJSONObject(i);
                Item it = new Item();
                it.idx = i;
                it.text = o.optString("t");
                it.id = o.has("id") ? o.getString("id") : null;
                it.time = o.optString("tm");
                it.done = o.optInt("d") == 1;
                if (!it.isTask()) births.add(it);
                else if (it.done) done.add(it);
                else open.add(it);
            }
            m.tasks = open.size() + done.size();
            m.done = done.size();
            m.items.addAll(births);
            m.items.addAll(open);
            m.items.addAll(done);
            return m;
        } catch (JSONException e) {
            return null;
        }
    }

    static void refresh(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Model m = load(p);
        PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        updateLarge(c, m, open);
        updateSmall(c, m, open);
        updateMini(c, m, open);
        updateNotification(c, p.getBoolean("ongoing", false), m, open);
        scheduleMidnight(c);
    }

    private static PendingIntent tap(Context c, int requestCode, String action, int idx) {
        Intent i = new Intent(c, TodayAction.class).setAction(action).putExtra("idx", idx);
        return PendingIntent.getBroadcast(c, requestCode, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    // ---- large widget (4x3): header with progress ring, then up to four lines ----

    private static void updateLarge(Context c, Model m, PendingIntent open) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (int id : mgr.getAppWidgetIds(new ComponentName(c, TodayWidget.class))) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.today_widget);
            v.setOnClickPendingIntent(R.id.w_root, open);
            v.setTextViewText(R.id.w_title, m == null ? "روزنگار" : m.title);
            v.setTextColor(R.id.w_title, m != null && m.hol ? 0xFFC85537 : c.getColor(R.color.widget_fg)); // holidays in red
            v.setTextViewText(R.id.w_sub, m == null ? "برای به‌روزرسانی، برنامه را باز کنید" : m.sub);
            v.setImageViewBitmap(R.id.w_ring, ring(c, m == null ? 0 : m.done, m == null ? 0 : m.tasks));
            v.setTextViewText(R.id.w_ring_text, m == null || m.tasks == 0 ? "" : fa(m.done) + "/" + fa(m.tasks));

            List<Item> items = m == null ? new ArrayList<Item>() : m.items;
            int extra = items.size() > ROWS ? items.size() - (ROWS - 1) : 0; // the last visible line becomes "and N more"
            for (int i = 0; i < ROWS; i++) {
                boolean more = extra > 0 && i == ROWS - 1;
                Item it = !more && i < items.size() ? items.get(i) : null;
                if (it == null && !more && !(i == 0 && items.isEmpty())) {
                    v.setViewVisibility(ROW[i], View.GONE);
                    continue;
                }
                v.setViewVisibility(ROW[i], View.VISIBLE);
                if (it == null) { // empty day or the "and N more" line
                    v.setViewVisibility(BOX[i], View.GONE);
                    v.setTextViewText(TITLE[i], more ? "و " + fa(extra) + " مورد دیگر" : "کاری برای امروز نیست");
                    v.setTextColor(TITLE[i], c.getColor(R.color.widget_muted));
                    v.setTextViewText(TIME[i], "");
                    v.setOnClickPendingIntent(ROW[i], open);
                    continue;
                }
                v.setTextViewText(TITLE[i], it.text);
                v.setTextViewText(TIME[i], it.time);
                v.setTextColor(TITLE[i], c.getColor(it.done ? R.color.widget_done : R.color.widget_fg));
                v.setTextColor(TIME[i], c.getColor(it.done ? R.color.widget_done : R.color.widget_blue_ink));
                if (it.isTask()) {
                    v.setViewVisibility(BOX[i], View.VISIBLE);
                    v.setImageViewResource(BOX[i], it.done ? R.drawable.box_on : R.drawable.box_off);
                    v.setOnClickPendingIntent(ROW[i], tap(c, 100 + i, ACTION_TOGGLE, it.idx));
                } else {
                    v.setViewVisibility(BOX[i], View.GONE);
                    v.setOnClickPendingIntent(ROW[i], open);
                }
            }
            mgr.updateAppWidget(id, v);
        }
    }

    /** The progress ring: a faint full circle with the done part drawn over it. */
    private static Bitmap ring(Context c, int done, int total) {
        float d = c.getResources().getDisplayMetrics().density;
        int size = Math.round(46 * d);
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bmp);
        float stroke = 4.5f * d;
        RectF box = new RectF(stroke / 2, stroke / 2, size - stroke / 2, size - stroke / 2);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(stroke);
        p.setColor(c.getColor(R.color.widget_ring_track));
        cv.drawArc(box, 0, 360, false, p);
        if (total > 0 && done > 0) {
            p.setColor(c.getColor(R.color.widget_accent));
            p.setStrokeCap(Paint.Cap.ROUND);
            cv.drawArc(box, -90, 360f * done / total, false, p);
        }
        return bmp;
    }

    // ---- small widget (2x2): weekday, big day number, month, other calendar, open tasks ----

    private static void updateSmall(Context c, Model m, PendingIntent open) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (int id : mgr.getAppWidgetIds(new ComponentName(c, TodaySmallWidget.class))) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.today_small);
            v.setOnClickPendingIntent(R.id.s_root, open);
            if (m == null) {
                v.setTextViewText(R.id.s_wd, "روزنگار");
                v.setTextViewText(R.id.s_day, "·");
                v.setTextViewText(R.id.s_my, "برنامه را باز کنید");
                v.setTextViewText(R.id.s_g, "");
                v.setViewVisibility(R.id.s_icon, View.GONE);
                v.setTextViewText(R.id.s_cnt, "");
            } else {
                int left = m.tasks - m.done;
                v.setTextViewText(R.id.s_wd, m.hol ? m.wd + " · تعطیل" : m.wd);
                v.setTextColor(R.id.s_day, m.hol ? 0xFFC85537 : c.getColor(R.color.widget_fg));
                v.setTextViewText(R.id.s_day, m.day);
                v.setTextViewText(R.id.s_my, m.my);
                v.setTextViewText(R.id.s_g, m.g);
                v.setViewVisibility(R.id.s_icon, m.tasks > 0 ? View.VISIBLE : View.GONE);
                v.setTextViewText(R.id.s_cnt, m.tasks == 0 ? "" : left == 0 ? "انجام شد" : fa(left) + " کار");
            }
            mgr.updateAppWidget(id, v);
        }
    }

    // ---- minimal widget (2x1): no background, white text ----

    private static void updateMini(Context c, Model m, PendingIntent open) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (int id : mgr.getAppWidgetIds(new ComponentName(c, TodayMiniWidget.class))) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.today_mini);
            v.setOnClickPendingIntent(R.id.m_root, open);
            if (m == null) {
                v.setTextViewText(R.id.m_day, "روزنگار");
                v.setTextViewText(R.id.m_sub, "برنامه را باز کنید");
                v.setTextViewText(R.id.m_cnt, "");
            } else {
                int left = m.tasks - m.done;
                v.setTextViewText(R.id.m_day, m.day + " " + m.my.split(" ")[0]);
                v.setTextViewText(R.id.m_sub, m.hol ? m.wd + " · تعطیل" : m.wd);
                v.setTextViewText(R.id.m_cnt, !m.ev.isEmpty() ? m.ev : m.tasks == 0 ? m.g : left == 0 ? "همهٔ کارها انجام شد" : fa(left) + " کار مانده");
            }
            mgr.updateAppWidget(id, v);
        }
    }

    // ---- ongoing notification: summary, progress, and two actions ----

    private static void updateNotification(Context c, boolean on, Model m, PendingIntent open) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (!on || !NotificationManagerCompat.from(c).areNotificationsEnabled()) {
            nm.cancel(NOTIFICATION_ID);
            return;
        }
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CHANNEL, "امروز", NotificationManager.IMPORTANCE_LOW));

        String title, text;
        StringBuilder big = new StringBuilder();
        List<Item> open_ = m == null ? new ArrayList<Item>() : m.open();
        if (m == null) {
            title = "روزنگار";
            text = "برای به‌روزرسانی، برنامه را باز کنید";
        } else {
            title = m.tasks == 0 ? "کاری برای امروز نیست" : open_.isEmpty() ? "همهٔ کارهای امروز انجام شد" : fa(open_.size()) + " کار باقی‌مانده برای امروز";
            StringBuilder next = new StringBuilder();
            for (int i = 0; i < open_.size() && i < 2; i++) {
                if (next.length() > 0) next.append(" · ");
                Item it = open_.get(i);
                next.append(it.text);
                if (!it.time.isEmpty()) next.append("، ").append(it.time);
            }
            text = next.length() > 0 ? "بعدی: " + next : !m.ev.isEmpty() ? m.ev : m.sub;
            if (m.hol) title = "تعطیل · " + title;
            for (Item it : open_) big.append(it.time.isEmpty() ? "• " : it.time + " ").append(it.text).append('\n');
            for (Item it : m.items) if (!it.isTask()) big.append(it.text).append('\n');
        }

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_today)
                .setColor(0xFF4466E6)
                .setSubText(m == null ? null : m.dm)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(big.length() == 0 ? text : text + "\n" + big.toString().trim()))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setContentIntent(open);
        if (m != null && m.tasks > 0) b.setProgress(100, Math.round(100f * m.done / m.tasks), false);
        if (!open_.isEmpty()) {
            Item next = open_.get(0);
            b.addAction(0, "انجام شد", tap(c, 300, ACTION_TOGGLE, next.idx));
            Intent s = new Intent(c, TodayAction.class).setAction(ACTION_SNOOZE).putExtra("title", next.text).putExtra("tm", next.time);
            b.addAction(0, "یادآوری ۱۵ دقیقه بعد", PendingIntent.getBroadcast(c, 301, s, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        nm.notify(NOTIFICATION_ID, b.build());
    }

    /** "Remind me in 15 minutes": an alarm that posts a plain alert about the task the notification was showing. */
    static void snooze(Context c, String title, String time) {
        Intent i = new Intent(c, TodayAction.class).setAction(ACTION_SNOOZE_FIRE).putExtra("title", title).putExtra("tm", time);
        PendingIntent pi = PendingIntent.getBroadcast(c, 400, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        c.getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + SNOOZE_MS, pi);
    }

    static void fireSnooze(Context c, String title, String time) {
        if (!NotificationManagerCompat.from(c).areNotificationsEnabled()) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(SNOOZE_CHANNEL, "یادآوری", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        nm.notify(SNOOZE_NOTIFICATION_ID, new NotificationCompat.Builder(c, SNOOZE_CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_today)
                .setColor(0xFF4466E6)
                .setContentTitle(title == null ? "یادآوری" : title)
                .setContentText(time == null || time.isEmpty() ? "یادآوری" : "یادآوری · " + time)
                .setAutoCancel(true)
                .setContentIntent(open)
                .build());
    }

    /** Re-draw just after midnight so the date flips even if the app is closed. */
    private static void scheduleMidnight(Context c) {
        Calendar t = Calendar.getInstance();
        t.add(Calendar.DAY_OF_YEAR, 1);
        t.set(Calendar.HOUR_OF_DAY, 0);
        t.set(Calendar.MINUTE, 0);
        t.set(Calendar.SECOND, 5);
        t.set(Calendar.MILLISECOND, 0);
        PendingIntent pi = PendingIntent.getBroadcast(c, 1, new Intent(c, TodayReceiver.class).setAction(ACTION_REFRESH), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        c.getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC, t.getTimeInMillis(), pi);
    }
}
