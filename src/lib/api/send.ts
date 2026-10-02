import { apiFetch, ApiError } from './client';

import type { ApiResponse } from '@/types';

export interface SendEmailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  inReplyTo?: string;
  fromName?: string;
  dryRun?: boolean;
  draftId?: number;
}

export interface Draft {
  id: number;
  toAddresses: string;
  ccAddresses: string;
  bccAddresses: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  inReplyTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyInfo {
  id: number;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: number;
}

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || '请求失败', res.status);
  }
  return data.data as T;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export async function sendEmail(input: SendEmailInput) {
  return parse<{ messageId: string | null; id: number }>(await apiFetch('/api/email/send', json(input)));
}

// 草稿
export async function fetchDrafts(): Promise<Draft[]> {
  return parse<Draft[]>(await apiFetch('/api/drafts'));
}

export async function createDraft(input: Partial<Draft>): Promise<Draft> {
  return parse<Draft>(await apiFetch('/api/drafts', json(input)));
}

export async function updateDraft(id: number, input: Partial<Draft>): Promise<Draft> {
  return parse<Draft>(await apiFetch(`/api/drafts/${id}`, { ...json(input), method: 'PUT' }));
}

export async function deleteDraft(id: number) {
  return parse(await apiFetch(`/api/drafts/${id}`, { method: 'DELETE' }));
}

export async function sendDraft(id: number) {
  return parse<{ messageId: string | null; id: number }>(await apiFetch(`/api/drafts/${id}/send`, { method: 'POST' }));
}

// API Keys
export async function fetchApiKeys(): Promise<ApiKeyInfo[]> {
  return parse<ApiKeyInfo[]>(await apiFetch('/api/apikeys'));
}

export async function createApiKey(name: string): Promise<ApiKeyInfo & { raw: string }> {
  return parse(await apiFetch('/api/apikeys', json({ name })));
}

export async function revokeApiKey(id: number) {
  return parse(await apiFetch(`/api/apikeys/${id}`, { method: 'DELETE' }));
}
