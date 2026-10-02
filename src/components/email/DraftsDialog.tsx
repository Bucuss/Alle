"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Send, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchDrafts, deleteDraft, sendDraft } from "@/lib/api/send";

import type { Draft } from "@/lib/api/send";
import type { ComposeInitial } from "@/components/email/ComposeDialog";

interface DraftsDialogProps {
  open: boolean;
  onClose: () => void;
  onEdit: (initial: ComposeInitial, title: string) => void;
}

export default function DraftsDialog({ open, onClose, onEdit }: DraftsDialogProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setDrafts(await fetchDrafts());
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open ]);

  const handleDelete = async (id: number) => {
    setBusyId(id);
    try {
      await deleteDraft(id);
      setDrafts((ds) => ds.filter((d) => d.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusyId(null);
    }
  };

  const handleSend = async (id: number) => {
    setBusyId(id);
    setError("");
    try {
      await sendDraft(id);
      setDrafts((ds) => ds.filter((d) => d.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-xl rounded-2xl bg-card shadow-xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold">草稿箱</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {loading && <p className="text-sm text-muted-foreground">加载中…</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {!loading && drafts.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无草稿</p>
              )}
              {drafts.map((d) => (
                <div key={d.id} className="rounded-xl border border-border p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.subject || "(无主题)"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.toAddresses || "(无收件人)"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="编辑"
                    onClick={() =>
                      onEdit(
                        {
                          to: d.toAddresses,
                          cc: d.ccAddresses,
                          bcc: d.bccAddresses,
                          subject: d.subject,
                          bodyText: d.bodyText,
                          inReplyTo: d.inReplyTo || undefined,
                          draftId: d.id,
                        },
                        "编辑草稿"
                      )
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="发送" disabled={busyId === d.id} onClick={() => handleSend(d.id)}>
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="删除" disabled={busyId === d.id} onClick={() => handleDelete(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
