-- 0008: 内部发件人冒充防护（spoof guard）
-- alle 经 send_email 发出的邮件不会回流为入站，因此任何入站的 gear4ai.com 发件人按定义是伪造的；
-- 打标后不再自动转发/推送通知，仅 Web 端横幅提示人工复核
ALTER TABLE email ADD COLUMN spoof_suspect INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_email_spoof_suspect ON email(spoof_suspect);
