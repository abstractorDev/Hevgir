# Hevgir (هەڤگر) - Telegram Context Aggregator & AI Synthesizer

یک ربات تلگرامی پیشرفته با معماری ابری و هوش مصنوعی دوگانه (Hybrid AI) که مکالمات گروه‌های تلگرامی را رصد کرده، کانتکس و مفاهیم اصلی بحث را تقطیر می‌کند و به‌صورت روزانه مقالات یا کتاب‌های متناسب با نیاز فکری گروه پیشنهاد می‌دهد.

## 🌟 ویژگی‌های کلیدی (Key Features)

- **پایپ‌لاین هوش مصنوعی Map-Reduce (معماری Hybrid):**
  - **مرحله Map:** استفاده از **Groq (Llama-3)** برای پردازش سریع و ارزانِ بلوک‌های متنی (Chunking) و استخراج مفاهیم میانی.
  - **مرحله Reduce:** تقطیر نهایی، آسیب‌شناسی طرز فکر و ارائه پیشنهاد مطالعاتی توسط **OpenAI (GPT-4o)**.
- **پایگاه داده ابری (Supabase):** ذخیره‌سازی کاملاً Asynchronous با استفاده از PostgreSQL. پشتیبانی از SQL Views برای تحلیل سریع آمار کاربران.
- **سیستم کنترل دسترسی مبتنی بر نقش (RBAC):** تفکیک دقیق سطوح دسترسی شامل مدیر کل (Root Admin)، کاربران مجاز (Authorized) و کاربران عادی (Public).
- **پنل مدیریت تعاملی (Interactive UI):** منوی شیشه‌ای (Inline Keyboard) پویا بر اساس سطح دسترسی کاربر برای مدیریت سیستم بدون نیاز به تایپ دستورات.
- **ابزارهای مدیریت داده (Moderation):** بلک‌لیست کاربران (`/ignore`)، حذف تکی (`/del`)، حذف گروهی (`/delete N`) و پاکسازی ایمن دیتابیس (`/cleardb`) همراه با تاییدیه دومرحله‌ای.
- **فیلترینگ هوشمند:** نادیده گرفتن خودکار پیام‌های سایر ربات‌ها، ریپلای به ربات‌ها و کامندها برای تمیز نگه داشتن کانتکس هوش مصنوعی.
- **استقرار کانتینری (Dockerized):** آماده برای استقرار روی پلتفرم‌های ابری (PaaS) مانند Back4App، Liara و Render مجهز به وب‌سرور مصنوعی برای جلوگیری از خطای Health Check.

## 🛠 معماری و تکنولوژی‌ها (Tech Stack)

- **Runtime:** Node.js (ESM)
- **Language:** TypeScript (Strict Mode)
- **Bot Framework:** [grammY](https://grammy.dev/)
- **Database:** [Supabase](https://supabase.com/) (PostgreSQL)
- **AI SDK:** `openai` (متصل به Groq API و OpenAI API)
- **Task Scheduling:** `node-cron`
- **Deployment:** Docker

## ⚙️ نصب و راه‌اندازی (Installation)

۱. ریپازیتوری را کلون کنید:

```bash
git clone [https://github.com/YourUsername/your-repo-name.git](https://github.com/YourUsername/your-repo-name.git)
cd your-repo-name

```

۲. وابستگی‌ها را نصب کنید:

```bash
npm install

```

۳. فایل متغیرهای محیطی را ایجاد و تنظیم کنید:

```bash
cp .env.example .env

```

نمونه فایل `.env`:

```env
BOT_TOKEN=your_telegram_bot_token
ADMIN_ID=your_numeric_telegram_id
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key

```

۴. اجرای ربات در محیط توسعه (Local):

```bash
npm run dev

```

## 📚 راهنمای دستورات (Commands)

سیستم از کلمات کلیدی متنی (مثل تایپ کردن کلمه "پنل") و دستورات اسلش‌دار پشتیبانی می‌کند.

### دستورات عمومی (همه کاربران)

- `/panel` یا `پنل` - 🎛 باز کردن پنل مدیریت پویا
- `/users` - 👥 تابلوی وضعیت و آمار فعالیت کاربران (Top 20)
- `/stats` - 📊 آمار کل پیام‌های یک فرد (ریپلای کنید یا خالی بفرستید)
- `/status` یا `وضعیت` - 🤖 وضعیت فعلی موتور خوانش هوش مصنوعی
- `/help` یا `راهنما` - 📖 نمایش راهنمای دستورات
- `/start` - 🚀 معرفی و راه‌اندازی اولیه ربات

### کاربران مجاز (Authorized)

- `/pause` - ⏸ توقف پردازش و ثبت پیام‌های گروه
- `/resume` - ▶️ از سرگیری پردازش پیام‌ها

### مدیر کل (Root Admin)

- `/grant` و `/revoke` - 🔑 اعطا یا لغو دسترسی یک کاربر (با ریپلای)
- `/grantall` و `/revokeall` - 🌐 مدیریت دسترسی عمومی سیستم
- `/accesslist` - 📋 مشاهده لیست کاربران مجاز
- `/ignore` و `/unignore` - 🚫 ورود/خروج کاربر به لیست سیاه (عدم ثبت پیام در دیتابیس)
- `/del` - 🗑 حذف یک پیام مشخص از دیتابیس هوش مصنوعی (با ریپلای)
- `/delete N` - ✂️ حذف گروهی N پیام اخیر (مثال: `/delete 30`)
- `/cleardb` - 🧹 پاکسازی کامل تاریخچه گروه (همراه با تاییدیه امنیتی شیشه‌ای)

## 🚀 استقرار در فضای ابری (Deployment)

این پروژه دارای `Dockerfile` بهینه‌شده است. برای استقرار روی پلتفرم‌های ابری (مانند Back4App):

1. ریپازیتوری را به اکانت گیت‌هاب پلتفرم ابری خود متصل کنید.
2. متغیرهای محیطی (`.env`) را در داشبورد پلتفرم وارد کنید.
3. سرویس به‌صورت خودکار وابستگی‌ها را نصب (`npm install`) و با کامند `npm start` اجرا می‌شود.
4. _نکته:_ برای جلوگیری از به خواب رفتن سرورهای رایگان (Sleep mode)، آدرس وب‌سرور کانتینر را در سرویس‌هایی مثل UptimeRobot تنظیم کنید تا هر ۵ دقیقه پینگ شود.

## 📄 مجوز (License)

این پروژه تحت لایسنس [MIT](https://www.google.com/search?q=LICENSE) منتشر شده است.
