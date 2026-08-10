# Hevgir (هەڤگر) - Telegram Context Aggregator

یک ربات تلگرامی با معماری ماژولار که پیام‌های یک گروه را رصد کرده، کانتکس و مفاهیم اصلی بحث را با استفاده از مدل‌های زبانی (LLM) تقطیر می‌کند و به‌صورت هفتگی/روزانه مقالات یا خلاصه‌های مرتبط را پیشنهاد می‌دهد.

طراحی شده با تایپ‌اسکریپت (Strict Mode & ESM)، پایگاه داده محلی SQLite و فریم‌ورک grammY.

## ویژگی‌های اصلی (Features)

- **Ingestion Pipeline ایدمپوتنت (Idempotent):** ذخیره امن پیام‌ها با `INSERT OR IGNORE` برای جلوگیری از خطای تحویل تکراری (Duplicate Delivery).
- **پاک‌سازی هوشمند متن:** فیلترینگ خودکار ایموجی‌ها و پیکتوگراف‌های یونیکد با Regex پیشرفته پیش از ذخیره‌سازی.
- **همگام‌سازی وضعیت (State Sync):** رهگیری رویدادهای `edited_message` و اعمال تغییرات در پایگاه داده.
- **کنترل دسترسی (RBAC):** ماشین وضعیت (State Machine) درون‌حافظه‌ای برای کنترل خواندن/نخواندن پیام‌ها با دستورات ادمین.
- **مانیتورینگ متمرکز:** سیستم لاگینگ دوگانه (کنسول + پی‌وی تلگرام) با قالب‌بندی زمان محلی.
- **هوش مصنوعی اگنوستیک (AI Agnostic):** ادغام با کتابخانه استاندارد OpenAI (پشتیبانی از OpenAI، مدل‌های متن‌باز Groq یا سرورهای محلی Ollama).

## معماری و تکنولوژی‌ها (Tech Stack)

- **Runtime:** Node.js (ESM)
- **Language:** TypeScript (Strict Mode)
- **Bot Framework:** [grammY](https://grammy.dev/)
- **Database:** [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (WAL Mode Enabled)
- **AI SDK:** `openai`
- **Task Scheduling:** `node-cron`

## ساختار پوشه‌ها (Project Structure)

\`\`\`text
src/
├── config/ # تنظیمات و متغیرهای محیطی ایزوله
├── db/ # لایه ارتباط با پایگاه داده (SQLite)
├── bot/ # منطق ربات تلگرام، فیلترها و ماشین وضعیت
├── services/ # منطق تجاری (هوش مصنوعی و زمان‌بندی)
├── utils/ # توابع کمکی خالص (Pure Functions)
└── main.ts # نقطه ورود اصلی برنامه (Entry Point)
\`\`\`

## راه‌اندازی (Installation & Setup)

۱. ریپازیتوری را کلون کنید و وابستگی‌ها را نصب نمایید:
\`\`\`bash
git clone https://github.com/YourUsername/hevgir.git
cd hevgir
npm install
\`\`\`

۲. فایل متغیرهای محیطی را ایجاد کنید:
\`\`\`bash
cp .env.example .env
\`\`\`

۳. فایل `.env` را با اطلاعات خود پر کنید:
\`\`\`env
BOT_TOKEN=your_telegram_bot_token
ADMIN_ID=123456789
AI_API_KEY=your_llm_api_key
\`\`\`

۴. ربات را در محیط توسعه اجرا کنید:
\`\`\`bash
npm run dev
\`\`\`

## دستورات ادمین (Admin Commands)

ربات فقط به این دستورات در چت خصوصی (Private Chat) با ادمین مشخص‌شده در `.env` واکنش نشان می‌دهد:

- `/pause` - توقف فرآیند خواندن و ذخیره پیام‌های گروه
- `/resume` - از سرگیری مجدد فرآیند ذخیره‌سازی
- `/status` - مشاهده وضعیت فعلی موتور خوانش

## نقشه راه (Roadmap)

- [x] جداسازی پیکربندی و ایمن‌سازی کلیدها
- [x] ری‌فکتور ساختار به معماری لایه‌ای
- [x] پیاده‌سازی گارد وضعیت (State Guards)
- [ ] طراحی الگوریتم Chunking برای مدیریت محدودیت Tokenها در LLM
- [ ] مهاجرت دیتابیس به بستر Cloud (مانند Cloudflare D1 یا Supabase)
- [ ] استقرار روی محیط Serverless

## مجوز (License)

این پروژه تحت لایسنس [MIT](LICENSE) منتشر شده است.
