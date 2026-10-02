// Cloudflare Email Sending (Beta) binding 类型
// workerd 生成的类型较旧，这里补充结构化 send() 的定义

export interface EmailSendAddress {
  email: string;
  name?: string;
}

export type EmailSendRecipient = string | EmailSendAddress | Array<string | EmailSendAddress>;

export interface EmailSendAttachment {
  content: string | ArrayBuffer | ArrayBufferView;
  filename: string;
  type: string;
  disposition: 'attachment' | 'inline';
  contentId?: string;
}

export interface EmailSendOptions {
  to: EmailSendRecipient;
  from: string | EmailSendAddress;
  subject: string;
  text?: string;
  html?: string;
  cc?: EmailSendRecipient;
  bcc?: EmailSendRecipient;
  replyTo?: string | EmailSendAddress;
  inReplyTo?: string;
  headers?: Record<string, string>;
  attachments?: EmailSendAttachment[];
}

export interface EmailSendResult {
  messageId: string;
}

export interface EmailSendBinding {
  send(options: EmailSendOptions): Promise<EmailSendResult>;
}

declare global {
  namespace Cloudflare {
    interface Env {
      EMAIL: EmailSendBinding;
    }
  }
}

export {};
