-- 转发规则表：catch-all 网关的地址过滤与转发规则
-- 匹配顺序按 priority 从小到大，命中第一条即停止
CREATE TABLE IF NOT EXISTS forward_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  -- match_type: exact 精确匹配收件地址 | domain 匹配域名 | all 匹配全部
  match_type TEXT NOT NULL DEFAULT 'all',
  -- match_value: exact=完整地址(如 proxy@gear4ai.com) | domain=域名(如 gear4ai.com) | all=空
  match_value TEXT NOT NULL DEFAULT '',
  -- action: accept 放行 | reject 拒收(退信)
  action TEXT NOT NULL DEFAULT 'accept',
  -- 是否存入 D1（网页端可见）
  store INTEGER NOT NULL DEFAULT 1,
  -- 转发目标邮箱，多个用英文逗号分隔（必须是 Email Routing 已验证的目标地址）
  forward_to TEXT,
  notify_telegram INTEGER NOT NULL DEFAULT 0,
  notify_webhook INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_forward_rules_priority ON forward_rules(priority, id);

-- 邮件分类表（AI 自动归类用，可在网页端增删改）
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 默认分类
INSERT OR IGNORE INTO categories (name, sort_order) VALUES
  ('验证码', 10),
  ('通知提醒', 20),
  ('账单财务', 30),
  ('订阅营销', 40),
  ('工作事务', 50),
  ('个人往来', 60),
  ('其他', 100);

-- email 表新增 AI 分类字段
ALTER TABLE email ADD COLUMN category TEXT;
