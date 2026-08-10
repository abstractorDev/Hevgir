import cron from 'node-cron';
import { getMessagesByTimeframe } from '../db/supabase.js';
import { summarizeDailyMessages } from './ai.js';
import { bot } from '../bot/index.js';
import { config } from '../config/env.js';

export function startCronJobs() {
	// اجرای کرون‌جاب هر روز ساعت ۲۳:۵۹
	// برای تست می‌توانید از "* * * * *" (هر دقیقه) استفاده کنید
	cron.schedule('59 23 * * *', async () => {
		console.log('⏳ Starting daily AI summarization...');

		try {
			const nowUnix = Math.floor(Date.now() / 1000);
			const yesterdayUnix = nowUnix - 24 * 60 * 60;

			const messages = await getMessagesByTimeframe(yesterdayUnix, nowUnix);

			if (messages.length === 0) {
				console.log('ℹ️ No messages to summarize today.');
				return;
			}

			await bot.api.sendMessage(
				config.ADMIN_ID,
				`🔄 در حال تحلیل ${messages.length} پیام از ۲۴ ساعت گذشته...`,
			);

			const summary = await summarizeDailyMessages(messages);

			if (summary) {
				await bot.api.sendMessage(
					config.ADMIN_ID,
					`📊 **خلاصه روزانه:**\n\n${summary}`,
					{ parse_mode: 'Markdown' },
				);
			} else {
				await bot.api.sendMessage(
					config.ADMIN_ID,
					'❌ خطا در تولید خلاصه روزانه توسط هوش مصنوعی.',
				);
			}
		} catch (error) {
			console.error('[-] Cron Job Error:', error);
		}
	});

	console.log('✅ Cron scheduler initialized.');
}
