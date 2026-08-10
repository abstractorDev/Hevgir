import { bot } from './bot/index.js';
import { config } from './config/env.js';

async function bootstrap() {
	console.log('Starting services...');

	try {
		await bot.api.setMyCommands([
			{ command: 'pause', description: 'توقف خواندن و ذخیره پیام‌ها' },
			{ command: 'resume', description: 'از سرگیری خواندن پیام‌ها' },
			{ command: 'status', description: 'مشاهده وضعیت فعلی ربات' },
			{
				command: 'grant',
				description: '[ادمین] اعطای دسترسی (ریپلای روی کاربر)',
			},
			{
				command: 'revoke',
				description: '[ادمین] لغو دسترسی (ریپلای روی کاربر)',
			},
			{ command: 'grantall', description: '[ادمین] باز کردن دسترسی برای همه' },
			{ command: 'revokeall', description: '[ادمین] بستن دسترسی عمومی' },
			{ command: 'accesslist', description: '[ادمین] مشاهده لیست افراد مجاز' },
		]);
		console.log('✅ Command menu injected to Telegram.');
	} catch (error) {
		console.error('[-] Failed to set command menu:', error);
	}

	// معماری دوگانه (Dual Architecture)
	// متغیر محیطی VERCEL_ENV توسط خود پلتفرم Vercel تزریق می‌شود
	const isServerless =
		process.env.VERCEL_ENV === 'production' ||
		process.env.NODE_ENV === 'production';

	if (!isServerless) {
		// اجرا در محیط توسعه (Local)
		bot.start({
			onStart: async (botInfo) => {
				console.log(
					`✅ [Local Mode] Bot @${botInfo.username} running via Long Polling.`,
				);
			},
		});
	} else {
		// اجرا در محیط ابری (Serverless)
		console.log(
			`✅ [Cloud Mode] Bot initialized. Waiting for Webhook requests...`,
		);
	}
}

process.on('unhandledRejection', (err) => {
	console.error('Unhandled Rejection:', err);
});

bootstrap();
