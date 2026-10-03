"use client";

import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Settings as SettingsIcon, CheckSquare, Square, Trash2, Search, X, PenLine, FileText, Inbox, Send, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DeleteDialog from "@/components/common/DeleteDialog";
import ComposeDialog from "@/components/email/ComposeDialog";
import DraftsDialog from "@/components/email/DraftsDialog";
import useTranslation from "@/lib/hooks/useTranslation";
import useEmailStore from "@/lib/store/email";
import { useCategories } from "@/lib/hooks/useRulesApi";
import { useState, useEffect } from "react";

import type { ComposeInitial } from "@/components/email/ComposeDialog";

interface EmailListHeaderProps {
  selectedEmails: Set<number>;
  loading: boolean;
  onRefresh: () => void;
  onToggleSelectAll: () => void;
  onBatchDelete: () => Promise<void> | void;
  onClearSelection: () => void;
  onOpenSettings: () => void;
}

const UNCATEGORIZED_VALUE = "__none__";
const ALL_CATEGORIES_VALUE = "__all__";

export default function EmailListHeader({
  selectedEmails,
  loading,
  onRefresh,
  onToggleSelectAll,
  onBatchDelete,
  onClearSelection,
  onOpenSettings,
}: EmailListHeaderProps) {
  const { t } = useTranslation();
  const totalCount = useEmailStore((state) => state.total);
  const emailCount = useEmailStore((state) => state.emails.length);
  const filters = useEmailStore((state) => state.filters);
  const updateFilters = useEmailStore((state) => state.updateFilters);
  const { data: categories } = useCategories();

  const [searchInput, setSearchInput] = useState(filters.search);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<ComposeInitial | undefined>(undefined);
  const [composeTitle, setComposeTitle] = useState("写邮件");
  const [draftsOpen, setDraftsOpen] = useState(false);

  const openCompose = (initial?: ComposeInitial, title = "写邮件") => {
    setComposeInitial(initial);
    setComposeTitle(title);
    setComposeOpen(true);
  };

  // 搜索输入防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        updateFilters({ search: searchInput });
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const selectionCount = selectedEmails.size;
  const hasSelection = selectionCount > 0;
  const isAllSelected = hasSelection && selectionCount === emailCount;

  const categorySelectValue =
    filters.categories.length === 0
      ? ALL_CATEGORIES_VALUE
      : filters.categories[0];

  const handleCategoryChange = (value: string) => {
    if (value === ALL_CATEGORIES_VALUE) {
      updateFilters({ categories: [] });
    } else {
      updateFilters({ categories: [value] });
    }
  };

  return (
    <div className="border-b">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between px-6 py-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">{filters.importantOnly ? t("important") : t("inbox")}</h1>
          <p className="text-sm text-muted-foreground">
            {hasSelection ? t("selectedCount", { count: selectionCount }) : t("emailsCount", { count: totalCount })}
          </p>
        </div>

        <AnimatePresence mode="popLayout">
          {hasSelection ? (
            <motion.div
              key="selection-actions"
              layout
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
              className="flex items-center gap-2"
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSelectAll}
              >
                {isAllSelected ? (
                  <motion.div
                    key="all-selected"
                    layout
                    initial={{ rotate: -90, scale: 0.8, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CheckSquare />
                  </motion.div>
                ) : (
                  <motion.div
                    key="partial-selected"
                    layout
                    initial={{ rotate: 90, scale: 0.8, opacity: 0 }}
                    animate={{ rotate: 0, scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Square />
                  </motion.div>
                )}
              </Button>

              <DeleteDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-destructive/10 hover:text-destructive"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <motion.div
                      whileHover={{ rotate: -12 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <Trash2 />
                    </motion.div>
                  </Button>
                }
                title={t("batchDeleteConfirm")}
                description={t("batchDeleteDesc", { count: selectionCount })}
                onConfirm={(event) => {
                  event?.stopPropagation();
                  onBatchDelete();
                }}
                cancelText={t("cancel")}
                confirmText={t("delete")}
                allowUnsafeHtml
              />

              <Button variant="outline" onClick={onClearSelection}>{t("cancel")}</Button>
            </motion.div>
          ) : (
            <motion.div
              key="default-actions"
              layout
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
              className="flex items-center gap-2"
            >
              <Button variant="ghost" size="icon" title="草稿箱" onClick={() => setDraftsOpen(true)}>
                <FileText className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="写邮件" onClick={() => openCompose()}>
                <PenLine className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onOpenSettings}>
                <motion.div
                  layout
                  whileHover={{ rotate: 20 }}
                  whileTap={{ rotate: -20 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  <SettingsIcon />
                </motion.div>
              </Button>
              <Button size="icon" onClick={onRefresh} disabled={loading} className="shadow-sm hover:shadow-md transition-all duration-200">
                <motion.div animate={{ rotate: loading ? 360 : 0 }} transition={{ repeat: loading ? Infinity : 0, duration: 0.8, ease: "linear" }}>
                  <RefreshCw />
                </motion.div>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* 搜索 + 分类筛选行 */}
      {!hasSelection && (
        <div className="flex items-center gap-2 px-6 pb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9 pr-9 rounded-xl"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  updateFilters({ search: "" });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t("clearSearch")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={categorySelectValue} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[140px] rounded-xl">
              <SelectValue placeholder={t("allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES_VALUE}>{t("allCategories")}</SelectItem>
              {(categories || [])
                .filter((c) => c.enabled === 1)
                .map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              <SelectItem value={UNCATEGORIZED_VALUE}>{t("uncategorized")}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex rounded-xl border border-input overflow-hidden">
            <button
              onClick={() => updateFilters({ direction: "inbound", importantOnly: false })}
              title={t("inbox")}
              aria-label={t("inbox")}
              className={`p-2 flex items-center justify-center ${!filters.importantOnly && filters.direction === "inbound" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Inbox className="h-4 w-4" />
            </button>
            <button
              onClick={() => updateFilters({ direction: "outbound", importantOnly: false })}
              title={t("sent")}
              aria-label={t("sent")}
              className={`p-2 flex items-center justify-center ${!filters.importantOnly && filters.direction === "outbound" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => updateFilters({ importantOnly: !filters.importantOnly })}
            title={t("important")}
            aria-label={t("important")}
            className={`p-2 flex items-center justify-center rounded-xl border border-input ${filters.importantOnly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Star className="h-4 w-4" />
          </button>
        </div>
      )}
      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} initial={composeInitial} title={composeTitle} />
      <DraftsDialog open={draftsOpen} onClose={() => setDraftsOpen(false)} onEdit={(initial, title) => { setDraftsOpen(false); openCompose(initial, title); }} />
    </div>
  );
}
