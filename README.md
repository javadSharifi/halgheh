# حلقه

**شبکهٔ آدم‌های تو — روی گوشی خودت.**

حلقه یک برنامهٔ اندرویدی فارسی و آفلاین برای نگه‌داشتن رابطه‌هاست: آدم‌ها، مهارت‌ها، قرارها و یادداشت‌ها. همهٔ داده‌ها روی گوشی می‌مانند و برنامه بدون اینترنت کامل کار می‌کند. همگام‌سازی ابری اختیاری است و فقط برای پشتیبان‌گیری و بازیابی روی چند دستگاه است.

> این مخزن در پایان فاز **Z0** (ساخت اسکلت از روزنگار) قرار دارد. صفحه‌های مستقل تقویم، یادداشت روزانه و ابزارها حذف شده‌اند؛ مدل کامل آدم‌ها در فازهای بعدی اضافه می‌شود.

## اجرا

نیاز به **Node 22** و **pnpm 9** دارد.

```bash
pnpm install
pnpm dev        # سرور توسعه
pnpm test       # تست‌ها
pnpm build      # خروجی production
```

## ساخت اندروید

```bash
pnpm android:apk      # APK دیباگ با Java 21
pnpm android:release  # APK امضاشده → ../release/halgheh.apk
```

کلید امضا در `~/.config/halgheh/` نگه‌داری می‌شود و هیچ‌وقت داخل مخزن نمی‌آید. جزئیات پشتیبان‌گیری و انتشار در [docs/KEYSTORE.md](docs/KEYSTORE.md) است.

## همگام‌سازی اختیاری

بدون `VITE_SYNC_URL` هیچ بخش همگام‌سازی در برنامه دیده نمی‌شود و برنامه به شبکه دست نمی‌زند.

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create halgheh      # database_id را در wrangler.jsonc بگذار
pnpm exec wrangler d1 migrations apply halgheh --remote
pnpm build && pnpm exec wrangler deploy
```

آدرس Worker در `.env.production` قرار می‌گیرد:

```env
VITE_SYNC_URL=https://halgheh.<you>.workers.dev
```

ورود با ایمیل و رمز در صفحهٔ تنظیمات انجام می‌شود. سرور فقط هش کلید مشتق‌شده را نگه می‌دارد؛ دادهٔ همگام‌شده روی سرور رمزنگاری نمی‌شود و برنامه همین را قبل از فعال‌سازی به کاربر می‌گوید.

## تست سرور

```bash
pnpm exec wrangler dev --port 8799
node scripts/smoke-sync.mjs http://127.0.0.1:8799
```
