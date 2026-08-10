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

// ==========================================
// بخش مدیریت سطوح دسترسی (Access Control)
// ==========================================

// بررسی مدیر کل (فقط شما)
const isRootAdmin = (userId?: number) => userId === config.ADMIN_ID;

// بررسی کاربران مجاز (شما + عموم + لیست ویژه)
const isAuthorized = (userId?: number) => {
	if (!userId) return false;
	if (isRootAdmin(userId)) return true; // ادمین همیشه مجاز است
	if (botState.isPublicAccess) return true; // اگر دسترسی عمومی باز باشد
	return botState.authorizedUsers.has(userId); // اگر در لیست ویژه باشد
};

const rootAdminOnly = bot.filter((ctx) => isRootAdmin(ctx.from?.id));
const authorizedUsersOnly = bot.filter((ctx) => isAuthorized(ctx.from?.id));

// ==========================================
// دستورات مدیر کل (مدیریت دسترسی‌ها)
// ==========================================

rootAdminOnly.command('grantall', async (ctx) => {
	botState.isPublicAccess = true;
	await ctx.reply(
		'🔓 دسترسی به دستورات ربات برای **تمامی کاربران** این گروه باز شد.',
		{ parse_mode: 'Markdown' },
	);
});

rootAdminOnly.command('revokeall', async (ctx) => {
	botState.isPublicAccess = false;
	await ctx.reply('🔒 دسترسی عمومی بسته شد. فقط کاربران تایید شده مجاز هستند.');
});

rootAdminOnly.command('grant', async (ctx) => {
	const target = ctx.msg.reply_to_message?.from;
	if (!target) {
		return ctx.reply(
			'⚠️ لطفاً این دستور را روی پیام کاربری که می‌خواهید دسترسی بگیرد، **ریپلای** کنید.',
		);
	}

	const name = target.first_name || 'کاربر';
	botState.authorizedUsers.set(target.id, name);
	await ctx.reply(`✅ دسترسی استفاده از ربات به «${name}» داده شد.`);
});

rootAdminOnly.command('revoke', async (ctx) => {
	const target = ctx.msg.reply_to_message?.from;
	if (!target) {
		return ctx.reply(
			'⚠️ لطفاً این دستور را روی پیام کاربری که می‌خواهید دسترسی‌اش لغو شود، **ریپلای** کنید.',
		);
	}

	if (botState.authorizedUsers.has(target.id)) {
		botState.authorizedUsers.delete(target.id);
		await ctx.reply(`❌ دسترسی «${target.first_name}» لغو شد.`);
	} else {
		await ctx.reply('این کاربر از قبل دسترسی نداشت.');
	}
});

rootAdminOnly.command('accesslist', async (ctx) => {
	if (botState.authorizedUsers.size === 0 && !botState.isPublicAccess) {
		return ctx.reply('هیچ کاربری در لیست دسترسی ویژه وجود ندارد.');
	}

	let text = '📋 **لیست دسترسی‌های ربات:**\n\n';

	if (botState.isPublicAccess) {
		text += '🌐 **دسترسی عمومی:** فعال (همه می‌توانند استفاده کنند)\n\n';
	} else {
		text += '🌐 **دسترسی عمومی:** غیرفعال\n\n';
	}

	text += '👥 **لیست کاربران مجاز:**\n';
	if (botState.authorizedUsers.size > 0) {
		for (const [id, name] of botState.authorizedUsers.entries()) {
			text += `🔸 ${name} (ID: \`${id}\`)\n`;
		}
	} else {
		text += 'خالی';
	}

	await ctx.reply(text, { parse_mode: 'Markdown' });
});

// ==========================================
// دستورات عمومی (توقف و ادامه خوانش)
// ==========================================

authorizedUsersOnly.command('pause', async (ctx) => {
	if (!botState.isReading)
		return ctx.reply('⚠️ ربات از قبل در حالت توقف قرار داشت.');
	botState.isReading = false;
	await ctx.reply('⏸️ خواندن و ذخیره پیام‌های گروه متوقف شد.');
});

authorizedUsersOnly.command('resume', async (ctx) => {
	if (botState.isReading)
		return ctx.reply('⚠️ ربات از قبل در حال خواندن پیام‌ها بود.');
	botState.isReading = true;
	await ctx.reply('▶️ خواندن و ذخیره پیام‌های گروه از سر گرفته شد.');
});

authorizedUsersOnly.command('status', async (ctx) => {
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
