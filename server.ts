import express from 'express';
import { config } from './src/config/env.js';
import { handleTelegramWebhook } from './src/bot/webhook.js';
import './src/main.js'; // اجرای تنظیمات اولیه ربات

const app = express();
const PORT = process.env.PORT || 3000;

// خواندن بدنه درخواست‌های JSON که از تلگرام می‌آیند
app.use(express.json());

// تعریف مسیر (Endpoint) وب‌هوک
// تلگرام به این آدرس درخواست POST می‌فرستد
app.post(`/webhook/${config.BOT_TOKEN}`, handleTelegramWebhook);

app.listen(PORT, () => {
	console.log(`🚀 Webhook server is running on port ${PORT}`);
});
