import cron from 'node-cron';
import { getMessagesByTimeframe } from '../src/db/supabase.js';
import { summarizeDailyMessages } from './ai.js';

export function startCronJobs(notifyAdmin: (msg: string) => void) {
	// این عبارت کرون (0 0 * * *) یعنی: "هر روز ساعت 00:00 (نیمه‌شب) اجرا شود"
	// برای تست می‌توانید از "* * * * *" (هر یک دقیقه) استفاده کنید.
	cron.schedule('0 0 * * *', async () => {
		notifyAdmin('⏳ آغاز پردازش روزانه پیام‌ها...');

		const now = Math.floor(Date.now() / 1000);
		const yesterday = now - 24 * 60 * 60;

		const messages = getMessagesByTimeframe(yesterday, now);

		if (messages.length === 0) {
			notifyAdmin('ℹ️ امروز هیچ پیامی برای پردازش وجود نداشت.');
			return;
		}

		notifyAdmin(`🔄 در حال تحلیل ${messages.length} پیام...`);
		const summary = await summarizeDailyMessages(messages);

		if (summary) {
			// در مراحل بعد، این خلاصه را در دیتابیس (در یک جدول جدید) ذخیره می‌کنیم
			// فعلاً برای مانیتورینگ، آن را به پی‌وی ادمین می‌فرستیم
			notifyAdmin(`✅ خلاصه امروز:\n\n${summary}`);
		} else {
			notifyAdmin('❌ خطا در تولید خلاصه روزانه توسط هوش مصنوعی.');
		}
	});

	console.log('Cron scheduler started.');
}
