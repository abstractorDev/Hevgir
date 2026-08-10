import { Bot } from 'grammy';
// توجه: پسوند .js الزامی است، تایپ‌اسکریپت خودش فایل database.ts را پیدا می‌کند
import {
	saveMessage,
	updateMessage,
	deleteMessage,
	type MessageRecord,
} from './database/database.js';

// در یک پروژه واقعی، توکن را در فایل env. قرار می‌دهیم.
// فعلاً برای محیط توسعه، توکن خود را اینجا جایگزین کنید.
const botToken = '8971516156:AAGheWkwpSDibdxxteJW3Zhb4ANNep8KBME';
const bot = new Bot(botToken);

// تابع خالص (Pure Function) برای حذف ایموجی‌ها
function stripEmojis(text: string): string {
	return (
		text
			// حذف تمام کاراکترهایی که ماهیت ایموجی یا پیکتوگراف دارند
			.replace(
				/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Component}]/gu,
				'',
			)
			// حذف فاصله‌های اضافی که ممکن است بعد از پاک شدن ایموجی‌ها باقی بماند
			.replace(/\s+/g, ' ')
			.trim()
	);
}

// استفاده از فیلتر "message:text" تضمین می‌کند که این تابع فقط برای پیام‌های متنی اجرا می‌شود.
// در نتیجه، تایپ‌اسکریپت می‌فهمد که فیلد ctx.msg.text قطعاً وجود دارد (undefined نیست).
bot.on('message:text', (ctx) => {
	try {
		const rawText = ctx.msg.text;
		const cleanText = stripEmojis(rawText);

		// اگر پیام فقط حاوی ایموجی بوده و حالا خالی شده است، آن را ذخیره نکن
		if (!cleanText) return;

		// استخراج نام کامل فرستنده (اگر نام خانوادگی نداشت، فقط نام کوچک)
		const senderName = ctx.msg.from?.last_name
			? `${ctx.msg.from.first_name} ${ctx.msg.from.last_name}`
			: ctx.msg.from?.first_name || 'Unknown';

		// استخراج داده‌ها از آبجکت کانتکس (ctx)
		// این کار دقیقاً شبیه استخراج داده از event.target در فرانت‌اند است
		const record: MessageRecord = {
			chat_id: ctx.msg.chat.id,
			message_id: ctx.msg.message_id,
			text: cleanText, // متن پاک‌سازی‌شده
			timestamp: ctx.msg.date,
			sender_name: senderName,
		};

		// فراخوانی تابع ذخیره‌سازی
		saveMessage(record);
		console.log(
			`[+] Saved: Message ${record.message_id} from Chat ${record.chat_id} by ${record.sender_name}`,
		);

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
// هندلر ویرایش پیام
bot.on('edited_message:text', (ctx) => {
	try {
		const cleanText = stripEmojis(ctx.editedMessage.text);

		// اگر پیام ویرایش‌شده خالی شد (مثلاً فقط ایموجی ماند)، کلاً آن را از DB پاک کن
		if (!cleanText) {
			deleteMessage(ctx.editedMessage.chat.id, ctx.editedMessage.message_id);
			console.log(
				`[*] Deleted (became empty): Message ${ctx.editedMessage.message_id}`,
			);
			return;
		}

		updateMessage(
			ctx.editedMessage.chat.id,
			ctx.editedMessage.message_id,
			cleanText,
		);
		console.log(`[~] Updated: Message ${ctx.editedMessage.message_id}`);
	} catch (error) {
		console.error(
			`[-] Failed to update message ${ctx.editedMessage?.message_id}:`,
			error,
		);
	}
});

// هندلر حذف پیام توسط سرویس‌های تلگرام
// در تلگرام وقتی پیامی در گروه پاک می‌شود، رویداد اختصاصی ندارد
// اما فریم‌ورک‌های ربات از یک سرویس داخلی آپدیت تلگرام استفاده می‌کنند
bot.on('message', (ctx, next) => {
	// این یک میدلور (Middleware) ساده است.
	// متأسفانه تلگرام برای پیام‌های حذف‌شده عادیِ کاربران (اگر ربات ادمین نباشد)
	// رویدادی نمی‌فرستد. اما اگر ربات خودش یا ادمین‌ها پیامی را پاک کنند،
	// این رویداد در آپدیت‌ها وجود دارد.
	return next();
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
