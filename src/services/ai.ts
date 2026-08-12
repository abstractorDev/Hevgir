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
شما یک تحلیل‌گر داده و فیلترکننده اطلاعات هستید. این متن، بخشی از پیام‌های یک گروه فکری است که درباره موضوعات عمیق (فلسفه، سیاست، هنر، اوضاع ایران و مسائل وجودی) و گاهی مسائل روزمره صحبت می‌کنند.
وظایف دقیق شما:
۱. حذف کامل نویز: تمام شوخی‌ها، احوال‌پرسی‌ها، کل‌کل‌ها و گفتگوهای روزمره و بی‌ارزش را کاملاً نادیده بگیر و دور بریز.
۲. استخراج سیگنال: فقط بحث‌های جدی و معنادار را استخراج کن.
۳. دسته‌بندی موضوعی: برای هر بحث جدی، موضوع اصلی و استدلال‌های مطرح‌شده را به صورت فشرده و بولت‌پوینت بنویس.
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
شما یک تحلیل‌گر ارشد بین‌رشته‌ای، متفکر و منتقد هستید.
در ادامه، خلاصه‌هایی از بحث‌های امروز یک گروه فکری (پیرامون فلسفه، جامعه، هنر و سیاست) آمده است.
وظایف شما:
۱. تفکیک موضوعی (Topic Modeling): اگر در طول روز چندین بحث کاملاً متفاوت شکل گرفته است، آن‌ها را با هم ترکیب نکن. هر بحث را در بخشی جداگانه تحلیل کن (مثلاً: موضوع اول، موضوع دوم).
۲. تحلیل و نقد بی‌طرفانه: استدلال‌های گروه را با صداقت فکری و بدون تعارف بررسی کن. اگر استدلال‌ها دچار سوگیری، مغالطه یا مبتنی بر مفروضات غلط هستند، آن‌ها را با صراحت نقد کن. از دیدگاه‌های مخالف، قوی‌ترین دفاع (Steelmaning) را ارائه بده و بین واقعیت‌ها، احتمالات و نظرات شخصی تفکیک قائل شو.
۳. پیشنهاد منابع: برای هر موضوع (یا برای رفع ضعف استدلالیِ گروه)، اولویت اولت پیشنهاد دادن یک **مقاله معتبر، جستار (Essay) یا مفهوم بنیادین** است. فقط در صورتی یک **کتاب** پیشنهاد بده که موضوع بسیار عمیق باشد و نیاز به مطالعه طولانی داشته باشد. دلیل انتخاب منبع را شرح بده.

قوانین فرمت‌بندی (بسیار مهم):
- به هیچ وجه از هشتگ (#) یا خط جداکننده (---) استفاده نکن.
- برای بولت‌پوینت‌ها فقط از خط تیره (-) استفاده کن (از ستاره تکی استفاده نکن).
- فقط مجاز هستی از جفت ستاره (**) برای پررنگ کردن کلمات استفاده کنی.
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
