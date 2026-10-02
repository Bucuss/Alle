-- 发邮件 + MCP 支持
-- 0005_send_mcp.sql

-- email 表：收发方向（inbound 收件 / outbound 发件）
ALTER TABLE email ADD COLUMN direction TEXT NOT NULL DEFAULT 'inbound';
CREATE INDEX IF NOT EXISTS idx_email_direction ON email(direction);

-- 草稿箱
CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_addresses TEXT NOT NULL DEFAULT '',
  cc_addresses TEXT NOT NULL DEFAULT '',
  bcc_addresses TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  in_reply_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- MCP / API 密钥（只存哈希，原文仅创建时显示一次）
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0
);

-- 发信日志（兼做每 key 每日限额计数）
CREATE TABLE IF NOT EXISTS send_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_id INTEGER,
  message_id TEXT,
  from_address TEXT NOT NULL,
  to_addresses TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_send_log_key_day ON send_log(api_key_id, created_at);
