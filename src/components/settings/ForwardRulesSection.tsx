"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import DeleteDialog from "@/components/common/DeleteDialog";
import useTranslation from "@/lib/hooks/useTranslation";
import {
  useRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
} from "@/lib/hooks/useRulesApi";
import { Plus, Pencil, Trash2, X } from "lucide-react";

import type { ForwardRule, NewForwardRule, RuleMatchType, RuleAction } from "@/types";

interface RuleFormState {
  name: string;
  priority: string;
  matchType: RuleMatchType;
  matchValue: string;
  action: RuleAction;
  store: boolean;
  forwardTo: string;
  notifyTelegram: boolean;
  notifyWebhook: boolean;
}

const emptyForm = (): RuleFormState => ({
  name: "",
  priority: "0",
  matchType: "exact",
  matchValue: "",
  action: "accept",
  store: true,
  forwardTo: "",
  notifyTelegram: false,
  notifyWebhook: false,
});

function formToPayload(form: RuleFormState): NewForwardRule {
  return {
    name: form.name.trim(),
    enabled: 1,
    priority: Number(form.priority) || 0,
    matchType: form.matchType,
    matchValue: form.matchType === "all" ? "" : form.matchValue.trim().toLowerCase(),
    action: form.action,
    store: form.store ? 1 : 0,
    forwardTo: form.forwardTo.trim() || null,
    notifyTelegram: form.notifyTelegram ? 1 : 0,
    notifyWebhook: form.notifyWebhook ? 1 : 0,
  };
}

function matchDescription(rule: ForwardRule, t: (k: string) => string): string {
  if (rule.matchType === "all") return t("matchTypeAll");
  if (rule.matchType === "exact") return rule.matchValue;
  return `*@${rule.matchValue}`;
}

export default function ForwardRulesSection() {
  const { t } = useTranslation();
  const { data: rules, isLoading } = useRules();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm());
  const [formError, setFormError] = useState("");

  const startCreate = () => {
    setForm(emptyForm());
    setFormError("");
    setEditingId("new");
  };

  const startEdit = (rule: ForwardRule) => {
    setForm({
      name: rule.name,
      priority: String(rule.priority),
      matchType: rule.matchType,
      matchValue: rule.matchValue,
      action: rule.action,
      store: rule.store === 1,
      forwardTo: rule.forwardTo || "",
      notifyTelegram: rule.notifyTelegram === 1,
      notifyWebhook: rule.notifyWebhook === 1,
    });
    setFormError("");
    setEditingId(rule.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormError("");
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError(t("ruleNameRequired"));
      return;
    }
    if (form.matchType === "exact" && !form.matchValue.trim().includes("@")) {
      setFormError(t("ruleMatchExactInvalid"));
      return;
    }
    if (form.matchType === "domain" && (!form.matchValue.trim() || form.matchValue.includes("@"))) {
      setFormError(t("ruleMatchDomainInvalid"));
      return;
    }
    try {
      if (editingId === "new") {
        await createRule.mutateAsync(formToPayload(form));
      } else if (typeof editingId === "number") {
        await updateRule.mutateAsync({ id: editingId, patch: formToPayload(form) });
      }
      cancelEdit();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  };

  const saving = createRule.isPending || updateRule.isPending;

  const renderForm = () => (
    <div className="rounded-xl border border-border p-4 space-y-4 bg-card">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">
          {editingId === "new" ? t("addRule") : t("editRule")}
        </h4>
        <Button variant="ghost" size="icon" onClick={cancelEdit}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <Label>{t("ruleName")}</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={t("ruleNamePlaceholder")}
          className="rounded-xl"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t("priority")}</Label>
          <Input
            type="number"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">{t("priorityHint")}</p>
        </div>
        <div className="space-y-2">
          <Label>{t("ruleAction")}</Label>
          <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v as RuleAction })}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="accept">{t("actionAccept")}</SelectItem>
              <SelectItem value="reject">{t("actionReject")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t("matchType")}</Label>
          <Select value={form.matchType} onValueChange={(v) => setForm({ ...form, matchType: v as RuleMatchType })}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exact">{t("matchTypeExact")}</SelectItem>
              <SelectItem value="domain">{t("matchTypeDomain")}</SelectItem>
              <SelectItem value="all">{t("matchTypeAll")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("matchValue")}</Label>
          <Input
            value={form.matchValue}
            onChange={(e) => setForm({ ...form, matchValue: e.target.value })}
            placeholder={
              form.matchType === "exact"
                ? t("matchValueExactPlaceholder")
                : form.matchType === "domain"
                  ? t("matchValueDomainPlaceholder")
                  : "—"
            }
            disabled={form.matchType === "all"}
            className="rounded-xl"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("forwardTo")}</Label>
        <Input
          value={form.forwardTo}
          onChange={(e) => setForm({ ...form, forwardTo: e.target.value })}
          placeholder={t("forwardToPlaceholder")}
          className="rounded-xl"
        />
        <p className="text-xs text-muted-foreground">{t("forwardToHint")}</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="rule-store"
            checked={form.store}
            onCheckedChange={(v) => setForm({ ...form, store: v === true })}
          />
          <Label htmlFor="rule-store" className="text-sm font-normal">{t("storeEmail")}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="rule-tg"
            checked={form.notifyTelegram}
            onCheckedChange={(v) => setForm({ ...form, notifyTelegram: v === true })}
          />
          <Label htmlFor="rule-tg" className="text-sm font-normal">{t("notifyTelegram")}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="rule-webhook"
            checked={form.notifyWebhook}
            onCheckedChange={(v) => setForm({ ...form, notifyWebhook: v === true })}
          />
          <Label htmlFor="rule-webhook" className="text-sm font-normal">{t("notifyWebhook")}</Label>
        </div>
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="rounded-xl">
          {saving ? t("loading") : t("save")}
        </Button>
        <Button variant="outline" onClick={cancelEdit} className="rounded-xl">
          {t("cancel")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">{t("rulesTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("rulesDesc")}</p>
      </div>

      <Separator />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : !rules || rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
          <p className="text-sm font-medium">{t("rulesEmpty")}</p>
          <p className="text-xs text-muted-foreground">{t("rulesEmptyHint")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-xl border p-3 space-y-2 ${rule.enabled === 1 ? "border-border bg-card" : "border-border bg-muted/40 opacity-70"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Checkbox
                    checked={rule.enabled === 1}
                    onCheckedChange={(v) =>
                      updateRule.mutate({ id: rule.id, patch: { enabled: v === true ? 1 : 0 } })
                    }
                    aria-label={t("ruleEnabled")}
                  />
                  <span className="text-sm font-medium truncate">{rule.name}</span>
                  <Badge variant={rule.action === "reject" ? "destructive" : "secondary"}>
                    {rule.action === "reject" ? t("actionReject") : t("actionAccept")}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(rule)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DeleteDialog
                    trigger={
                      <Button variant="ghost" size="icon" className="hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                    title={t("deleteRule")}
                    description={t("deleteRuleConfirm", { name: rule.name })}
                    onConfirm={() => deleteRule.mutate(rule.id)}
                    cancelText={t("cancel")}
                    confirmText={t("delete")}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pl-7">
                <Badge variant="outline">{matchDescription(rule, t)}</Badge>
                <span>#{rule.priority}</span>
                {rule.store === 1 && <span>{t("storeEmail")}</span>}
                {rule.forwardTo && <span>→ {rule.forwardTo}</span>}
                {rule.notifyTelegram === 1 && <span>TG</span>}
                {rule.notifyWebhook === 1 && <span>Webhook</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId !== null ? (
        renderForm()
      ) : (
        <Button onClick={startCreate} variant="outline" className="w-full rounded-xl">
          <Plus className="h-4 w-4 mr-2" />
          {t("addRule")}
        </Button>
      )}
    </div>
  );
}
