import { Bot } from 'grammy';
import { config } from '../config/env.js';
import { stripEmojis } from '../utils/text.js';
import {
	saveMessage,
	updateMessage,
	deleteMessage,
	getUserMessageCount,
	getTopUsers,
} from '../db/supabase.js';
import type { MessageRecord } from '../db/supabase.js';
import {
	getAuthorizedUsersList,
	getIgnoredUsersList,
	getIsPublicAccess,
	getIsReading,
	setIsPublicAccess,
	setIsReading,
	addAuthorizedUser,
	removeAuthorizedUser,
	ignoreUser,
	unignoreUser,
	isUserIgnored,
	isUserInList,
} from './state.js';

export const bot = new Bot(config.BOT_TOKEN);

// ==========================================
// بخش مانیتورینگ
// ==========================================
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
// بخش مدیریت سطوح دسترسی (Access Control)
// ==========================================
const isRootAdmin = (userId?: number): boolean => userId === config.ADMIN_ID;

const checkAuthorization = async (userId?: number): Promise<any> => {
	if (!userId) return false;
	if (isRootAdmin(userId)) return true;

	const isPublic = await getIsPublicAccess();
	if (isPublic) return true;

	return await isUserInList(userId);
};

const rootAdminOnly = bot.filter((ctx) => isRootAdmin(ctx.from?.id));
const authorizedUsersOnly = bot.filter(
	async (ctx) => await checkAuthorization(ctx.from?.id),
);

// ==========================================
// دستورات عمومی (Public Commands)
// ==========================================

bot.command('start', async (ctx) => {
	const intro = `👋 **سلام! من Hevgir (هەڤگر) هستم.**\n\nمن یک دستیار هوشمند برای تحلیل و استخراج کانتکس مکالمات این گروه هستم. من پیام‌ها را می‌خوانم، مفاهیم را تقطیر می‌کنم و در پایان روز با استفاده از مدل‌های زبانی، برای ارتقای سطح فکری گروه پیشنهاداتی ارائه می‌دهم.\n\nبرای دیدن لیست امکانات من، از دستور /help استفاده کنید.`;
	await ctx.reply(intro, { parse_mode: 'Markdown' });
});

bot.command('help', async (ctx) => {
	const helpText =
		`📚 **راهنمای دستورات ربات:**\n\n` +
		`**عمومی (همه کاربران):**\n` +
		`🔹 /start - معرفی ربات\n` +
		`🔹 /help - راهنمای دستورات\n` +
		`🔹 /users - مشاهده وضعیت و آمار کاربران گروه\n` +
		`🔹 /stats - آمار پیام‌ها (روی یک پیام ریپلای کنید یا خالی بفرستید)\n` +
		`🔹 /status - مشاهده وضعیت فعلی موتور خوانش\n\n` +
		`**کاربران مجاز:**\n` +
		`🔹 /pause - توقف خواندن پیام‌ها\n` +
		`🔹 /resume - از سرگیری خواندن پیام‌ها\n\n` +
		`**مدیر سیستم:**\n` +
		`🔹 /grant, /revoke, /grantall, /revokeall, /accesslist\n` +
		`🔹 /ignore, /unignore, /del\n`;

	await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

bot.command('status', async (ctx) => {
	const isReading = await getIsReading();
	await ctx.reply(
		`وضعیت فعلی ربات: ${isReading ? '🟢 فعال (در حال پردازش پیام‌ها)' : '🔴 متوقف'}`,
	);
});

bot.command('stats', async (ctx) => {
	// اگر ریپلای نکرده بود، آمار خود شخص را نشان می‌دهد
	const target = ctx.msg.reply_to_message?.from || ctx.msg.from;
	if (!target) return;

	const senderName = target.last_name
		? `${target.first_name} ${target.last_name}`
		: target.first_name || 'Unknown';

	try {
		const count = await getUserMessageCount(senderName);
		await ctx.reply(
			`📊 کاربر «${senderName}» تا کنون **${count}** پیام در دیتابیس دارد.`,
			{ parse_mode: 'Markdown' },
		);
	} catch (error) {
		await ctx.reply('❌ خطا در دریافت آمار.');
	}
});

bot.command('users', async (ctx) => {
	try {
		const topUsers = await getTopUsers();
		const authorized = await getAuthorizedUsersList();
		const ignored = await getIgnoredUsersList();

		if (topUsers.length === 0) return ctx.reply('دیتابیس پیام‌ها خالی است.');

		let text = '👥 **تابلوی وضعیت کاربران (Top 20):**\n\n';

		for (const u of topUsers) {
			let roles = [];
			// چون user_id در messages نداریم، مطابقت را بر اساس نام انجام می‌دهیم
			if (authorized.some((a) => a.name === u.sender_name))
				roles.push('✅ مجاز');
			if (ignored.some((ig) => ig.name === u.sender_name))
				roles.push('🚫 ایگنور');

			const roleStr = roles.length > 0 ? ` [${roles.join(', ')}]` : '';
			text += `🔸 ${u.sender_name}: ${u.msg_count} پیام${roleStr}\n`;
		}

		await ctx.reply(text, { parse_mode: 'Markdown' });
	} catch (error) {
		console.error('Users command error:', error);
		await ctx.reply('❌ خطا در پردازش لیست کاربران.');
	}
});

// ==========================================
// دستورات مدیر کل
// ==========================================
rootAdminOnly.command('grantall', async (ctx) => {
	await setIsPublicAccess(true);
	await ctx.reply('🔓 دسترسی عمومی باز شد.');
});

rootAdminOnly.command('revokeall', async (ctx) => {
	await setIsPublicAccess(false);
	await ctx.reply('🔒 دسترسی عمومی بسته شد.');
});

rootAdminOnly.command('grant', async (ctx) => {
	const target = ctx.msg.reply_to_message?.from;
	if (!target) return ctx.reply('⚠️ ریپلای الزامی است.');

	await addAuthorizedUser(target.id, target.first_name || 'کاربر');
	await ctx.reply(`✅ دسترسی به «${target.first_name}» داده شد.`);
});

rootAdminOnly.command('revoke', async (ctx) => {
	const target = ctx.msg.reply_to_message?.from;
	if (!target) return ctx.reply('⚠️ ریپلای الزامی است.');

	await removeAuthorizedUser(target.id);
	await ctx.reply(`❌ دسترسی «${target.first_name}» لغو شد.`);
});

rootAdminOnly.command('accesslist', async (ctx) => {
	const isPublic = await getIsPublicAccess();
	const users = await getAuthorizedUsersList();

	let text = '📋 **لیست دسترسی‌های ربات:**\n\n';
	text += `🌐 **دسترسی عمومی:** ${isPublic ? 'فعال' : 'غیرفعال'}\n\n`;
	text += '👥 **لیست کاربران مجاز:**\n';

	if (users.length > 0) {
		users.forEach((u) => (text += `🔸 ${u.name} (ID: \`${u.user_id}\`)\n`));
	} else {
		text += 'خالی';
	}

	await ctx.reply(text, { parse_mode: 'Markdown' });
});

rootAdminOnly.command('stats', async (ctx) => {
	const target = ctx.msg.reply_to_message?.from;
	if (!target)
		return ctx.reply('⚠️ برای دیدن آمار، ریپلای روی پیام کاربر الزامی است.');

	// ساخت نام کاربر دقیقاً با همان فرمتی که در دیتابیس ذخیره می‌شود
	const senderName = target.last_name
		? `${target.first_name} ${target.last_name}`
		: target.first_name || 'Unknown';

	try {
		const count = await getUserMessageCount(senderName);
		await ctx.reply(
			`📊 کاربر «${senderName}» تا کنون **${count}** پیام در دیتابیس دارد.`,
			{ parse_mode: 'Markdown' },
		);
	} catch (error) {
		await ctx.reply('❌ خطا در دریافت آمار از پایگاه داده.');
	}
});

// ==========================================
// دستورات جدید مدیر کل (Moderation)
// ==========================================

rootAdminOnly.command('ignore', async (ctx) => {
	const target = ctx.msg.reply_to_message?.from;
	if (!target) return ctx.reply('⚠️ ریپلای روی پیام کاربر الزامی است.');

	await ignoreUser(target.id, target.first_name);
	await ctx.reply(
		`🚫 پیام‌های «${target.first_name}» دیگر توسط سیستم پردازش و ذخیره نخواهند شد.`,
	);
});

rootAdminOnly.command('unignore', async (ctx) => {
	const target = ctx.msg.reply_to_message?.from;
	if (!target) return ctx.reply('⚠️ ریپلای روی پیام کاربر الزامی است.');

	await unignoreUser(target.id);
	await ctx.reply(`✅ خواندن پیام‌های «${target.first_name}» مجدداً فعال شد.`);
});

rootAdminOnly.command('del', async (ctx) => {
	const targetMsg = ctx.msg.reply_to_message;
	if (!targetMsg)
		return ctx.reply(
			'⚠️ ریپلای روی پیامی که باید از دیتابیس حذف شود الزامی است.',
		);

	try {
		await deleteMessage(ctx.chat.id, targetMsg.message_id);
		await ctx.reply(`🗑️ پیام مورد نظر با موفقیت از دیتابیس هوش مصنوعی حذف شد.`);
	} catch (error) {
		await ctx.reply(
			`❌ خطا در حذف پیام: شاید این پیام در دیتابیس وجود نداشته باشد.`,
		);
	}
});

// ==========================================
// دستورات عمومی و گارد وضعیت
// ==========================================
authorizedUsersOnly.command('pause', async (ctx) => {
	const isReading = await getIsReading();
	if (!isReading) return ctx.reply('⚠️ ربات از قبل متوقف است.');
	await setIsReading(false);
	await ctx.reply('⏸️ خواندن پیام‌ها متوقف شد.');
});

authorizedUsersOnly.command('resume', async (ctx) => {
	const isReading = await getIsReading();
	if (isReading) return ctx.reply('⚠️ ربات در حال کار است.');
	await setIsReading(true);
	await ctx.reply('▶️ خواندن پیام‌ها آغاز شد.');
});

authorizedUsersOnly.command('status', async (ctx) => {
	const isReading = await getIsReading();
	await ctx.reply(`وضعیت فعلی ربات: ${isReading ? '🟢 فعال' : '🔴 متوقف'}`);
});

// ==========================================
// هندلرهای ذخیره و آپدیت پیام
// ==========================================
bot.on('message:text', async (ctx) => {
	const isReading = await getIsReading();
	if (!isReading) return;

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

	try {
		await saveMessage(record);
		await notifyAdmin(
			'+ ذخیره',
			ctx,
			record.message_id,
			`توسط ${record.sender_name}`,
		);
	} catch (err) {
		console.error('[-] Failed to save message:', err);
	}
});

bot.on('edited_message:text', async (ctx) => {
	const isReading = await getIsReading();
	if (!isReading) return;

	// گارد جدید: آیا کاربر در لیست سیاه است؟
	const userId = ctx.msg.from?.id;
	if (userId) {
		const isIgnored = await isUserIgnored(userId);
		if (isIgnored) return; // پیام نادیده گرفته می‌شود
	}

	const cleanText = stripEmojis(ctx.editedMessage.text);

	try {
		if (!cleanText) {
			await deleteMessage(
				ctx.editedMessage.chat.id,
				ctx.editedMessage.message_id,
			);
			await notifyAdmin(
				'- حذف (خالی شدن متنی)',
				ctx,
				ctx.editedMessage.message_id,
			);
			return;
		}

		await updateMessage(
			ctx.editedMessage.chat.id,
			ctx.editedMessage.message_id,
			cleanText,
		);
		await notifyAdmin('~ ویرایش', ctx, ctx.editedMessage.message_id);
	} catch (err) {
		console.error('[-] Failed to update message:', err);
	}
});

bot.catch((err) => console.error('Global Error in bot:', err));
