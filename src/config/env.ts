import dotenv from 'dotenv';

// خواندن فایل .env و انتقال آن به process.env
dotenv.config();

// اعتبارسنجی (Fail-Fast): اگر توکن نباشد، برنامه همان ابتدا متوقف می‌شود
if (!process.env.BOT_TOKEN) {
	throw new Error('CRITICAL: BOT_TOKEN is missing in .env file');
}

if (!process.env.ADMIN_ID) {
	throw new Error('CRITICAL: ADMIN_ID is missing in .env file');
}

export const config = {
	BOT_TOKEN: process.env.BOT_TOKEN,
	ADMIN_ID: parseInt(process.env.ADMIN_ID, 10),
	// AI_API_KEY: process.env.AI_API_KEY,
};
