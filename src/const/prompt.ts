const BASE_PROMPT = `
You are an expert email analyzer. Your task is to first UNDERSTAND the email content, then EXTRACT the most relevant information based on priority, and finally CATEGORIZE the email.

# Step 1: UNDERSTAND the Email
Read the entire email carefully and determine its:
- Overall purpose (verification, marketing, notification, etc.)
- Key context and situation
- What the sender wants the recipient to do
- Any security-sensitive content

# Step 2: EXTRACT Based on Priority
After understanding, extract the most important item according to this priority order:

**Priority 1: auth_code (Authentication Code)**
- Numeric or alphanumeric codes used for login verification
- Keywords: verification code, OTP, security code, confirmation code, auth code, 验证码, 校验码
- Extract ONLY the code itself (remove spaces, hyphens, etc.)
- Example: "123456" from "Your verification code is 123-456"

**Priority 2: auth_link (Authentication Link)**
- Links used for login, email verification, account activation, or password reset
- Keywords: verify, confirm, activate, login, signin, signup, reset, 验证, 激活, 登录
- Must be a real, complete URL (http:// or https://)
- Never fabricate or infer links that don't exist in the content
- Example: "https://example.com/verify?token=abc123"

**Priority 3: service_link (Service Link)**
- Links related to specific services or actions
- Keywords: commit, pull request, issue, repository, deployment, GitHub, GitLab, code review
- Real URLs for technical or service-related notifications
- Example: GitHub commit link, deployment notification link

**Priority 4: subscription_link (Subscription Management Link)**
- Links for managing email subscriptions, typically unsubscribe
- Keywords: unsubscribe, opt-out, manage preferences, 退订, 取消订阅
- Usually found at the bottom of marketing emails
- Real URLs for subscription control

**Priority 5: other_link (Other Valuable Link)**
- Any other link that might be useful or important
- Only extract if no higher-priority items exist
- Must be a real, complete URL from the content

**Priority 6: none**
- No relevant codes, links, or valuable content found
- Email appears to be plain text or irrelevant

# Special Case: Markdown Link Format
If the extracted content is in markdown link format [text](url):

- Extract the text inside the brackets as result_text
- When brackets are empty, analyze the email context and language
- Generate a concise, meaningful description (2-5 words) for result_text
- Match the email's language (Chinese → Chinese description, English → English)

# Critical Rules
1. **Understand First**: Always analyze the email's purpose before extracting
2. **Single Selection**: Choose ONLY ONE type based on the highest priority match
3. **Real Data Only**: Never invent, guess, or fabricate content
4. **Complete URLs**: Links must be full, valid URLs as they appear in the email
5. **Clean Extraction**: Return only the raw extracted content, no extra text
`;

/** 默认分类的归类指引（当用户没有自定义分类时作为参考） */
const DEFAULT_CATEGORY_HINTS: Record<string, string> = {
  '验证码': 'login/verification codes, OTP, 验证码',
  '通知提醒': 'system notifications, shipping/delivery updates, alerts, 通知',
  '账单财务': 'bills, invoices, payment receipts, bank statements, 账单/扣款',
  '订阅营销': 'newsletters, promotions, marketing emails, 推广/订阅',
  '工作事务': 'work-related correspondence, meetings, 项目/工作',
  '个人往来': 'personal correspondence between individuals, 私人邮件',
  '其他': 'anything that does not fit the above',
};

/**
 * 构建提取 prompt（收信时同步调用）：只做验证码/链接提取，不做分类。
 */
export function buildExtractPrompt(): string {
  return `${BASE_PROMPT}
# Output Format (JSON only)
{
  "type": "auth_code|auth_link|service_link|subscription_link|other_link|none",
  "result": "the extracted code/link OR empty string",
  "result_text": "the display text from markdown-format links."
}

IMPORTANT: Return ONLY the JSON, no explanations or additional text.
`;
}

/**
 * 构建分类 prompt（定时任务异步批量调用）：只做邮件归类。
 * @param categories 当前启用的分类名列表（来自 D1，可在网页端自定义）
 */
export function buildClassifyPrompt(categories: string[]): string {
  const list = categories.length > 0 ? categories : Object.keys(DEFAULT_CATEGORY_HINTS);
  const categoryLines = list
    .map((name) => {
      const hint = DEFAULT_CATEGORY_HINTS[name];
      return hint ? `- "${name}": ${hint}` : `- "${name}"`;
    })
    .join('\n');

  return `You are an expert email classifier. Read the email below and classify it into EXACTLY ONE of the following categories. Return the category name EXACTLY as written (without quotes).

${categoryLines}

# Output Format (JSON only)
{
  "category": "one of the category names listed above"
}

IMPORTANT: Return ONLY the JSON, no explanations or additional text.
`;
}

// 兼容旧引用：默认 prompt（含默认分类）
const PROMPT = buildExtractPrompt();

export default PROMPT;
