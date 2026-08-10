import { Bot } from 'grammy';
import { config } from '../config/env.js';
import { stripEmojis } from '../utils/text.js';
import { saveMessage, updateMessage, deleteMessage } from '../db/sqlite.js';
import type { MessageRecord } from '../db/sqlite.js';
import { botState } from './state.js';

export const bot = new Bot(config.BOT_TOKEN);

/**
 * سیستم متمرکز ارسال لاگ به ادمین و ترمینال
 * @param {string} action - نوع عملیات (مثلاً "+ ذخیره")
 * @param {any} ctx - کانتکس تلگرام برای استخراج اطلاعات گروه
 * @param {number} messageId - شناسه پیام
 * @param {string} [extraInfo] - اطلاعات اضافه اختیاری
 */
export async function notifyAdmin(
	action: string,
	ctx: any,
	messageId: number,
	extraInfo: string = '',
) {
	const chatTitle =
		ctx.chat && 'title' in ctx.chat ? ctx.chat.title : 'پی‌وی/ناشناس';
	const timeString = new Date().toLocaleTimeString('fa-IR', { hour12: false });
	const logMessage = `[${timeString}] [${action}] در گروه "${chatTitle}": پیام ${messageId} ${extraInfo}`;

	console.log(logMessage);
	try {
		await bot.api.sendMessage(config.ADMIN_ID, logMessage);
	} catch (error) {
		console.error('[-] Failed to send log to admin.', error);
	}
}

// ==========================================
// بخش دستورات کنترلی ادمین (Admin Router)
// ==========================================

// ساخت یک ساب‌روتر (Sub-router) که فقط به پیام‌های پی‌وی ادمین واکنش نشان می‌دهد
const adminOnly = bot.filter(
	(ctx) => ctx.from?.id === config.ADMIN_ID && ctx.chat?.type === 'private',
);

adminOnly.command('pause', async (ctx) => {
	if (!botState.isReading) {
		return ctx.reply('⚠️ ربات از قبل در حالت توقف قرار داشت.');
	}
	botState.isReading = false;
	await ctx.reply('⏸️ خواندن و ذخیره پیام‌های گروه متوقف شد.');
});

adminOnly.command('resume', async (ctx) => {
	if (botState.isReading) {
		return ctx.reply('⚠️ ربات از قبل در حال خواندن پیام‌ها بود.');
	}
	botState.isReading = true;
	await ctx.reply('▶️ خواندن و ذخیره پیام‌های گروه از سر گرفته شد.');
});

adminOnly.command('status', async (ctx) => {
	const statusStr = botState.isReading
		? '🟢 فعال (در حال خواندن)'
		: '🔴 متوقف (نمی‌خواند)';
	await ctx.reply(`وضعیت فعلی ربات: ${statusStr}`);
});

// ثبت رویدادها
bot.on('message:text', async (ctx) => {
	// گارد وضعیت: اگر ربات متوقف شده است، پیام را کلاً نادیده بگیر و خارج شو
	if (!botState.isReading) return;

	const cleanText = stripEmojis(ctx.msg.text);
	if (!cleanText) return;

	const senderName = ctx.msg.from?.last_name
		? `${ctx.msg.from.first_name} ${ctx.msg.from.last_name}`
		: ctx.msg.from?.first_name || 'Unknown';

	const record: MessageRecord = {
		chat_id: ctx.msg.chat.id,
		message_id: ctx.msg.message_id,
		text: cleanText,
		timestamp: ctx.msg.date,
		sender_name: senderName,
	};

	saveMessage(record);
	await notifyAdmin(
		'+ ذخیره',
		ctx,
		record.message_id,
		`توسط ${record.sender_name}`,
	);
});

bot.on('edited_message:text', async (ctx) => {
	// گارد وضعیت برای ویرایش‌ها
	if (!botState.isReading) return;

	const cleanText = stripEmojis(ctx.editedMessage.text);
	if (!cleanText) {
		deleteMessage(ctx.editedMessage.chat.id, ctx.editedMessage.message_id);
		await notifyAdmin(
			'- حذف (خالی شدن متنی)',
			ctx,
			ctx.editedMessage.message_id,
		);
		return;
	}
	updateMessage(
		ctx.editedMessage.chat.id,
		ctx.editedMessage.message_id,
		cleanText,
	);
	await notifyAdmin('~ ویرایش', ctx, ctx.editedMessage.message_id);
});

bot.catch((err) => console.error('Global Error in bot:', err));
