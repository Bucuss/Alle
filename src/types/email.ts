// ====================
// 邮件数据模型类型
// ====================

export interface Email {
  id: number;
  messageId: string | null;
  fromAddress: string | null;
  fromName: string | null;
  toAddress: string | null;
  recipient: string | null;
  title: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  emailType: ExtractResultType;
  emailResult: string | null;
  emailResultText: string | null;
  emailError: string | null;
  readStatus: number;
  category: string | null;
}

export type NewEmail = Omit<Email, 'id'>;

// ====================
// 转发规则类型（catch-all 网关）
// ====================

export type RuleMatchType = 'exact' | 'domain' | 'all';
export type RuleAction = 'accept' | 'reject';

export interface ForwardRule {
  id: number;
  name: string;
  enabled: number;
  priority: number;
  matchType: RuleMatchType;
  matchValue: string;
  action: RuleAction;
  store: number;
  forwardTo: string | null;
  notifyTelegram: number;
  notifyWebhook: number;
  createdAt: string;
  updatedAt: string;
}

export type NewForwardRule = Omit<ForwardRule, 'id' | 'createdAt' | 'updatedAt'>;

// ====================
// 邮件分类类型
// ====================

export interface Category {
  id: number;
  name: string;
  enabled: number;
  sortOrder: number;
}

export type NewCategory = Omit<Category, 'id'>;

// ====================
// 邮件提取结果类型
// ====================

export type ExtractResultType =
  | 'internal_link'
  | 'auth_link'
  | 'auth_code'
  | 'service_link'
  | 'subscription_link'
  | 'other_link'
  | 'none';

export interface ExtractResult {
  type: ExtractResultType;
  result: string;
  result_text: string;
  category: string;
}

export const DEFAULT_EXTRACT_RESULT: ExtractResult = {
  type: 'none',
  result: '',
  result_text: '',
  category: '',
};
