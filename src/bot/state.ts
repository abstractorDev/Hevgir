/**
 * شیء مدیریت وضعیت (State) ربات.
 * نکته معماری: در حال حاضر این وضعیت در حافظه RAM (In-Memory) نگهداری می‌شود.
 * هنگام انتقال به معماری Serverless (فاز ۵)، این وضعیت باید به دیتابیس منتقل شود
 * زیرا در محیط Serverless حافظه با هر درخواست پاک می‌شود.
 */
export const botState = {
	isReading: true, // وضعیت اصلی خواندن پیام‌ها
	isPublicAccess: false, // آیا همه کاربران گروه دسترسی دارند؟

	// استفاده از Map برای ذخیره آیدی عددی و نام کاربر
	// Map<UserId, UserName>
	authorizedUsers: new Map<number, string>(),
};
