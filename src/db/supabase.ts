import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

export interface MessageRecord {
	chat_id: number;
	message_id: number;
	text: string;
	timestamp: number;
	sender_name: string;
}

// ساخت کلاینت اتصال به پایگاه داده ابری (Singleton)
export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

/**
 * ذخیره پیام جدید در دیتابیس ابری
 */
export async function saveMessage(record: MessageRecord): Promise<void> {
	const { error } = await supabase.from('messages').upsert(record, {
		onConflict: 'chat_id,message_id',
		ignoreDuplicates: true,
	});

	if (error) throw new Error(`Insert failed: ${error.message}`);
}

/**
 * ویرایش متن یک پیام موجود
 */
export async function updateMessage(
	chat_id: number,
	message_id: number,
	text: string,
): Promise<void> {
	const { error } = await supabase
		.from('messages')
		.update({ text })
		.match({ chat_id, message_id }); // match جایگزین WHERE در SQL است

	if (error) throw new Error(`Update failed: ${error.message}`);
}

/**
 * حذف یک پیام از دیتابیس
 */
export async function deleteMessage(
	chat_id: number,
	message_id: number,
): Promise<void> {
	const { error } = await supabase
		.from('messages')
		.delete()
		.match({ chat_id, message_id });

	if (error) throw new Error(`Delete failed: ${error.message}`);
}

/**
 * استخراج پیام‌های یک بازه زمانی خاص (مرتب‌شده بر اساس زمان)
 */
export async function getMessagesByTimeframe(
	startTime: number,
	endTime: number,
): Promise<any> {
	const { data, error } = await supabase
		.from('messages')
		.select('*')
		.gte('timestamp', startTime)
		.lte('timestamp', endTime)
		.order('timestamp', { ascending: true });

	if (error) throw new Error(`Fetch failed: ${error.message}`);
	return data || [];
}

/**
 * دریافت تعداد کل پیام‌های ذخیره‌شده از یک کاربر خاص
 */
export async function getUserMessageCount(senderName: string): Promise<number> {
	// استفاده از count برای جلوگیری از دانلود کل رکوردها (بهینه‌سازی پهنای باند)
	const { count, error } = await supabase
		.from('messages')
		.select('*', { count: 'exact', head: true })
		// استخراج user_id از sender_name یا فیلد جدید (نیاز به یک اصلاح کوچک داریم)
		// برای سادگی، فعلاً فرض می‌کنیم باید chat_id کاربر را داشته باشیم، اما چون در گروه پیام می‌دهند،
		// ما message_id و chat_id گروه را ذخیره کرده‌ایم.
		// نکته معماری: ما user_id فرستنده را در جدول messages ذخیره نکرده بودیم!
		// پس فعلاً بر اساس sender_name فیلتر می‌کنیم (هرچند از نظر مهندسی دقیق نیست چون نام قابل تغییر است).
		.eq('sender_name', senderName.toString()); // این بخش موقت است تا بعداً فیلد user_id را به جدول اصلی اضافه کنیم.

	if (error) throw new Error(`Count failed: ${error.message}`);
	return count || 0;
}

/**
 * دریافت لیست کاربرانی که بیشترین پیام را در گروه داشته‌اند
 */
export async function getTopUsers(): Promise<
	{ sender_name: string; msg_count: number }[]
> {
	const { data, error } = await supabase.from('group_user_stats').select('*');
	if (error) throw new Error(`Fetch top users failed: ${error.message}`);
	return data || [];
}

/**
 * حذف گروهی آخرین پیام‌های یک گروه از دیتابیس
 */
export async function deleteRecentMessages(
	chatId: number,
	count: number,
): Promise<number> {
	// ۱. پیدا کردن آیدی N پیام آخر
	const { data, error: fetchError } = await supabase
		.from('messages')
		.select('message_id')
		.eq('chat_id', chatId)
		.order('timestamp', { ascending: false })
		.limit(count);

	if (fetchError)
		throw new Error(`Fetch for delete failed: ${fetchError.message}`);
	if (!data || data.length === 0) return 0;

	const idsToDelete = data.map((m) => m.message_id);

	// ۲. حذف پیام‌های پیدا شده
	const { error: deleteError } = await supabase
		.from('messages')
		.delete()
		.eq('chat_id', chatId)
		.in('message_id', idsToDelete);

	if (deleteError)
		throw new Error(`Bulk delete failed: ${deleteError.message}`);

	return idsToDelete.length;
}
