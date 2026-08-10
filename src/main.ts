import { bot } from './bot/index.js';
import { config } from './config/env.js';
import http from 'http'; // ماژول بومی نود.جی‌اس

async function bootstrap() {
	console.log('Starting services...');

	try {
		await bot.api.setMyCommands([
			// ... (دستوراتی که در مراحل قبل نوشتیم)
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
	const port = process.env.PORT || 3000;
	http
		.createServer((_, res) => {
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end('Bot is running securely.');
		})
		.listen(port, () => {
			console.log(`✅ Health check server listening on port ${port}`);
		});
}

process.on('unhandledRejection', (err) => {
	console.error('Unhandled Rejection:', err);
});

bootstrap();
