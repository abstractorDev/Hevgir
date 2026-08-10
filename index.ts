import { Bot } from 'grammy';
// توجه: پسوند .js الزامی است، تایپ‌اسکریپت خودش فایل database.ts را پیدا می‌کند
import { saveMessage, type MessageRecord } from './database/database.js';

// در یک پروژه واقعی، توکن را در فایل env. قرار می‌دهیم.
// فعلاً برای محیط توسعه، توکن خود را اینجا جایگزین کنید.
const botToken = '8971516156:AAGheWkwpSDibdxxteJW3Zhb4ANNep8KBME';
const bot = new Bot(botToken);

// استفاده از فیلتر "message:text" تضمین می‌کند که این تابع فقط برای پیام‌های متنی اجرا می‌شود.
// در نتیجه، تایپ‌اسکریپت می‌فهمد که فیلد ctx.msg.text قطعاً وجود دارد (undefined نیست).
bot.on('message:text', (ctx) => {
	try {
		// استخراج داده‌ها از آبجکت کانتکس (ctx)
		// این کار دقیقاً شبیه استخراج داده از event.target در فرانت‌اند است
		const record: MessageRecord = {
			chat_id: ctx.msg.chat.id,
			message_id: ctx.msg.message_id,
			text: ctx.msg.text,
			timestamp: ctx.msg.date, // تلگرام زمان را به‌صورت Unix Epoch (ثانیه) می‌فرستد
		};

		// فراخوانی تابع ذخیره‌سازی
		saveMessage(record);

		// لاگ کردن برای اطمینان از صحت عملکرد در محیط توسعه
		console.log(
			`[+] Saved: Message ${record.message_id} from Chat ${record.chat_id}`,
		);
	} catch (error) {
		// اصل مهم سیستم‌های مبتنی بر رویداد (Event-driven):
		// هرگز اجازه ندهید خطای پردازش یک پیام (مثلاً پر شدن دیسک یا خطای دیتابیس)
		// باعث Crash کردن کل پردازش (Process) ربات شود.
		console.error(`[-] Failed to save message ${ctx.msg.message_id}:`, error);
	}
});

// هندل کردن رویدادهای غیرمنتظره در سطح ربات
bot.catch((err) => {
	console.error('Global Error in bot logic:', err);
});

// اجرای ربات
bot.start({
	onStart: (botInfo) => {
		console.log(
			`Bot @${botInfo.username} is running and connected to SQLite...`,
		);
	},
});
