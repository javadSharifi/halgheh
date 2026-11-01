# گزارش جامع فاز ۲: استقرار سیستم طراحی و مهاجرت UI (UI Design System)

این سند گزارش نهایی فاز ۲ پیاده‌سازی سیستم طراحی و یکدست‌سازی رابط کاربری پروژهٔ **حلقه (halgheh)** است که طبق تمامی اصول ایمنی و بدون توقف روی برنچ `ui-design-system` انجام شده است.

---

## ۱. خلاصه‌ی کار و آمار

- **توکن‌های طراحی استخراج و استانداردسازی‌شده:**
  - سیستم مقیاس شعاعی (Radius): `--radius-dot` (2px), `--radius-bar-sm` (3px), `--radius-bar` (4px), `--radius-sm` (8px), `--radius-md` (12px), `--radius-lg` (16px), `--radius-xl` (20px), `--radius-2xl` (24px), `--radius-sheet` (28px), `--radius-full` (9999px), `--radius-btn` (کنترل سراسری انحنای دکمه‌ها، پیش‌فرض `var(--radius-full)`).
  - مقیاس تایپوگرافی (Font Size): ۱۱px تا ۲۴px بر پایه استانداردهای متنی خوانا.
  - سیستم سایه (Shadows): `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-primary`.
  - سیستم فوکوس دسترس‌پذیری: `--focus-ring` (تنها اعمال‌شده روی کامپوننت‌های مدرن `src/ui/`).
- **کامپوننت‌های پایهٔ ایجادشده در `src/ui/`:** ۶ کامپوننت جامع و تایپ‌سیف:
  1. `Button` (پشتیبانی از انواع variant, size، سایزهای اختصاصی آیکونی `icon-sm`/`icon-md`/`icon-lg` با `aria-label` اجباری، حالت `block` و مدیریت ایمن children صفر یا متنی).
  2. `InputField` (پشتیبانی از `input` معمولی و `textarea` multiline، برچسب، ستاره اجباری، خطای اعتبارسنجی، فوکوس ایمن و متن راهنما).
  3. `Select` (انتخاب‌گر مدرن با آیکون سفارشی و برچسب دسترس‌پذیر).
  4. `Card` (کانتینر سطوح شیشه‌ای و تخت با استایل‌های یکدست).
  5. `Sheet` (باتم‌شیت استاندارد با پشتیبانی کامل از کلید Escape، مدیریت استک چندلایه، جلوگیری از اسکرول بدنه، و هم‌تراز با `--kb` و `safe-area-inset-bottom`).
  6. `Chip` (تگ‌ها و فیلترهای تعاملی و قابل حذف بر اساس ساختار استاندارد بدون تداخل دکمه در دکمه).
- **صفحات و بخش‌های مهاجرت‌داده‌شده (۲۸ صفحه/شیت/کامپوننت):**
  - `AboutPage` (مهاجرت به Card)
  - `SettingsPage` (مهاجرت به Card)
  - `SyncPage` (مهاجرت به Card)
  - `TagEditor` (مهاجرت به InputField)
  - `PhotoEdit` (مهاجرت ورودی‌های عنوان/یادداشت به InputField و دکمه ذخیره به Button)
  - `SkillForm` (مهاجرت فیلدهای عنوان، زیرشاخه، نام‌های دیگر، شواهد به InputField و دکمه‌های ثبت/حذف به Button)
  - `CategorySheet` (مهاجرت دکمه‌های اقدام به Button)
  - `CompareSessionPage` (مهاجرت شیت جزئیات آیتم، یادداشت تصمیم به InputField و دکمه‌های ذخیره/تصمیم به Button)
  - `RuleSheet` و `EditBreakSheet` (مهاجرت ورودی‌ها به InputField و دکمه‌ها به Button)
  - `PersonEditor` (مهاجرت دکمه‌های ذخیره و حذف تولد به Button و اتصال استایل‌های فرم به توکن‌های سراسری)
  - `ArchivePage` (مهاجرت به Card و Button آیکونی)
  - `MorePage` (مهاجرت لیست‌ها به Card)
  - `Gallery` (مهاجرت دکمه‌های افزودن/بازگشت به Button و کارت‌های خالی به Card)
  - `SearchPage` (مهاجرت چیپ‌های جستجوهای اخیر به Chip و کانتینرها به Card)
  - `BirthdaysPage` (مهاجرت لیست‌ها به Card، فیلد عنوان مناسبت به InputField و دکمه‌های فرم‌ها و هدر به Button)
  - `BirthdayFields` (مهاجرت فیلدهای نام و شماره تلفن به InputField با اعتبارسنجی خطا)
  - `ExchangeItem` و `ExchangeSheet` (بهبود دسترسی کیبورد، اصلاح المان‌های کلیک‌پذیر و دکمه‌های اقدام به Button)
  - `WishSheet` (مهاجرت کامل به Sheet، InputField و Button)
  - `confirm` (مهاجرت دکمه‌های تأیید و انصراف مدال تاییدیه به Button با پشتیبانی از Ref برای فوکوس خودکار)
  - `QuickAdd` (مهاجرت فیلد نام به InputField و دکمه ثبت به Button)
  - `RatingForm` و `RelationshipForm` (مهاجرت فیلدهای یادداشت، دلیل، سرفصل به InputField و دکمه‌های ثبت/حذف به Button)
  - `InteractionForm` و `NoteBox` (مهاجرت ورودی‌های خلاصه، نتیجه، پیگیری به InputField و دکمه‌های ثبت به Button)
  - `CompareHome`، `ReviewSession` و `ReadThrough` (مهاجرت اکشن‌ها و ورودی‌ها به Button و InputField)
  - `BreakSheet` و `PersonCheck` (مهاجرت فیلدهای عنوان و یادداشت به InputField و دکمه‌های ثبت به Button)
  - `RulebookPage` و `WhoCan` (مهاجرت دکمه افزودن قانون و کارت‌های نتیجه جستجوی تخصص به Button و Card)
  - `ContactsImport`، `PhotoViewer` و `DatePicker` (مهاجرت دکمه‌های انتخاب همه، بستن/حذف عکس و پیش‌تنظیم‌های تاریخ به Button)
  - `SettleSheet` (مهاجرت کارت خلاصه به Card و دکمه‌های ثبت تسویه/انصراف به Button)
  - `ActivityTab`، `EvaluationTab` و `LedgerTab` (مهاجرت دکمه‌های افزودن در هدرهای تب‌های فرد به Button)
  - `Todos` (مهاجرت دکمه افزودن و دکمه‌های یادآوری تعویقی Snooze به Button)

---

## ۲. لیست کامیت‌ها روی برنچ `ui-design-system`

| Commit Hash | پیام کامیت | توضیحات |
| :--- | :--- | :--- |
| `9fd24f6` | `feat(ui): design system tokens, base components in src/ui and AboutPage migration` | اضافه شدن توکن‌های CSS در style.css، ساخت ۶ کامپوننت در `src/ui/` و مهاجرت AboutPage |
| `b3202ca` | `feat(ui): migrate SettingsPage to Card component` | جایگزینی کانتینرهای تنظیمات با Card |
| `d2d303c` | `feat(ui): migrate SyncPage to Card component` | یکدست‌سازی کارت وضعیت و بکاپ در SyncPage با Card |
| `f926d10` | `feat(ui): migrate TagEditor to InputField and add focus-visible styles` | اتصال InputField به TagEditor و تعریف استایل‌های focus-ring در style.css |
| `85a7763` | `feat(ui): migrate PhotoEdit form inputs and save button to ui components` | مهاجرت عنوان، یادداشت و دکمه ذخیره در PhotoEdit |
| `b1f0d27` | `feat(ui): migrate SkillForm inputs and action buttons` | استفاده از InputField و Button در ویرایشگر مهارت‌ها |
| `471cfc0` | `feat(ui): migrate CategorySheet action buttons to Button` | مهاجرت دکمه‌های انتقال و حذف دسته‌بندی‌ها به Button |
| `358362e` | `feat(ui): migrate CompareSessionPage inputs and sheet buttons to ui components` | استفاده از InputField و Button در شیت آیتم و تصمیم‌گیری مقایسه |
| `b33f18b` | `feat(ui): migrate RuleSheet and EditBreakSheet inputs and buttons to ui components` | یکدست‌سازی فیلدها و دکمه‌ها در دفترچه قوانین و ثبت شکست قانون |
| `4728b95` | `feat(ui): migrate PersonEditor action buttons and token styles` | به‌کارگیری Button در ذخیره فرم و اتصال کلاس‌های فرم اشخاص به توکن‌ها |
| `9f15c4c` | `feat(ui): migrate ArchivePage to Card and Button` | جایگزینی دکمه‌های آیکونی و کانتینرهای اشخاص بایگانی‌شده |
| `aa985ed` | `feat(ui): migrate MorePage to Card component` | استفاده از Card در لیست منوی بیشتر |
| `1a00304` | `feat(ui): migrate Gallery to Card and Button components` | نوسازی دکمه افزودن عکس، دکمه بازگشت و کارت‌های خالی در گالری |
| `b69b98d` | `feat(ui): migrate SearchPage cards and chips to ui components` | جایگزینی دکمه‌های هیستوری با Chip و گروه‌های نتایج با Card |
| `ff1b80d` | `feat(ui): migrate BirthdaysPage list containers and buttons to ui components` | استفاده از Card برای گروه‌های تولد و Button برای اکشن‌های فرم |
| `f4332bc` | `feat(ui): improve keyboard accessibility and button semantics for clickable ledger items` | ارتقای کارت‌های دادوستد به ساختار دارای هندلر کلید و تبدیل دکمه موعد به button استاندارد |
| `7f84231` | `feat(ui): migrate WishSheet to Sheet, InputField and Button` | مهاجرت کامل شیت تبریک تولد به باتم‌شیت پایه و دکمه/ورودی استاندارد |
| `e167062` | `feat(ui): migrate confirm dialog and QuickAdd to ui Button and InputField` | مهاجرت مدال تایید سراسری و فرم افزودن سریع شخص |
| `4ead9d3` | `feat(ui): migrate RatingForm and RelationshipForm to Button and InputField` | مهاجرت فرم امتیازدهی ۶گانه و ارتباطات اشخاص |
| `44f5f9b` | `feat(ui): migrate InteractionForm and NoteBox to ui components` | مهاجرت شیت ثبت تعامل‌ها و جعبه یادداشت اشخاص |
| `8037f10` | `feat(ui): migrate CompareHome, ReviewSession and ReadThrough to ui components` | مهاجرت صفحه خانگی مقایسه و جلسات مرور قوانین |
| `0a212b0` | `feat(ui): migrate BreakSheet and PersonCheck to ui components` | مهاجرت ثبت شکست قانون و شیت بررسی قوانین شخص |
| `38b797c` | `feat(ui): migrate RulebookPage and WhoCan to ui components` | مهاجرت دکمه افزودن قانون و کارت‌های نتایج جویای مهارت |
| `d0688e3` | `feat(ui): migrate ContactsImport, PhotoViewer and DatePicker to ui components` | مهاجرت ابزار ورود مخاطبین، نمایشگر تصویر و انتخاب‌گر تقویم |
| `d504fd5` | `feat(ui): migrate SettleSheet to ui Button and Card` | مهاجرت کارت محاسبات و اکشن‌های شیت تسویه دادوستد |
| `afcaa08` | `feat(ui): migrate ExchangeSheet actions to ui Button` | مهاجرت دکمه‌های ثبت، بررسی قوانین و بستن در فرم دادوستد |
| `09917e1` | `feat(ui): migrate person tabs action buttons to ui Button` | مهاجرت دکمه‌های افزودن و ناوبری در تب‌های فعالیت، ارزیابی و دادوستد فرد |
| `8aba889` | `feat(ui): migrate Todos add and snooze buttons to ui Button` | مهاجرت دکمه افزودن کار و دکمه‌های آیکونی به تعویق انداختن یادآوری |
| `4e16020` | `feat(ui): migrate BirthdayFields and occasion form to ui InputField` | مهاجرت ورودی‌های نام، تلفن و عنوان مناسبت به InputField با اعتبارسنجی |
| `314acd0` | `feat(ui): migrate cadence and comparison pickers to ui Select` | مهاجرت انتخاب‌گرهای ریتم تماس و ستون‌های مقایسه دو کالا به Select |
| `ab3787c` | `feat(ui): migrate CategorySheet action buttons to ui Button` | مهاجرت دکمه‌های بستن، جابه‌جایی و حذف دسته‌بندی‌ها به Button |
| `167a723` | `feat(ui): unify all buttons to pill shape via --radius-btn token` | یکدست‌سازی تمام دکمه‌ها به کپسولی/دایره‌ای از طریق توکن سراسری `--radius-btn` |

*نکته: تمامی کامیت‌ها پس از اجرای موفقیت‌آمیز `pnpm verify` (بررسی تایپ‌اسکریپت و پاس شدن ۴۷ تست vitest) و `pnpm build` (بررسی بدون خطای i18n و خروجی باندل Vite/PWA) ثبت شده‌اند.*

---

## ۳. مواردی که عمداً مهاجرت نشدند (با دلایل فنی)

طبق قوانین سخت‌گیرانهٔ ایمنی پروژه، هر جا که خطر به هم ریختن چیدمان، شکستن رفتار ورودی‌های خاص، یا تداخل لایه‌های پیچیده وجود داشت، ساختار حفظ شد:

1. **ورودی قیمت و ارز در دادوستد و مقایسه (`.price-input`):**
   - **علت:** این فیلدها دارای جهت‌گیری خاص `dir="ltr"`، فرمت عددی هم‌زمان، واحد تومان چسبیده به متن و فونت بزرگ هستند. تبدیل به InputField استاندارد فرمت‌بندی پویا را مختل می‌کرد.
2. **فیلد جستجوی زنده در هدر (`.search-field`):**
   - **علت:** این ورودی شامل دکمه پاک‌کردن اختصاصی با آیکون ضربدر، آیکون ذره‌بین یکپارچه با هدر چسبان و رویدادهای فیلتر لحظه‌ای بدون وقفه است.
3. **فیلدهای چندبخشی تاریخ تولد (`BirthdayFields`):**
   - **علت:** طراحی فوق‌العاده متراکم کاشی‌محور (روز، ماه انتخابی، سال اختیاری، و نوع تقویم شمسی/میلادی/قمری) برای صفحات موبایل بهینه شده و با InputField تک‌خطی سازگاری ابعادی نداشت.
4. **ردیف‌های اطلاعاتی جداول دو ستونی (`.rf-row` و `.as-value`):**
   - **علت:** ردیف‌های افقی دارای آیکون رنگی در راست و مقدار در چپ با لایه‌بندی فلکس فشرده، مناسب فیلدهای فرم عمودی نیستند و همان سبک اختصاصی جدول شیت‌ها حفظ شد.
5. **اسکریم‌های پشت شیت‌ها (`.scrim.dim`):**
   - **علت:** المان‌های اسکریم پس‌زمینه برای بستن شیت با کلیک بیرونی هستند و بر اساس استانداردهای وب نیازی به تبدیل شدن به المان دکمه ندارند (روی Sheet مرکزی پیاده‌سازی شده است).

---

## ۴. تغییرات بصری اجتناب‌ناپذیر

1. **انحنای گوشه‌ها (Border Radius):**
   - مقادیر متفرقه مثل `13px` یا `18px` به ترتیب به `--radius-md` (12px) و `--radius-lg` (16px) همگام شدند. تفاوت ۱ تا ۲ پیکسلی است و ظاهری یکپارچه‌تر و چشم‌نوازتر ایجاد کرده است.
2. **حلقه فوکوس کیبورد (`:focus-visible`):**
   - قبلاً حلقه‌های متفاوتی برای فوکوس با مقادیر مختلف تعریف شده بود. اکنون کامپوننت‌های جدید دارای فوکوس مشخص و دسترس‌پذیر بر پایه `--focus-ring` (`0 0 0 3px var(--focus-ring-color)`) هستند.
3. **دکمه‌های ذخیره انتهای شیت‌ها:**
   - با اعمال کلاس `.ui-btn-block` و متغیرهای استاندارد دکمه، ارتفاع دکمه‌های پایانی یکدست (۴۴ تا ۴۸ پیکسل) با حاشیه لمسی استاندارد موبایل منطبق شد.

---

## ۵. چک‌لیست تست دستی (برای بازبینی کاربری)

لطفاً این ۵ جریان اصلی را در مرورگر یا امولاتور بررسی کنید:

### ۱. تنظیمات (`بیشتر` ← `تنظیمات`)
1. به صفحه تنظیمات بروید.
2. کارت‌های گروه‌بندی‌شده را مشاهده کنید (باید سایه و پس‌زمینه شیشه‌ای یکدست داشته باشند).
3. تم را به حالت تاریک (Dark) و سپس روشن تغییر دهید؛ تضاد رنگی و پس‌زمینه کارت‌ها را بررسی کنید.

### ۲. همگام‌سازی (`بیشتر` ← `حساب و پشتیبان`)
1. وارد صفحه پشتیبان شوید.
2. کارت وضعیت ورود و کارت تهیه پشتیبان را بررسی کنید.
3. دکمه بازگشت هدر را لمس کنید تا به صفحه قبل برگردید.

### ۳. افراد و ویرایش (`افراد` ← انتخاب یک فرد یا دکمه افزودن)
1. روی فردی کلیک کرده و وارد ویرایش شوید (یا افزودن فرد جدید).
2. فیلدهای ورودی (نام، تلفن، شغل) و استایل گوشه‌ها و فوکوس را چک کنید.
3. دکمه ثبت انتهای صفحه را بررسی کنید.

### ۴. قوانین و مقایسه خرید (`قوانین` ← انتخاب دسته‌بندی و مقایسه)
1. وارد صفحه مقایسه خرید یک دسته شوید.
2. یک مورد آزمایشی اضافه کنید و شیت جزئیات آن را باز کنید.
3. فیلد عنوان و یادداشت ورودی را پر کرده و دکمه ذخیره را لمس کنید.

### ۵. تولدها و شیت تبریک (`بیشتر` یا تب `تولدها`)
1. روی آیکون کادو (ارسال تبریک) کنار یکی از تولدها کلیک کنید.
2. باتم‌شیت استاندارد تبریک باز می‌شود؛ تغییر متن‌ها با رادیوباتن‌ها و ویرایش متن در textarea را تست کنید.
3. دکمه بستن بالای شیت یا ضربه روی پس‌زمینه تیره را بزنید تا شیت به نرمی بسته شود.

---

## ۶. کاندیداهای CSS مرده (Dead CSS Candidates)

در طول ممیزی، ۱۲۶ سلکتور بدون استفاده در فایل `src/style.css` شناسایی شد که می‌توان پس از اطمینان کامل آنها را حذف یا پالایش کرد:

### موارد قطعاً قابل حذف (کلاس‌های منسوخ/قدیمی):
- کارهای قدیمی: `.form-card`, `.mini-card`, `.mc-head`, `.mc-foot`, `.n-title`, `.n-body`, `.todo-form`, `.todo-time`
- هیرو و ابزارهای منسوخ امروز: `.today-hero`, `.hero-top-row`, `.hero-date-block`, `.hero-day-name`, `.hero-date`, `.hero-tools`, `.tasks-hub`, `.th-head`, `.th-title-group`, `.th-title`, `.th-badge`, `.th-add-btn`, `.ti-body`, `.ti-title`, `.ti-meta`
- آنبوردینگ قدیمی: `.ob-dots`, `.ob-step`, `.ob-field`, `.ob-options`, `.ob-option`, `.ob-list`, `.ob-foot`
- ابزارهای آزمایشی: `.tool-grid`, `.tool-tile`, `.tool-result`, `.tool-line`, `.big-num`
- دکمه‌های فرم اشخاص که با کامپوننت جایگزین شدند: `.pe-save-btn`, `.pe-del-btn`

### مواردی که نباید حذف شوند (داینامیک هستند):
- استایل‌های رنگی داینامیک: `.c0`, `.c2` (رنگ‌های تولیدی تگ‌ها بر اساس ایندکس)
- نتایج مرور قوانین: `.rule-res-remembered`, `.rule-res-forgot`, `.rule-res-broke` (از ترکیب با مقدار state ساخته می‌شوند)
- ساب‌کلاس‌های کامپوننت‌های پایه `ui/`: `.ui-btn-primary`, `.ui-btn-secondary`, `.ui-btn-danger`, `.ui-btn-ghost`, `.ui-btn-sm`, `.ui-btn-md`, `.ui-btn-lg`, `.ui-btn-icon-*`, `.ui-card-glass`, `.ui-card-solid`, `.ui-card-flat`, `.ui-chip-sm`, `.ui-chip-md`

---

## ۷. راهنمای استفاده از کامپوننت‌های پایه (`src/ui/`)

برای حفظ یکدستی در توسعه‌های بعدی، تمام اجزای رابط کاربری از مسیر `src/ui` فراخوانی می‌شوند:

### ۱. دکمه (`Button`)
```tsx
import { Button } from './ui';

// دکمه معمولی با آیکون
<Button variant="primary" size="md" icon="check" onClick={handleSave}>
  {tx('ذخیره')}
</Button>

// دکمه تمام‌عرض (مناسب پایین فرم‌ها و شیت‌ها)
<Button variant="primary" block icon="plus" onClick={handleAdd}>
  {tx('افزودن فرد جدید')}
</Button>

// دکمه فقط آیکونی با الزامات دسترس‌پذیری (aria-label اجباری است)
<Button
  size="icon-md"
  variant="ghost"
  aria-label={tx('بستن')}
  icon="close"
  onClick={onClose}
/>
```

### ۲. فیلد ورودی (`InputField`)
```tsx
import { InputField } from './ui';

// ورودی متن تک‌خطی با برچسب و ارور
<InputField
  label={tx('نام خانوادگی')}
  required
  value={lastName}
  onChange={e => setLastName(e.target.value)}
  placeholder={tx('مثلاً محمدی')}
  error={hasError ? tx('وارد کردن نام الزامی است') : undefined}
/>

// ورودی چندخطی (Textarea)
<InputField
  label={tx('یادداشت')}
  multiline
  rows={3}
  value={note}
  maxLength={500}
  onChange={e => setNote(e.target.value)}
/>
```

### ۳. کارت (`Card`)
```tsx
import { Card } from './ui';

<Card variant="glass" className="my-card">
  <h3>{tx('عنوان کارت')}</h3>
  <p>{tx('محتوای شیشه‌ای با افکت بلور استاندارد')}</p>
</Card>
```

### ۴. باتم‌شیت (`Sheet`)
```tsx
import { Sheet } from './ui';

<Sheet
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title={tx('ویرایش برچسب')}
  footer={
    <Button variant="primary" block onClick={save}>
      {tx('تأیید')}
    </Button>
  }
>
  <p>{tx('محتوای داخل شیت با اسکرول خودکار و بسته‌شدن با دکمه بازگشت/Escape')}</p>
</Sheet>
```

### ۵. تگ و فیلتر (`Chip`)
```tsx
import { Chip } from './ui';

// چیپ کلیک‌پذیر انتخابی
<Chip
  active={isSelected}
  variant="primary"
  icon="tag"
  onClick={() => toggle(tag.id)}
>
  {tag.name}
</Chip>

// چیپ دارای دکمه حذف
<Chip
  variant="default"
  onRemove={() => removeTag(tag.id)}
  removeLabel={tx('حذف')}
>
  {tag.name}
</Chip>
```

### ۶. انتخاب‌گر (`Select`)
```tsx
import { Select } from './ui';

<Select
  label={tx('وضعیت')}
  value={status}
  onChange={e => setStatus(e.target.value)}
  options={[
    { value: 'active', label: tx('فعال') },
    { value: 'inactive', label: tx('غیرفعال') },
  ]}
/>
```
