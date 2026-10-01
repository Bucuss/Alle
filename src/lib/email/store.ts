import emailDB from "@/lib/db/email";
import categoriesDB from "@/lib/db/categories";
import extract from "./extract";
import { findMatchingRule, hasAnyRule, parseForwardTargets } from "./rules";
import sendWebhook from '@/lib/webhook/webhook'
import sendTelegramMessage from '@/lib/telegram/telegram'
import PostalMime from "postal-mime";
import * as cheerio from 'cheerio';
import { DEFAULT_EXTRACT_RESULT } from "@/types";
import type { Email, NewEmail } from "@/types";


function replaceTemplateAdvanced(template: string, email: Email): string {
    return template.replace(/{(\w+)}/g, (match, key) => {
        const value = email[key as keyof Email];
        if (value === null || value === undefined) {
            return '';
        }
        return JSON.stringify(String(value)).slice(1, -1);
    });
}

async function readRawMessage(message: ForwardableEmailMessage): Promise<string> {
    const reader = message.raw.getReader();
    let content = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += new TextDecoder().decode(value);
    }
    return content;
}

function htmlToText(html: string): string {
    const $ = cheerio.load(html || "")
    $('script').remove();
    $('style').remove();
    $('a').each(function () {
        const $elem = $(this);
        const href = $elem.attr('href');
        const text = $elem.text().trim();

        if (href && text) {
            $elem.replaceWith(`[${text}](${href})`);
        } else if (href) {
            $elem.replaceWith(href);
        }
    });
    return $('body').text().replace(/\s+/g, ' ').trim();
}

/** 解析邮件并组装入库数据（不含 AI 提取结果） */
async function buildBaseEmailData(
    message: ForwardableEmailMessage,
    rawContent: string,
): Promise<{ data: Omit<NewEmail, 'emailType' | 'emailResult' | 'emailResultText' | 'category'>; allContent: string }> {
    const email = await PostalMime.parse(rawContent);
    const emailText = htmlToText(email.html || "");
    const allContent = [email.subject || '', email.text || '', emailText].filter(Boolean).join('\n');

    const emailFromAddress = email.from?.address || message.from || null;
    const emailFromName = email.from?.name || (emailFromAddress ? emailFromAddress.split("@")[0] : null);

    return {
        data: {
            messageId: email.messageId || null,
            fromAddress: emailFromAddress,
            fromName: emailFromName,
            toAddress: (email as unknown as { deliveredTo?: string }).deliveredTo || message.to,
            recipient: JSON.stringify(email.to),
            title: email.subject || null,
            bodyText: email.text || "",
            bodyHtml: email.html || "",
            sentAt: email.date || null,
            receivedAt: new Date().toISOString(),
            emailError: null,
            readStatus: 0,
        },
        allContent,
    };
}

/** AI 提取（含自动归类）并存入 D1 */
async function persistEmail(
    base: Omit<NewEmail, 'emailType' | 'emailResult' | 'emailResultText' | 'category'>,
    allContent: string,
    env: CloudflareEnv,
): Promise<Email> {
    const categories = await categoriesDB.listEnabledNames(env).catch(() => [] as string[]);
    const result = env.ENABLE_AI_EXTRACT?.trim().toLowerCase() === 'true'
        ? await extract(allContent, env, categories)
        : { ...DEFAULT_EXTRACT_RESULT, category: categories.includes('其他') ? '其他' : (categories[0] || '') };

    console.log(result.type, result.result, result.result_text, result.category);

    const emailData: NewEmail = {
        ...base,
        emailType: result.type,
        emailResult: result.result || "",
        emailResultText: result.result_text || "",
        category: result.category || null,
    };

    return emailDB.create(env, emailData);
}

/** 未入库时用于通知模板的虚拟邮件对象 */
function buildVirtualEmail(
    base: Omit<NewEmail, 'emailType' | 'emailResult' | 'emailResultText' | 'category'>,
): Email {
    return {
        id: 0,
        ...base,
        emailType: 'none',
        emailResult: '',
        emailResultText: '',
        category: null,
    };
}

async function notifyTelegram(email: Email, env: CloudflareEnv): Promise<void> {
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID && env.TELEGRAM_TEMPLATE) {
        await sendTelegramMessage(
            replaceTemplateAdvanced(env.TELEGRAM_TEMPLATE, email),
            env.TELEGRAM_BOT_TOKEN,
            env.TELEGRAM_CHAT_ID
        );
    } else {
        console.warn('Telegram notify skipped: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID / TELEGRAM_TEMPLATE not fully configured');
    }
}

async function notifyWebhook(email: Email, env: CloudflareEnv): Promise<void> {
    if (env.WEBHOOK_URL && env.WEBHOOK_TEMPLATE) {
        await sendWebhook(replaceTemplateAdvanced(env.WEBHOOK_TEMPLATE, email), env.WEBHOOK_URL);
    } else {
        console.warn('Webhook notify skipped: WEBHOOK_URL / WEBHOOK_TEMPLATE not fully configured');
    }
}

export default async function storeEmail(
    message: ForwardableEmailMessage,
    env: CloudflareEnv
): Promise<void> {
    try {
        const rawContent = await readRawMessage(message);
        const { data: base, allContent } = await buildBaseEmailData(message, rawContent);
        const recipient = base.toAddress || '';
        // 规则匹配必须用 envelope 收件人（message.to，即实际的 gear4ai.com 地址）；
        // Delivered-To 头在上游转发场景下可能是原始邮箱，不可用于匹配
        const envelopeTo = (message.to || '').toLowerCase();

        // ---------- 规则引擎（配置了任何规则时启用） ----------
        if (await hasAnyRule(env)) {
            const rule = await findMatchingRule(env, envelopeTo);

            // 拒收：白名单/黑名单的拦截动作
            if (rule && rule.action === 'reject') {
                message.setReject(`Rejected by rule "${rule.name}"`);
                console.log(`Email to ${envelopeTo} rejected by rule: ${rule.name}`);
                return;
            }

            // 转发到指定邮箱（目标须为 Email Routing 已验证地址）
            if (rule?.forwardTo) {
                for (const addr of parseForwardTargets(rule.forwardTo)) {
                    try {
                        await message.forward(addr);
                        console.log(`Email to ${envelopeTo} forwarded to ${addr} by rule: ${rule.name}`);
                    } catch (e) {
                        console.error(`Forward to ${addr} failed (rule: ${rule.name}):`, e);
                    }
                }
            }

            // 存储（网页端可见 + AI 提取归类）
            const shouldStore = rule ? rule.store === 1 : true;
            let emailForNotify: Email | null = null;
            if (shouldStore) {
                emailForNotify = await persistEmail(base, allContent, env);
                console.log("Email stored successfully:", {
                    id: emailForNotify.id,
                    messageId: emailForNotify.messageId,
                    from: emailForNotify.fromAddress,
                    to: emailForNotify.toAddress,
                    emailType: emailForNotify.emailType,
                    category: emailForNotify.category,
                    rule: rule?.name || '(default)',
                });
            } else {
                emailForNotify = buildVirtualEmail(base);
            }

            if (rule?.notifyTelegram === 1) {
                await notifyTelegram(emailForNotify, env);
            }
            if (rule?.notifyWebhook === 1) {
                await notifyWebhook(emailForNotify, env);
            }
            return;
        }

        // ---------- 兼容旧行为（未配置任何规则时） ----------
        const res = await persistEmail(base, allContent, env);

        if (env.WEBHOOK_URL && env.WEBHOOK_TEMPLATE && env.WEBHOOK_TYPE.split(',').includes(res.emailType)) {
            await sendWebhook(replaceTemplateAdvanced(env.WEBHOOK_TEMPLATE, res), env.WEBHOOK_URL);
        }

        // 发送到Telegram Bot
        if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID && env.TELEGRAM_TEMPLATE && env.TELEGRAM_TYPE && env.TELEGRAM_TYPE.split(',').includes(res.emailType)) {
            await sendTelegramMessage(
                replaceTemplateAdvanced(env.TELEGRAM_TEMPLATE, res),
                env.TELEGRAM_BOT_TOKEN,
                env.TELEGRAM_CHAT_ID
            );
        }
        console.log("Email stored successfully:", {
            id: res.id,
            messageId: res.messageId,
            from: res.fromAddress,
            to: res.toAddress,
            emailType: res.emailType,
            category: res.category,
        });
    } catch (e) {
        console.error("Failed to store email:", e);
        throw e;
    }
}
