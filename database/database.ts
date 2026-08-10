import Database from 'better-sqlite3';

// ۱. تعریف تایپ‌ها (Type Definitions)
export interface MessageRecord {
	chat_id: number;
	message_id: number;
	text: string;
	timestamp: number;
}

// ۲. راه‌اندازی و پیکربندی اولیه دیتابیس
// فایل database.db در ریشه پروژه ساخته می‌شود
const db = new Database('database.db');

// فعال‌سازی WAL (Write-Ahead Logging)
// این تنظیم در سطح سیستم‌عامل، پرفورمنس نوشتن در SQLite را به‌شدت افزایش می‌دهد
db.pragma('journal_mode = WAL');

// ۳. اجرای دستور ساخت جدول (DDL)
// دستور IF NOT EXISTS تضمین می‌کند که با هربار اجرای برنامه، جدول دوباره ساخته نشود
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS messages (
    chat_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    PRIMARY KEY (chat_id, message_id)
  );
`;
db.exec(createTableQuery);

// ۴. آماده‌سازی دستور ذخیره پیام (Prepared Statement)
// استفاده از Prepared Statements به‌جای چسباندن مستقیم متغیرها (String Concatenation)،
// از حملات SQL Injection جلوگیری می‌کند و سرعت اجرای کوئری را بالا می‌برد.
const insertMessageStmt = db.prepare(`
  INSERT OR IGNORE INTO messages (chat_id, message_id, text, timestamp)
  VALUES (@chat_id, @message_id, @text, @timestamp)
`);

// ۵. اکسپورت کردن یک تابع خالص (Pure Function) برای استفاده در فایل اصلی ربات
export function saveMessage(record: MessageRecord): void {
	// متد .run() برای کوئری‌هایی استفاده می‌شود که دیتایی برنمی‌گردانند (مثل INSERT)
	insertMessageStmt.run(record);
}
