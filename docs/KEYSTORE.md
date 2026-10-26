# کلید امضای حلقه

APKهای اندروید باید با یک کلید ثابت امضا شوند. اگر کلید عوض شود، کاربران نمی‌توانند نسخهٔ جدید را روی نسخهٔ نصب‌شده به‌روزرسانی کنند. این کلید فقط یک‌بار ساخته شده و باید خارج از مخزن نگه داشته شود.

## محل نگهداری

| فایل | مسیر | دسترسی |
|---|---|---|
| keystore | `~/.config/halgheh/release.keystore` | `600` |
| مشخصات | `~/.config/halgheh/keystore.properties` | `600` |
| رمزها | `~/.config/halgheh/CREDENTIALS.txt` | `600` |

- **Alias:** `halgheh`
- **الگوریتم:** RSA 4096، اعتبار ۱۰٬۰۰۰ روز (تا ۲۰۵۴)
- **Subject:** `CN=Halgheh, OU=App, O=Halgheh, L=Tehran, ST=Tehran, C=IR`
- **SHA-256 certificate:** `85:3D:65:2E:D4:8B:FD:41:C9:77:90:D4:9D:F9:D6:5E:C5:FB:85:E2:FB:0A:70:27:60:BE:56:10:D3:29:7D:F4`

`android/keystore.properties` (که در `.gitignore` است) به همین مسیر مطلق اشاره می‌کند. هیچ‌وقت keystore یا رمزها را به Git اضافه نکن.

## پشتیبان‌گیری

کل پوشهٔ `~/.config/halgheh/` را در یک مدیر رمز یا دیسک رمزنگاری‌شده کپی کن. **بدون این کلید، انتشار نسخهٔ بعدی برای کاربران فعلی ممکن نیست.** حداقل دو نسخهٔ پشتیبان در دو محل جدا نگه دار.

## ساخت محلی

```bash
pnpm android:release
# خروجی: ../release/halgheh.apk
```

## انتشار GitHub Actions

چهار Secret در **Settings → Secrets and variables → Actions** بساز:

| Secret | مقدار |
|---|---|
| `RELEASE_KEYSTORE_BASE64` | `base64 -i ~/.config/halgheh/release.keystore \| tr -d '\n'` |
| `STORE_PASSWORD` | از `CREDENTIALS.txt` |
| `KEY_ALIAS` | `halgheh` |
| `KEY_PASSWORD` | از `CREDENTIALS.txt` |

گردش‌کار بدون این Secretها عمداً متوقف می‌شود و هیچ کلید موقتی نمی‌سازد. دستور `pnpm android:release` برای ساخت محلی از فایل `android/keystore.properties` استفاده می‌کند.
