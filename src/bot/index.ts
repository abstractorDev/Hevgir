import { Bot, InlineKeyboard } from 'grammy';
import { config } from '../config/env.js';
import { stripEmojis } from '../utils/text.js';
import {
	saveMessage,
	updateMessage,
	clearChatMessages,
	deleteMessage,
	deleteRecentMessages,
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
import { runDailyAnalysisPipeline } from '../services/ai.js';
import { getMessagesByTimeframe } from '../db/supabase.js';

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
		`📚 **راهنمای جامع سیستم Hevgir (هەڤگر):**\n\n` +
		`**🔹 دستورات عمومی (همه کاربران):**\n` +
		`• /panel: \n (یا کلمه "پنل") - 🎛 باز کردن پنل مدیریت پویا\n` +
		`• /users: \n - 👥 تابلوی وضعیت و آمار فعالیت کاربران (Top 20)\n` +
		`• /stats: \n - 📊 آمار کل پیام‌های یک فرد (ریپلای کنید یا خالی بفرستید)\n` +
		`• /status: \n (یا "وضعیت") - 🤖 وضعیت فعلی موتور خوانش هوش مصنوعی\n` +
		`• /help: \n (یا "راهنما") - 📖 نمایش همین پیام\n\n` +
		`--------------------\n` +
		`**🔸 کاربران مجاز (Authorized):**\n` +
		`• /pause: \n - ⏸ توقف پردازش و ثبت پیام‌های گروه\n` +
		`• /resume: \n - ▶️ از سرگیری پردازش پیام‌ها\n\n` +
		`--------------------\n` +
		`**👑 مدیر کل (Root Admin):**\n` +
		`• /grant و /revoke: \n - 🔑 مدیریت دسترسی افراد (با ریپلای)\n` +
		`• /grantall و /revokeall: \n - 🌐 باز و بسته کردن دسترسی عمومی به ربات\n` +
		`• /accesslist: \n - 📋 مشاهده لیست افرادی که دسترسی دارند\n` +
		`• /ignore و /unignore: \n - 🚫 ورود/خروج کاربر به لیست سیاه (عدم ثبت پیام)\n` +
		`• /del \n - 🗑 حذف یک پیام مشخص از دیتابیس (با ریپلای)\n` +
		`• /delete N: \n - ✂️ حذف گروهی پیام‌های اخیر (مثال: \`/delete 30\`)\n` +
		`• /cleardb: \n - 🧹 پاکسازی کامل تاریخچه (با تاییدیه دو مرحله‌ای)\n\n` +
		`💡 **نکته:** برای دسترسی سریع‌تر، می‌توانید کلمات «پنل»، «راهنما» و «وضعیت» را بدون علامت اسلش (/) ارسال کنید.`;

	await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// دقت کنید که checkAuthorization و isRootAdmin باید در این محدوده قابل دسترسی باشند
bot.command('panel', async (ctx) => {
	const userId = ctx.from?.id;
	if (!userId) return;

	const keyboard = new InlineKeyboard();

	// ۱. دکمه‌های عمومی (برای همه)
	keyboard
		.text('📊 وضعیت کاربران', 'panel_users')
		.text('🤖 وضعیت ربات', 'panel_status')
		.row();

	// ۲. دکمه‌های کاربران مجاز (Authorized)
	const isAuth = await checkAuthorization(userId);
	if (isAuth) {
		keyboard
			.text('▶️ شروع خوانش', 'panel_resume')
			.text('⏸ توقف خوانش', 'panel_pause')
			.row();
	}

	// ۳. دکمه‌های مدیر کل (Root Admin)
	if (isRootAdmin(userId)) {
		keyboard.text('🧹 پاکسازی کل دیتابیس', 'panel_cleardb').row();
	}

	await ctx.reply(
		'🎛 **پنل مدیریت سیستم Hevgir**\n\nلطفاً یک گزینه را انتخاب کنید:',
		{
			parse_mode: 'Markdown',
			reply_markup: keyboard,
		},
	);
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

rootAdminOnly.command('delete', async (ctx) => {
	// دریافت مقداری که بعد از دستور نوشته شده (مثلاً 30)
	const arg = ctx.match;
	const count = parseInt(arg, 10);

	if (isNaN(count) || count <= 0) {
		return ctx.reply('⚠️ لطفاً یک عدد معتبر وارد کنید. مثال: `/delete 30`', {
			parse_mode: 'Markdown',
		});
	}

	// محدودیت امنیتی برای جلوگیری از پاک شدن کل دیتابیس با یک اشتباه تایپی
	if (count > 500) {
		return ctx.reply(
			'⚠️ برای امنیت داده‌ها، در هر بار اجرای این دستور حداکثر ۵۰۰ پیام قابل حذف است.',
		);
	}

	try {
		const deletedCount = await deleteRecentMessages(ctx.chat.id, count);
		await ctx.reply(
			`🗑️ تعداد **${deletedCount}** پیام اخیر با موفقیت از دیتابیس حذف شد.`,
			{ parse_mode: 'Markdown' },
		);
	} catch (error) {
		console.error('Bulk delete error:', error);
		await ctx.reply('❌ خطا در حذف گروهی پیام‌ها.');
	}
});

rootAdminOnly.command('cleardb', async (ctx) => {
	const confirmKeyboard = new InlineKeyboard()
		.text('✅ بله، کاملاً مطمئنم', 'confirm_cleardb')
		.text('❌ لغو عملیات', 'cancel_cleardb');

	await ctx.reply(
		'⚠️ **هشدار امنیتی**\n\nآیا مطمئن هستید که می‌خواهید **کل پیام‌های تاریخچه این گروه** را برای همیشه از دیتابیس پاک کنید؟ این عملیات غیرقابل بازگشت است.',
		{ parse_mode: 'Markdown', reply_markup: confirmKeyboard },
	);
});

rootAdminOnly.command('testai', async (ctx) => {
	await ctx.reply(
		'🔄 در حال جمع‌آوری پیام‌های ۲۴ ساعت گذشته و اجرای معماری دوگانه هوش مصنوعی (Gemini + OpenAI)...',
	);

	try {
		const nowUnix = Math.floor(Date.now() / 1000);
		const yesterdayUnix = nowUnix - 24 * 60 * 60;

		const messages = await getMessagesByTimeframe(yesterdayUnix, nowUnix);

		if (messages.length === 0) {
			return ctx.reply(
				'ℹ️ پایگاه داده خالی است یا پیامی در ۲۴ ساعت گذشته یافت نشد.',
			);
		}

		// فراخوانی مستقیم پایپ‌لاین تحلیل
		// فراخوانی مستقیم پایپ‌لاین تحلیل
		const finalReport = await runDailyAnalysisPipeline(messages);

		if (finalReport) {
			// محدودیت امن تلگرام برای هر پیام را ۴۰۰۰ کاراکتر در نظر می‌گیریم
			const CHUNK_SIZE = 4000;
			const chunks: string[] = [];

			// خرد کردن متن طولانی به قطعات کوچکتر
			for (let i = 0; i < finalReport.length; i += CHUNK_SIZE) {
				chunks.push(finalReport.substring(i, i + CHUNK_SIZE));
			}

			// ارسال قطعات به ترتیب
			for (let i = 0; i < chunks.length; i++) {
				const isFirstChunk = i === 0;
				const formattedText = isFirstChunk
					? `🧠 **نتیجه تست پایپ‌لاین (بخش ${i + 1}):**\n\n${chunks[i]}`
					: `**(ادامه گزارش - بخش ${i + 1}):**\n\n${chunks[i]}`;

				try {
					// تلاش برای ارسال با فرمت
					await ctx.reply(formattedText, { parse_mode: 'Markdown' });
				} catch (parseError) {
					// اگر مارک‌داون به دلیل برش در وسط یک کلمه کلیدی خراب شد، به متن خام سوییچ کن
					console.warn(
						`⚠️ Telegram Markdown parser failed for chunk ${i + 1}. Sending as plain text.`,
					);
					const plainText = isFirstChunk
						? `🧠 نتیجه تست پایپ‌لاین (بدون فرمت - بخش ${i + 1}):\n\n${chunks[i]}`
						: `(ادامه گزارش بدون فرمت - بخش ${i + 1}):\n\n${chunks[i]}`;

					await ctx.reply(plainText);
				}
			}
		} else {
			await ctx.reply(
				'❌ خروجی پایپ‌لاین نامعتبر (null) بود. لاگ‌های سرور را بررسی کنید.',
			);
		}
	} catch (error) {
		console.error('Test AI Error:', error);
		await ctx.reply(
			'❌ خطای سیستمی در اجرای تست. به احتمال زیاد مشکل از کلیدهای API یا اتصال اینترنت سرور است.',
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
// توابع اجرایی (Handlers)
// ==========================================

const showPanelHandler = async (ctx: any) => {
	const userId = ctx.from?.id;
	if (!userId) return;

	const keyboard = new InlineKeyboard()
		.text('📊 وضعیت کاربران', 'panel_users')
		.text('🤖 وضعیت ربات', 'panel_status')
		.row();

	const isAuth = await checkAuthorization(userId);
	if (isAuth) {
		keyboard
			.text('▶️ شروع خوانش', 'panel_resume')
			.text('⏸ توقف خوانش', 'panel_pause')
			.row();
	}

	if (isRootAdmin(userId)) {
		keyboard.text('🧹 پاکسازی کل دیتابیس', 'panel_cleardb').row();
	}

	await ctx.reply(
		'🎛 **پنل مدیریت سیستم Hevgir**\n\nلطفاً یک گزینه را انتخاب کنید:',
		{
			parse_mode: 'Markdown',
			reply_markup: keyboard,
		},
	);
};

const showHelpHandler = async (ctx: any) => {
	const helpText =
		`📚 **راهنمای جامع سیستم Hevgir (هەڤگر):**\n\n` +
		`**🔹 دستورات عمومی (همه کاربران):**\n` +
		`• /panel: \n (یا کلمه "پنل") - 🎛 باز کردن پنل مدیریت پویا\n` +
		`• /users: \n - 👥 تابلوی وضعیت و آمار فعالیت کاربران (Top 20)\n` +
		`• /stats: \n - 📊 آمار کل پیام‌های یک فرد (ریپلای کنید یا خالی بفرستید)\n` +
		`• /status: \n (یا "وضعیت") - 🤖 وضعیت فعلی موتور خوانش هوش مصنوعی\n` +
		`• /help: \n (یا "راهنما") - 📖 نمایش همین پیام\n\n` +
		`--------------------\n` +
		`**🔸 کاربران مجاز (Authorized):**\n` +
		`• /pause: \n - ⏸ توقف پردازش و ثبت پیام‌های گروه\n` +
		`• /resume: \n - ▶️ از سرگیری پردازش پیام‌ها\n\n` +
		`--------------------\n` +
		`**👑 مدیر کل (Root Admin):**\n` +
		`• /grant و /revoke: \n - 🔑 مدیریت دسترسی افراد (با ریپلای)\n` +
		`• /grantall و /revokeall: \n - 🌐 باز و بسته کردن دسترسی عمومی به ربات\n` +
		`• /accesslist: \n - 📋 مشاهده لیست افرادی که دسترسی دارند\n` +
		`• /ignore و /unignore: \n - 🚫 ورود/خروج کاربر به لیست سیاه (عدم ثبت پیام)\n` +
		`• /del \n - 🗑 حذف یک پیام مشخص از دیتابیس (با ریپلای)\n` +
		`• /delete N: \n - ✂️ حذف گروهی پیام‌های اخیر (مثال: \`/delete 30\`)\n` +
		`• /cleardb: \n - 🧹 پاکسازی کامل تاریخچه (با تاییدیه دو مرحله‌ای)\n\n` +
		`💡 **نکته:** برای دسترسی سریع‌تر، می‌توانید کلمات «پنل»، «راهنما» و «وضعیت» را بدون علامت اسلش (/) ارسال کنید.`;

	await ctx.reply(helpText, { parse_mode: 'Markdown' });
};

// ==========================================
// مسیردهی دستورات (Routing)
// ==========================================

// اتصال به دستورات استاندارد
bot.command('panel', showPanelHandler);
bot.command('help', showHelpHandler);

// اتصال به کلمات متنی (با استفاده از Regex برای تطابق دقیق)
// علامت ^ یعنی ابتدای پیام، علامت $ یعنی انتهای پیام
bot.hears(/^پنل$/i, showPanelHandler);
bot.hears(/^(راهنما|help)$/i, showHelpHandler);
bot.hears(/^وضعیت$/i, async (ctx) => {
	const isReading = await getIsReading();
	await ctx.reply(`وضعیت فعلی ربات: ${isReading ? '🟢 فعال' : '🔴 متوقف'}`);
});

// ==========================================
// هندلرهای ذخیره و آپدیت پیام
// ==========================================
bot.on('message:text', async (ctx) => {
	// ۱. فیلتر فرستنده: اگر پیام توسط خود ربات (یا هر ربات دیگری) ارسال شده باشد
	if (ctx.msg.from?.is_bot) return;

	// ۲. فیلتر ریپلای: اگر این پیام در جواب (ریپلای) به یک ربات داده شده باشد
	if (ctx.msg.reply_to_message?.from?.is_bot) return;

	// ۳. فیلتر دستورات: اگر پیام یک کامند است (با / شروع می‌شود)
	if (ctx.msg.text.startsWith('/')) return;

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

// ==========================================
// پردازش کلیک روی دکمه‌های شیشه‌ای (Callback Queries)
// ==========================================

bot.callbackQuery('confirm_cleardb', async (ctx) => {
	// تایید امنیت: فقط مدیر کل می‌تواند دکمه را بزند
	if (!isRootAdmin(ctx.from.id)) {
		return ctx.answerCallbackQuery({
			text: '⛔ شما دسترسی انجام این کار را ندارید.',
			show_alert: true,
		});
	}

	const chatId = ctx.chat?.id;
	if (!chatId) return;

	try {
		// ۱. حذف از دیتابیس
		await clearChatMessages(chatId);

		// ۲. ویرایش پیام قبلی برای حذف دکمه‌ها و نمایش نتیجه
		await ctx.editMessageText(
			'🧹 تمام پیام‌های تاریخچهٔ این گروه با موفقیت از دیتابیس پاک شدند.',
			{ parse_mode: 'Markdown' },
		);

		// ۳. بستن پاپ‌آپِ لودینگِ دکمه
		await ctx.answerCallbackQuery({ text: 'دیتابیس پاکسازی شد.' });
	} catch (error) {
		console.error('Clear DB error:', error);
		await ctx.answerCallbackQuery({
			text: '❌ خطا در پاکسازی دیتابیس.',
			show_alert: true,
		});
	}
});

bot.callbackQuery('cancel_cleardb', async (ctx) => {
	if (!isRootAdmin(ctx.from.id)) {
		return ctx.answerCallbackQuery({
			text: '⛔ شما دسترسی ندارید.',
			show_alert: true,
		});
	}

	await ctx.editMessageText('❌ عملیات پاکسازی دیتابیس لغو شد.');
	await ctx.answerCallbackQuery();
});

// ==========================================
// پردازش کلیک‌های پنل مدیریت
// ==========================================

bot.callbackQuery('panel_status', async (ctx) => {
	const isReading = await getIsReading();
	const text = isReading
		? '🟢 ربات فعال و در حال پردازش پیام‌هاست.'
		: '🔴 ربات متوقف است.';
	// نمایش به صورت پاپ‌آپ روی صفحه گوشی/سیستم کاربر
	await ctx.answerCallbackQuery({ text, show_alert: true });
});

bot.callbackQuery('panel_users', async (ctx) => {
	try {
		const topUsers = await getTopUsers();
		if (topUsers.length === 0) {
			return ctx.answerCallbackQuery({
				text: 'دیتابیس پیام‌ها خالی است.',
				show_alert: true,
			});
		}

		const authorized = await getAuthorizedUsersList();
		const ignored = await getIgnoredUsersList();
		let text = '👥 **تابلوی وضعیت کاربران:**\n\n';

		for (const u of topUsers) {
			let roles = [];
			if (authorized.some((a) => a.name === u.sender_name)) roles.push('✅');
			if (ignored.some((ig) => ig.name === u.sender_name)) roles.push('🚫');
			text += `🔸 ${u.sender_name}: ${u.msg_count} پیام ${roles.join('')}\n`;
		}

		// چون متن لیست طولانی است، آن را به عنوان یک پیام جدید می‌فرستیم
		await ctx.reply(text, { parse_mode: 'Markdown' });
		await ctx.answerCallbackQuery();
	} catch (error) {
		await ctx.answerCallbackQuery({
			text: '❌ خطا در پردازش لیست',
			show_alert: true,
		});
	}
});

bot.callbackQuery('panel_pause', async (ctx) => {
	if (!(await checkAuthorization(ctx.from.id))) {
		return ctx.answerCallbackQuery({
			text: '⛔ دسترسی ندارید',
			show_alert: true,
		});
	}
	await setIsReading(false);
	await ctx.answerCallbackQuery({
		text: '⏸ خواندن پیام‌ها متوقف شد.',
		show_alert: true,
	});
});

bot.callbackQuery('panel_resume', async (ctx) => {
	if (!(await checkAuthorization(ctx.from.id))) {
		return ctx.answerCallbackQuery({
			text: '⛔ دسترسی ندارید',
			show_alert: true,
		});
	}
	await setIsReading(true);
	await ctx.answerCallbackQuery({
		text: '▶️ خواندن پیام‌ها آغاز شد.',
		show_alert: true,
	});
});

bot.callbackQuery('panel_cleardb', async (ctx) => {
	if (!isRootAdmin(ctx.from.id)) {
		return ctx.answerCallbackQuery({
			text: '⛔ فقط مدیر کل دسترسی دارد.',
			show_alert: true,
		});
	}

	// دقیقاً همان کیبوردی که در فاز قبلی ساختیم را اینجا فراخوانی می‌کنیم
	const confirmKeyboard = new InlineKeyboard()
		.text('✅ بله، کاملاً مطمئنم', 'confirm_cleardb')
		.text('❌ لغو عملیات', 'cancel_cleardb');

	// منوی فعلی را با منوی تاییدیه جایگزین می‌کنیم
	await ctx.editMessageText(
		'⚠️ **هشدار امنیتی**\n\nآیا مطمئن هستید که می‌خواهید کل پیام‌های این گروه را پاک کنید؟',
		{ parse_mode: 'Markdown', reply_markup: confirmKeyboard },
	);
	await ctx.answerCallbackQuery();
});
