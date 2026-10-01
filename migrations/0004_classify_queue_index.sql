-- 分类队列轮询索引：定时任务按 category IS NULL 取未分类邮件
CREATE INDEX IF NOT EXISTS idx_email_category ON email(category);
