import OpenAI from 'openai';
import { config } from '../config/env.js';
import type { MessageRecord } from '../db/supabase.js';

// اتصال به Groq با استفاده از استاندارد OpenAI
const ai = new OpenAI({
	apiKey: config.AI_API_KEY,
	baseURL: 'https://api.groq.com/openai/v1', // برای استفاده از OpenAI این خط را پاک کنید
});

/**
 * تحلیل و خلاصه‌سازی مکالمات با استفاده از مدل زبانی
 */
export async function summarizeDailyMessages(
	messages: MessageRecord[],
): Promise<any> {
	if (messages.length === 0) return null;

	// تبدیل آرایه پیام‌ها به یک متن ساختاریافته برای مدل
	const conversationContext = messages
		.map((msg) => `[${msg.sender_name}]: ${msg.text}`)
		.join('\n');

	const systemPrompt = `
شما یک تحلیل‌گر سیستماتیک هستید. وظیفه شما بررسی مکالمات یک گروه فنی و استخراج مفاهیم کلیدی است.
از سوگیری پرهیز کنید. فقط بر اساس منطق و داده‌های موجود در متن عمل کنید.

خروجی شما باید شامل سه بخش باشد:
۱. موضوعات اصلی بحث (خلاصه و دقیق)
۲. کلیدواژه‌های تخصصی مطرح‌شده
۳. پرسش‌های مهم یا چالش‌هایی که بی‌پاسخ ماندند

متن مکالمات:
${conversationContext}
  `.trim();

	try {
		const response = await ai.chat.completions.create({
			model: 'llama3-70b-8192', // مدل متن‌باز و قدرتمند شرکت متا روی سخت‌افزار Groq
			messages: [{ role: 'system', content: systemPrompt }],
			temperature: 0.2, // دمای پایین برای حفظ دقت تحلیلی و جلوگیری از توهم (Hallucination)
		});

		return response.choices[0]?.message?.content || null;
	} catch (error) {
		console.error('[-] AI Processing Error:', error);
		return null;
	}
}
