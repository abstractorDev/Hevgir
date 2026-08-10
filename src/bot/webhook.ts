import { webhookCallback } from 'grammy';
import { bot } from './index.js';

/**
 * مدیریت‌کننده وب‌هوک برای ارتباط با سرورهای ابری (مثل Vercel)
 * این تابع درخواست‌های HTTP پستی که از تلگرام می‌آیند را پردازش می‌کند.
 */
export const handleTelegramWebhook = webhookCallback(bot, 'express');
// نکته: اگر از فریم‌ورک دیگری مثل Hono یا Fastify استفاده می‌کنید، پارامتر دوم را تغییر دهید.
