"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import DeleteDialog from "@/components/common/DeleteDialog";
import useTranslation from "@/lib/hooks/useTranslation";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/lib/hooks/useRulesApi";
import { Plus, Trash2 } from "lucide-react";

export default function CategoriesSection() {
  const { t } = useTranslation();
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      setError(t("categoryNameRequired"));
      return;
    }
    try {
      const maxOrder = (categories || []).reduce((m, c) => Math.max(m, c.sortOrder), 0);
      await createCategory.mutateAsync({ name, enabled: 1, sortOrder: maxOrder + 10 });
      setNewName("");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">{t("categoriesTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("categoriesDesc")}</p>
      </div>

      <Separator />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (
        <div className="space-y-2">
          {(categories || []).map((cat) => (
            <div
              key={cat.id}
              className={`flex items-center justify-between rounded-xl border p-3 ${cat.enabled === 1 ? "border-border bg-card" : "border-border bg-muted/40 opacity-70"}`}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={cat.enabled === 1}
                  onCheckedChange={(v) =>
                    updateCategory.mutate({ id: cat.id, patch: { enabled: v === true ? 1 : 0 } })
                  }
                  aria-label={cat.name}
                />
                <span className="text-sm font-medium">{cat.name}</span>
              </div>
              <DeleteDialog
                trigger={
                  <Button variant="ghost" size="icon" className="hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                }
                title={t("deleteCategory")}
                description={t("deleteCategoryConfirm", { name: cat.name })}
                onConfirm={() => deleteCategory.mutate(cat.id)}
                cancelText={t("cancel")}
                confirmText={t("delete")}
              />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label>{t("addCategory")}</Label>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("categoryNamePlaceholder")}
            className="rounded-xl"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <Button onClick={handleAdd} disabled={createCategory.isPending} className="rounded-xl flex-shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            {t("add")}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">{t("categoriesHint")}</p>
      </div>
    </div>
  );
}
