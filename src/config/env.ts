import dotenv from 'dotenv';

// خواندن فایل .env و انتقال آن به process.env
dotenv.config();

if (!process.env.GEMINI_API_KEY)
	throw new Error('CRITICAL: GEMINI_API_KEY is missing');

// اعتبارسنجی (Fail-Fast): اگر توکن نباشد، برنامه همان ابتدا متوقف می‌شود
if (!process.env.BOT_TOKEN) {
	throw new Error('CRITICAL: BOT_TOKEN is missing in .env file');
}

if (!process.env.ADMIN_ID) {
	throw new Error('CRITICAL: ADMIN_ID is missing in .env file');
}

if (!process.env.SUPABASE_URL)
	throw new Error('CRITICAL: SUPABASE_URL is missing');

if (!process.env.SUPABASE_KEY)
	throw new Error('CRITICAL: SUPABASE_KEY is missing');

export const config = {
	BOT_TOKEN: process.env.BOT_TOKEN,
	ADMIN_ID: parseInt(process.env.ADMIN_ID, 10),
	SUPABASE_URL: process.env.SUPABASE_URL,
	SUPABASE_KEY: process.env.SUPABASE_KEY,
	// GROQ_API_KEY: process.env.GROQ_API_KEY,
	OPENAI_API_KEY: process.env.OPENAI_API_KEY,
	GEMINI_API_KEY: process.env.GEMINI_API_KEY,
};
