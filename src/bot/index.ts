import { Bot } from 'grammy';
import { config } from '../config/env.js';
import { stripEmojis } from '../utils/text.js';
import { saveMessage, updateMessage, deleteMessage } from '../db/supabase.js';
import type { MessageRecord } from '../db/supabase.js';
import {
	getIsReading,
	setIsReading,
	getIsPublicAccess,
	setIsPublicAccess,
	isUserInList,
	addAuthorizedUser,
	removeAuthorizedUser,
	getAuthorizedUsersList,
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
