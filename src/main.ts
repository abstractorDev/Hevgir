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

	// اجرای مستقیم و بی‌قیدوشرط ربات
	bot.start({
		onStart: async (botInfo) => {
			console.log(`✅ Bot @${botInfo.username} running via Long Polling.`);
			// پیام اطلاع‌رسانی به ادمین هنگام روشن شدن کانتینر
			await bot.api.sendMessage(
				config.ADMIN_ID,
				`🟢 سیستم روی کانتینر ابری با موفقیت مستقر شد.`,
			);
		},
	});
}

process.on('unhandledRejection', (err) => {
	console.error('Unhandled Rejection:', err);
});

bootstrap();
