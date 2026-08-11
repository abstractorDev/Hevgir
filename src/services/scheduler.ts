import cron from 'node-cron';
import { getMessagesByTimeframe } from '../db/supabase.js';
import { runDailyAnalysisPipeline } from './ai.js';
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
				`🔄 آغاز پردازش عمیق ${messages.length} پیام با معماری Hybrid AI...`,
			);

			const finalReport = await runDailyAnalysisPipeline(messages);

			if (finalReport) {
				// به دلیل طولانی بودن احتمالی گزارش، آن را ارسال می‌کنیم
				await bot.api.sendMessage(
					config.ADMIN_ID,
					`🧠 **تحلیل و پیشنهاد امروز:**\n\n${finalReport}`,
					{ parse_mode: 'Markdown' },
				);
			}
		} catch (error) {
			console.error('[-] Cron Job Error:', error);
			await bot.api.sendMessage(
				config.ADMIN_ID,
				'❌ خطای سیستمی در اجرای پایپ‌لاین هوش مصنوعی.',
			);
		}
	});

	console.log('✅ Cron scheduler initialized.');
}
