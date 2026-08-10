import { webhookCallback } from 'grammy';
import { bot } from '../src/bot/index.js';

// Vercel به‌صورت خودکار Body درخواست‌ها را پارس می‌کند (مانند Express).
// بنابراین از آداپتور "express" استفاده می‌کنیم تا grammY بداند نیازی به پارس مجدد نیست.
export default webhookCallback(bot, 'express');
