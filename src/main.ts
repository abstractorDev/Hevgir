import { bot } from './bot/index.js';
import { config } from './config/env.js';
// import { startCronJobs } from "./services/scheduler.js";

async function bootstrap() {
	console.log('Starting services...');

	try {
		// تزریق منوی دستورات به سرور تلگرام
		await bot.api.setMyCommands([
			// دستورات عمومی ربات
			{ command: 'pause', description: 'توقف خواندن و ذخیره پیام‌ها' },
			{ command: 'resume', description: 'از سرگیری خواندن پیام‌ها' },
			{ command: 'status', description: 'مشاهده وضعیت فعلی ربات' },

			// دستورات مختص مدیر کل
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

	bot.start({
		onStart: async (botInfo) => {
			console.log(`✅ Bot @${botInfo.username} initialized.`);
			await bot.api.sendMessage(
				config.ADMIN_ID,
				`🟢 سیستم با معماری جدید با موفقیت راه‌اندازی شد. \n 🟢 ربات با قابلیت منوی گروه روشن شد.`,
			);
		},
	});

	// راه‌اندازی زمان‌بندی هوش مصنوعی (فعلاً کامنت شده تا در فازهای بعدی تنظیم شود)
	// startCronJobs();
}

// مدیریت خطاهای پیش‌بینی نشده در سطح پردازش نود
process.on('unhandledRejection', (err) => {
	console.error('Unhandled Rejection:', err);
});

bootstrap();
