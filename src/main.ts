import { bot } from './bot/index.js';
import { config } from './config/env.js';
// import { startCronJobs } from "./services/scheduler.js";

async function bootstrap() {
	console.log('Starting services...');

	// راه‌اندازی ربات
	bot.start({
		onStart: async (botInfo) => {
			console.log(`✅ Bot @${botInfo.username} initialized.`);
			await bot.api.sendMessage(
				config.ADMIN_ID,
				`🟢 سیستم با معماری جدید با موفقیت راه‌اندازی شد.`,
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
