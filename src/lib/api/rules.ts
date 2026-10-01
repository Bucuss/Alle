import { apiFetch, ApiError } from './client';

import type { ForwardRule, NewForwardRule, ApiResponse } from '@/types';

async function parseResponse<T>(response: Response, action: string): Promise<T> {
    if (!response.ok) {
        throw new ApiError(`Failed to ${action}`, response.status);
    }
    const data = (await response.json()) as ApiResponse<T>;
    if (!data.success) {
        throw new ApiError(data.error || `Failed to ${action}`, response.status);
    }
    return data.data as T;
}

export async function fetchRules(): Promise<ForwardRule[]> {
    const response = await apiFetch('/api/rules');
    return parseResponse<ForwardRule[]>(response, 'fetch rules');
}

export async function createRule(rule: NewForwardRule): Promise<ForwardRule> {
    const response = await apiFetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
    });
    return parseResponse<ForwardRule>(response, 'create rule');
}

export async function updateRule(id: number, patch: Partial<NewForwardRule>): Promise<void> {
    const response = await apiFetch(`/api/rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
    });
    await parseResponse<null>(response, 'update rule');
}

export async function deleteRule(id: number): Promise<void> {
    const response = await apiFetch(`/api/rules/${id}`, { method: 'DELETE' });
    await parseResponse<null>(response, 'delete rule');
}
