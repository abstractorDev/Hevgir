import OpenAI from 'openai';
import { config } from '../config/env.js';
import type { MessageRecord } from '../db/supabase.js';

// کلاینت اول: برای کارهای سنگین و سریع (مرحله Map)
// کلاینت اول: مرحله Map با استفاده از Google Gemini
const mapPhaseClient = new OpenAI({
	apiKey: config.GEMINI_API_KEY,
	baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

// تابع کمکی برای ایجاد وقفه و جلوگیری از Rate Limit
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * مرحله Map: تولید خلاصه‌های میانی با Groq
 */
async function generateIntermediateSummary(
	messages: MessageRecord[],
): Promise<string | null> {
	const context = messages
		.map((m) => `[${m.sender_name}]: ${m.text}`)
		.join('\n');

	const systemPrompt = `
شما یک تحلیل‌گر داده هستید. این بخشی از پیام‌های یک گروه است.
بدون قضاوت، فقط موارد زیر را استخراج کنید:
۱. موضوعات اصلی بحث
۲. مشکلات یا گیرهای فنی/فکری اعضا
۳. چارچوب و حال‌وهوای کلی بحث
پاسخ باید بسیار فشرده و به صورت بولت‌پوینت باشد.
  `.trim();

	try {
		const response = await mapPhaseClient.chat.completions.create({
			model: 'gemini-3.6-flash', // تغییر به مدل استاندارد و به‌روز
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: context },
			],
			temperature: 0.2,
		});
		return response.choices[0]?.message?.content || null;
	} catch (error) {
		console.error('[-] Gemini Map Error:', error); // اصلاح متن لاگ
		return null;
	}
}

/**
 * مرحله Reduce: تقطیر نهایی و پیشنهاد مقاله با OpenAI
 */
async function generateFinalReportAndRecommendation(
	intermediateSummaries: string[],
): Promise<string | null> {
	const combinedSummaries = intermediateSummaries.join('\n\n---\n\n');

	const systemPrompt = `
شما یک منتور ارشد مهندسی نرم‌افزار و متفکر سیستم‌ها هستید.
در ادامه، خلاصه‌هایی از مکالمات یک روزِ گروه مهندسی آمده است.
وظایف شما:
۱. تقطیر (Distillation): یک جمع‌بندی یک‌پارچه از کل دغدغه‌ها و چارچوب فکری امروز گروه ارائه دهید.
۲. آسیب‌شناسی: آیا در طرز فکر (Mindset) یا رویکرد حل مسئله آن‌ها ضعف یا سوگیری خاصی وجود دارد؟
۳. پیشنهاد (Recommendation): بر اساس تحلیل بالا، دقیقاً یک مقاله معتبر، کتاب مهندسی، یا مفهوم بنیادین علوم کامپیوتر/فلسفه برای مطالعه پیشنهاد دهید که به اصلاح طرز فکر یا رفع چالش آن‌ها کمک کند. دلیل انتخاب این منبع را شرح دهید.
  `.trim();

	try {
		const response = await mapPhaseClient.chat.completions.create({
			model: 'gemini-3.6-flash', // اصلاح نام مدل به نسخه معتبر
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: combinedSummaries },
			],
			temperature: 0.4,
		});
		return response.choices[0]?.message?.content || null;
	} catch (error) {
		console.error('[-] Gemini Reduce Error:', error);
		return null;
	}
}

/**
 * ارکستراتور اصلی پایپ‌لاین (الگوریتم Map-Reduce)
 */
export async function runDailyAnalysisPipeline(
	messages: MessageRecord[],
): Promise<string | null> {
	if (messages.length === 0) return null;

	const CHUNK_SIZE = 150; // هر بلاک شامل 150 پیام
	const intermediateSummaries: string[] = [];

	console.log(
		`[AI Pipeline] Starting MAP phase for ${messages.length} messages...`,
	);

	// شکستن پیام‌ها به قطعات (Chunking) و اجرای ترتیبی (Sequential) برای مدیریت Rate Limit
	for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
		const chunk = messages.slice(i, i + CHUNK_SIZE);
		console.log(`[AI Pipeline] Processing chunk ${i / CHUNK_SIZE + 1}...`);

		const summary = await generateIntermediateSummary(chunk);
		if (summary) {
			intermediateSummaries.push(summary);
		}

		// وقفه 3 ثانیه‌ای بین هر درخواست به Groq
		if (i + CHUNK_SIZE < messages.length) {
			await sleep(3000);
		}
	}

	if (intermediateSummaries.length === 0) {
		throw new Error('Map phase failed to generate any summaries.');
	}

	console.log(`[AI Pipeline] Starting REDUCE phase with Gemini Flash...`);
	// ارسال تمام خلاصه‌های میانی به OpenAI برای نتیجه‌گیری و پیشنهاد
	const finalReport = await generateFinalReportAndRecommendation(
		intermediateSummaries,
	);

	return finalReport;
}
