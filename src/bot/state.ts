import { supabase } from '../db/supabase.js';

export async function getIsReading(): Promise<boolean> {
	const { data, error } = await supabase
		.from('bot_settings')
		.select('is_reading')
		.eq('id', true)
		.single();
	if (error) throw error;
	// در صورتی که دیتابیس خالی باشد، پیش‌فرض true برمی‌گرداند
	return data?.is_reading ?? true;
}

export async function setIsReading(status: boolean): Promise<void> {
	await supabase
		.from('bot_settings')
		.update({ is_reading: status })
		.eq('id', true);
}

export async function getIsPublicAccess(): Promise<boolean> {
	const { data, error } = await supabase
		.from('bot_settings')
		.select('is_public_access')
		.eq('id', true)
		.single();
	if (error) throw error;
	return data?.is_public_access ?? false;
}

export async function setIsPublicAccess(status: boolean): Promise<void> {
	await supabase
		.from('bot_settings')
		.update({ is_public_access: status })
		.eq('id', true);
}

export async function getAuthorizedUsersList(): Promise<
	{ user_id: number; name: string }[]
> {
	const { data, error } = await supabase.from('authorized_users').select('*');
	if (error) throw error;
	return data || [];
}

export async function isUserInList(userId: number): Promise<boolean> {
	// استفاده از maybeSingle برای جلوگیری از خطا در صورت پیدا نشدن کاربر
	const { data, error } = await supabase
		.from('authorized_users')
		.select('user_id')
		.eq('user_id', userId)
		.maybeSingle();
	if (error) throw error;
	return data !== null;
}

export async function addAuthorizedUser(
	userId: number,
	name: string,
): Promise<void> {
	await supabase.from('authorized_users').upsert({ user_id: userId, name });
}

export async function removeAuthorizedUser(userId: number): Promise<void> {
	await supabase.from('authorized_users').delete().match({ user_id: userId });
}
