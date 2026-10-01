import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as rulesApi from '@/lib/api/rules';
import * as categoriesApi from '@/lib/api/categories';

import type { NewForwardRule, NewCategory } from '@/types';

// ---------- 转发规则 ----------

export const useRules = () => {
  return useQuery({
    queryKey: ['forward-rules'],
    queryFn: rulesApi.fetchRules,
  });
};

export const useCreateRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rulesApi.createRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forward-rules'] }),
  });
};

export const useUpdateRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<NewForwardRule> }) =>
      rulesApi.updateRule(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forward-rules'] }),
  });
};

export const useDeleteRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rulesApi.deleteRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forward-rules'] }),
  });
};

// ---------- 邮件分类 ----------

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.fetchCategories,
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: categoriesApi.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<NewCategory> }) =>
      categoriesApi.updateCategory(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: categoriesApi.deleteCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
};
