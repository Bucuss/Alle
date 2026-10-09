// FORWARD_MAP 内容复制转发：把收到的邮件复制一份，经 send_email 发给配置的目标邮箱。
// 与 message.forward 的区别：原件仍按 D1 规则正常处理（catch-all 照常转发到默认地址，
// 收件人自己不受影响），这里只是额外复制内容发出。
import { sendMail } from '@/lib/mail/send';

import type { NewEmail } from '@/types';

export type CopySource = Pick<
  NewEmail,
  'fromAddress' | 'fromName' | 'toAddress' | 'title' | 'bodyText' | 'bodyHtml' | 'sentAt'
>;

/** 复制邮件的主题：标明原收件人 */
export function buildCopySubject(recipient: string, subject: string | null): string {
  const s = (subject || '').trim() || '(无主题)';
  return `[转发 ${recipient}] ${s}`;
}

/** 复制邮件的纯文本正文：原文前加一段来源头信息 */
export function buildCopyText(base: CopySource, recipient: string): string {
  const header = [
    '---------- 转发邮件 ----------',
    `原收件人: ${recipient}`,
    `原发件人: ${base.fromAddress || ''}${base.fromName ? ` (${base.fromName})` : ''}`,
    `原发送时间: ${base.sentAt || ''}`,
    '------------------------------',
    '',
  ].join('\n');
  return header + (base.bodyText || '');
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 复制邮件的 HTML 正文：原文前加一段来源头信息；无原文 HTML 时返回 null */
export function buildCopyHtml(base: CopySource, recipient: string): string | null {
  if (!base.bodyHtml) return null;
  const header =
    `<div style="border-bottom:1px solid #ccc;margin-bottom:12px;padding-bottom:8px;color:#666;font-size:13px;">` +
    `转发邮件 · 原收件人 ${escHtml(recipient)} · 原发件人 ${escHtml(base.fromAddress || '')} · 原发送时间 ${escHtml(base.sentAt || '')}</div>`;
  return header + base.bodyHtml;
}

/** 把邮件内容复制一份发给目标邮箱（逐个单独发送，目标之间互不可见）。
 *  内部冒充判定由调用方负责：spoofSuspect 的邮件不得调用此函数。 */
export async function sendForwardCopies(
  env: CloudflareEnv,
  base: CopySource,
  recipient: string,
  targets: string[],
): Promise<void> {
  const subject = buildCopySubject(recipient, base.title);
  const text = buildCopyText(base, recipient);
  const html = buildCopyHtml(base, recipient);
  for (const addr of targets) {
    try {
      await sendMail(env, {
        to: [addr],
        subject,
        text,
        ...(html ? { html } : {}),
        fromName: 'Alle 转发',
      });
      console.log(`FORWARD_MAP 复制发送: ${recipient} -> ${addr}`);
    } catch (e) {
      console.error(`FORWARD_MAP 复制发送失败 ${recipient} -> ${addr}:`, e);
    }
  }
}
