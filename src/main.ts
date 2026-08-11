import { bot } from './bot/index.js';
import { config } from './config/env.js';
import http from 'http';
import { startCronJobs } from './services/scheduler.js';

async function bootstrap() {
	console.log('Starting services...');

	try {
		await bot.api.setMyCommands([
			// --- دستورات عمومی ربات ---
			{ command: 'pause', description: 'توقف خواندن و ذخیره پیام‌ها' },
			{ command: 'resume', description: 'از سرگیری خواندن پیام‌ها' },
			{ command: 'status', description: 'مشاهده وضعیت فعلی ربات' },

			// --- دستورات مدیریت دسترسی (RBAC) ---
			{ command: 'grant', description: '[ادمین] اعطای دسترسی (ریپلای)' },
			{ command: 'revoke', description: '[ادمین] لغو دسترسی (ریپلای)' },
			{ command: 'grantall', description: '[ادمین] باز کردن دسترسی برای همه' },
			{ command: 'revokeall', description: '[ادمین] بستن دسترسی عمومی' },
			{ command: 'accesslist', description: '[ادمین] مشاهده لیست افراد مجاز' },

			// --- دستورات مدیریت داده‌ها (Moderation) ---
			{
				command: 'ignore',
				description: '[ادمین] عدم ثبت پیام‌های کاربر (ریپلای)',
			},
			{
				command: 'unignore',
				description: '[ادمین] لغو عدم ثبت کاربر (ریپلای)',
			},
			{
				command: 'stats',
				description: '[ادمین] مشاهده تعداد پیام‌های کاربر (ریپلای)',
			},
			{ command: 'start', description: 'معرفی ربات' },
			{ command: 'help', description: 'راهنمای تمام دستورات' },
			{ command: 'users', description: 'وضعیت و آمار پیام‌های کاربران' },
			{ command: 'del', description: '[ادمین] حذف پیام از دیتابیس (ریپلای)' },
			{
				command: 'delelte',
				description: '[ادمین] حذف N پیام آخر (مثال: /delete 30)',
			},
		]);
		console.log('✅ Command menu injected to Telegram.');
	} catch (error) {
		console.error('[-] Failed to set command menu:', error);
	}

	// روشن کردن ربات
	bot.start({
		onStart: async (botInfo) => {
			console.log(`✅ Bot @${botInfo.username} running via Long Polling.`);
			await bot.api.sendMessage(
				config.ADMIN_ID,
				`🟢 سیستم روی کانتینر ابری با موفقیت مستقر شد.`,
			);
		},
	});

	// ==========================================
	// وب‌سرور مصنوعی برای ارضای Health Check سرور ابری
	// ==========================================
	// متغیر PORT معمولاً از سمت سرور ابری به صورت استرینگ پاس داده می‌شود
	const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

	http
		.createServer((_, res) => {
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end('Bot is running securely.');
		})
		.listen(port, '0.0.0.0', () => {
			// عبارت "0.0.0.0" در معماری داکر حیاتی است
			console.log(`✅ Health check server listening on 0.0.0.0:${port}`);
		});

	// راه‌اندازی سیستم زمان‌بندی (Cron)
	startCronJobs();
}

process.on('unhandledRejection', (err) => {
	console.error('Unhandled Rejection:', err);
});

bootstrap();
