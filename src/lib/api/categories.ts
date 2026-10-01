import { apiFetch, ApiError } from './client';

import type { Category, NewCategory, ApiResponse } from '@/types';

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

export async function fetchCategories(): Promise<Category[]> {
    const response = await apiFetch('/api/categories');
    return parseResponse<Category[]>(response, 'fetch categories');
}

export async function createCategory(category: NewCategory): Promise<Category> {
    const response = await apiFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category),
    });
    return parseResponse<Category>(response, 'create category');
}

export async function updateCategory(id: number, patch: Partial<NewCategory>): Promise<void> {
    const response = await apiFetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
    });
    await parseResponse<null>(response, 'update category');
}

export async function deleteCategory(id: number): Promise<void> {
    const response = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    await parseResponse<null>(response, 'delete category');
}
