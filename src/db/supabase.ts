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
