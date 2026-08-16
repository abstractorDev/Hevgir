import cron from 'node-cron';
import { getMessagesByTimeframe } from '../db/supabase.js';
import { runDailyAnalysisPipeline } from './ai.js';
import { bot } from '../bot/index.js';
import { config } from '../config/env.js';

/**
 * تابع کمکی برای شکستن ایمن پیام‌های طولانی بر اساس پاراگراف
 * تا فرمت‌بندی Markdown تلگرام دچار خطا نشود.
 */
async function sendLongMessage(chatId: string | number, text: string) {
	const MAX_LENGTH = 4000;
	let currentChunk = '';

	const paragraphs = text.split('\n\n');

	for (const paragraph of paragraphs) {
		if (currentChunk.length + paragraph.length + 2 > MAX_LENGTH) {
			await bot.api.sendMessage(chatId, currentChunk.trim(), {
				parse_mode: 'Markdown',
			});
			currentChunk = paragraph + '\n\n';
		} else {
			currentChunk += paragraph + '\n\n';
		}
	}

	if (currentChunk.trim().length > 0) {
		await bot.api.sendMessage(chatId, currentChunk.trim(), {
			parse_mode: 'Markdown',
		});
	}
}

export function startCronJobs() {
	cron.schedule('59 23 * * *', async () => {
		console.log('⏳ Starting daily Map-Reduce AI summarization...');

		try {
			const nowUnix = Math.floor(Date.now() / 1000);
			const yesterdayUnix = nowUnix - 24 * 60 * 60;

			const messages = await getMessagesByTimeframe(yesterdayUnix, nowUnix);

			if (messages.length === 0) return;

			// استخراج آیدی گروه از اولین پیام موجود در دیتابیس
			const groupId = messages[0].chat_id;

			// ۱. ارسال پیام شروع پردازش به گروه (به جای پی‌وی)
			await bot.api.sendMessage(
				groupId,
				`🔄 آغاز پردازش عمیق ${messages.length} پیام با معماری Hybrid AI...`,
			);

			const finalReport = await runDailyAnalysisPipeline(messages);

			if (finalReport) {
				// ۲. ارسال گزارش نهایی به پی‌وی ادمین با استفاده از الگوریتم Chunking پاراگراف‌ها
				await sendLongMessage(
					config.ADMIN_ID,
					`🧠 **تحلیل و پیشنهاد امروز:**\n\n${finalReport}`,
				);
			}
			if (finalReport) {
				// ۲. ارسال گزارش نهایی به گروه (تغییر یافته از ADMIN_ID به groupId)
				await sendLongMessage(
					groupId,
					`🧠 **تحلیل و پیشنهاد امروز:**\n\n${finalReport}`,
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
}
