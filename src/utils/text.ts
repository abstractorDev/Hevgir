/**
 * متن را دریافت کرده و تمامی کاراکترهای ایموجی و پیکتوگراف را از آن حذف می‌کند.
 *
 * @param {string} text - متن خام ورودی
 * @returns {string} متن پاک‌سازی شده بدون ایموجی و فاصله‌های اضافی
 *
 * @example
 * const clean = stripEmojis("سلام 👋 چطوری؟"); // خروجی: "سلام چطوری؟"
 */
export function stripEmojis(text: string): string {
	return text
		.replace(
			/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Component}]/gu,
			'',
		)
		.replace(/\s+/g, ' ')
		.trim();
}
