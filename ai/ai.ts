import OpenAI from 'openai';
import type { MessageRecord } from '../database/database.js';

// با این معماری، شما به OpenAI محدود نیستید.
// اگر کلید API پلتفرم Groq (برای مدل‌های متن‌باز و رایگان Llama) را بدهید،
// و baseURL را تغییر دهید، کد بدون هیچ تغییری کار می‌کند.
const ai = new OpenAI({
	apiKey: process.env.AI_API_KEY || 'YOUR_API_KEY_HERE',
	// baseURL: "https://api.groq.com/openai/v1", // در صورت استفاده از Groq این خط را از کامنت درآورید
});

export async function summarizeDailyMessages(
	messages: MessageRecord[],
): Promise {
	if (messages.length === 0) return null;

	// تبدیل داده‌های دیتابیس به یک رشته ساختاریافته برای LLM
	const conversationContext = messages
		.map((msg) => `[${msg.sender_name}]: ${msg.text}`)
		.join('\n');

	const systemPrompt = `
شما یک دستیار تحلیل‌گر سیستماتیک هستید. وظیفه شما تحلیل مکالمات یک گروه تلگرامی و استخراج کانتکس اصلی است.
از سوگیری پرهیز کنید، قضاوت نکنید و فقط بر اساس منطق و داده‌های موجود در متن عمل کنید.

خروجی شما باید شامل سه بخش باشد:
۱. موضوعات اصلی بحث (کوتاه و دقیق)
۲. کلیدواژه‌های تخصصی مطرح‌شده
۳. سوالات مهمی که بی‌پاسخ ماندند (اگر وجود دارد)

متن مکالمات:
${conversationContext}
  `.trim();

	try {
		const response = await ai.chat.completions.create({
			model: 'gpt-4o-mini', // یا "llama3-70b-8192" در صورت استفاده از Groq
			messages: [{ role: 'system', content: systemPrompt }],
			temperature: 0.3, // دمای پایین برای جلوگیری از توهم (Hallucination) و حفظ دقت تحلیلی
		});

		return response.choices[0].message.content || null;
	} catch (error) {
		console.error('[-] AI Processing Error:', error);
		return null;
	}
}
