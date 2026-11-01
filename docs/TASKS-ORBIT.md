# کارهای برگرفته از Orbit

هر آیتم مستقل است؛ ترتیب پیشنهادی پایین صفحه. هر آیتم که تمام شد: `pnpm verify` + `pnpm i18n`.

## ۴ (الف) — جنسیت در پروفایل ✅ (انجام شد)

پیش‌نیاز ۴ب و ۵.

- `src/db/types.ts`: `Person.gender?: 'm' | 'f' | 'o'` (بدون مقدار = نامعلوم، هیچ‌جا اجباری نیست).
- `src/PersonEditor.tsx`: یک ردیف سه‌گزینه‌ای (زن / مرد / دیگر) کنار تولد.
- `src/i18n/en.ts`: خط انگلیسی برای هر رشتهٔ تازه.
- Dexie: نسخهٔ جدید در `src/db/index.ts` لازم نیست (فیلد اختیاری روی ردیف موجود)؛ سینک خودکار است چون ردیف کامل جابه‌جا می‌شود.
- تمام: در پروفایل انتخاب می‌شود، بعد از بستن و باز کردن می‌ماند، در دستگاه دوم هم می‌آید.

## ۷ — حریم اعلان ✅ (انجام شد)

- `src/settings.ts`: `hideNames?: boolean` کنار بقیهٔ تنظیمات.
- `src/reminders.ts`: اگر روشن بود، `title` همهٔ اعلان‌ها `tx('یادآوری')` شود و نام/عنوان تسک در عنوان نیاید. `body` هم کلی.
- `src/SettingsPage.tsx`: ردیف سوییچ زیر «قفل برنامه» — فقط وقتی قفل روشن است معنی دارد.
- تمام: با روشن بودن، اعلان تسکی که اسم شخص در عنوانش هست هیچ نامی نشان نمی‌دهد.

## ۵ — ارسال تبریک با متن آماده ✅ (انجام شد)

- `src/wishes.ts` (تازه): `templates(gender, kind)` که ۲–۳ متن فارسی برمی‌گرداند (`{a1}` = نام). بدون `tx()` در سطح ماژول؛ کلید فارسی + `tx()` موقع رندر.
- `src/native.ts`: `openWish(target, phone, text)` — `sms:`, `https://wa.me/<phone>?text=`, `tg://msg?text=`, `mailto:?body=`, و fallback `shareText`.
- `src/WishSheet.tsx` (تازه): پیش‌نمایش قابل ویرایش + ردیف اپ‌ها + دکمهٔ «ثبت به‌عنوان تعامل» که `interactions` با `type: 'message'` می‌نویسد.
- `src/BirthdaysPage.tsx`: آیکن gift همین شیت را باز کند، نه `sms:` مستقیم.
- تمام: از تولد، شیت باز می‌شود، متن با جنسیت درست می‌آید، ارسال از واتساپ باز می‌شود، تعامل ثبت می‌شود.

## ۱ — ریتم و Due ✅ (انجام شد)

- `src/db/types.ts`: `Person.cadenceDays?: number` و `Person.dueSnoozeUntil?: number`. حلقه = فقط یک انتخابگر آماده در UI (۷/۳۰/۹۰/۱۸۰ روز) که همان `cadenceDays` را می‌نویسد؛ فیلد جدا لازم نیست.
- `src/domain/keepinTouch/index.ts` (تازه، بدون React): `lastSeen(personId, interactions)` و `dueList(people, interactions, today)`؛ فقط `cadenceDays` دارد و آخرین تعاملی قدیمی‌تر از آن → Due. اسنوز آینده = نیست.
- `src/TodayPage.tsx`: بخش «چه کسی را صدا بزنم» با بدترین‌ها اول و دکمهٔ اسنوز یک‌هفته‌ای.
- `src/PersonPage.tsx`: خط «آخرین تماس: {n} روز پیش» + همان اسنوز.
- سینک: `people` الان در `TABLES` هست، کاری لازم نیست.
- تمام: شخص با ریتم ۳۰ و آخرین تعامل ۴۵ روز پیش در Today می‌آید، اسنوز یک هفته پنهانش می‌کند.

## ۴ (ب) — مناسبت‌ها ✅ (انجام شد)

- `src/db/types.ts`: جدول `Occasion` = `{ id, title, cal, month, day, remindLead?: number, tagId?: string, updatedAt }`؛ `tagId` خالی = همه. مثل `Birthday` تاریخش را در تقویم خودش نگه می‌دارد.
- `src/db/index.ts`: نسخهٔ جدید Dexie + ایندکس `cal, month` (فقط append، نسخهٔ قبلی دست نخورد).
- `worker/index.ts`: `'occasions'` به `TABLES`. SQL migration لازم نیست (ردیف‌ها JSON عمومی‌اند).
- `src/BirthdaysPage.tsx`: فهرست دوم «مناسبت‌ها» در همان صفحه؛ تولد و مناسبت در یک تقویم/لیست دیده شوند.
- `src/plan.ts` (نه `reminders.ts`): مناسبت مثل تولد داخل همان خلاصهٔ ۸ صبح می‌آید؛ `remindLead` یک خط زودتر هم می‌سازد.
- تمام: «روز مادر» با برچسب «خانواده» ساخته می‌شود، در لیست می‌آید و روزش اعلان می‌دهد.

## ۸ — افزودن از مخاطبین با picker ✅ (انجام شد)

- `src/contacts.ts`: `pickOne()` با `Contacts.pickContact()` (پلاگین نصب‌شده این را دارد) — بدون `requestPermissions`، فقط همان یک مخاطب.
- `src/PeoplePage.tsx` یا `QuickAdd`: دکمهٔ «از مخاطبین» → فرم شخص تازه پیش‌پر.
- صفحهٔ `ContactsImport` فعلی می‌ماند (برای ایمپورت گروهی)، ولی مسیر پیش‌فرض دیگر مجوز نمی‌خواهد.
- تمام: بدون هیچ دیالوگ مجوزی، یک شخص از picker ساخته می‌شود.

## ۹ — ویجت «پیش‌رو» ✅ (انجام شد)

- الگو: `android/app/src/main/java/com/javadsharifi/halgheh/TodayWidgetProvider.java` + `widget_today.xml` (از SharedPreferences می‌خواند).
- `TodayPlugin.java` / `syncWidget()` در `src/native.ts`: سه کلید `upcoming_1..3` هم نوشته شود (تولد/مناسبت نزدیک: «۱۴ آبان · سارا»).
- فایل‌های تازه: `UpcomingWidgetProvider.java`، `res/layout/widget_upcoming.xml`، `res/xml/upcoming_widget_info.xml`، receiver در `AndroidManifest.xml`.
- تمام: ویجت روی صفحهٔ اصلی سه مورد بعدی را نشان می‌دهد و با عوض شدن داده در اپ به‌روز می‌شود.

## ترتیب پیشنهادی

۴الف → ۷ → ۵ → ۱ → ۴ب → ۸ → ۹.
ارزان و بی‌ریسک اول؛ ۴ب و ۹ آخر چون هر کدام یک migration یا فایل اندرویدی تازه می‌خواهند.

## رد شد

- نمای Orbit (حلقه‌های شعاعی) — گران، اطلاعات تازه‌ای نمی‌دهد.
- پشتیبان رمزنگاری‌شده با passphrase — جدا از این فهرست، اگر خواستی آیتم مستقل شود.
