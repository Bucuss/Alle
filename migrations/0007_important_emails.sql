-- 0007: 重要邮件（jev 价值判断 + 用户已处理标记）
ALTER TABLE email ADD COLUMN is_important INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email ADD COLUMN important_reason TEXT;
ALTER TABLE email ADD COLUMN important_handled INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_email_important ON email(is_important, important_handled);
