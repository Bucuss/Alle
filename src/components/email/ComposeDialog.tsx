"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendEmail, createDraft, updateDraft } from "@/lib/api/send";

export interface ComposeInitial {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  bodyText?: string;
  inReplyTo?: string;
  draftId?: number;
}

interface ComposeDialogProps {
  open: boolean;
  onClose: () => void;
  initial?: ComposeInitial;
  title?: string;
}

export default function ComposeDialog({ open, onClose, initial, title = "写邮件" }: ComposeDialogProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftId, setDraftId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setTo(initial?.to || "");
      setCc(initial?.cc || "");
      setBcc(initial?.bcc || "");
      setSubject(initial?.subject || "");
      setBody(initial?.bodyText || "");
      setDraftId(initial?.draftId);
      setError("");
    }
  }, [open, initial]);

  const parseAddrs = (s: string) =>
    s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

  const handleSend = async () => {
    setError("");
    setSending(true);
    try {
      await sendEmail({
        to: parseAddrs(to),
        cc: parseAddrs(cc),
        bcc: parseAddrs(bcc),
        subject,
        text: body,
        inReplyTo: initial?.inReplyTo,
        draftId,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败");
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    setError("");
    setSaving(true);
    try {
      const payload = {
        toAddresses: to,
        ccAddresses: cc,
        bccAddresses: bcc,
        subject,
        bodyText: body,
        inReplyTo: initial?.inReplyTo || null,
      };
      if (draftId) {
        await updateDraft(draftId, payload);
      } else {
        const d = await createDraft(payload);
        setDraftId(d.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存草稿失败");
    } finally {
      setSaving(false);
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
            className="w-full max-w-2xl rounded-2xl bg-card shadow-xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold">{title}</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <div className="space-y-1.5">
                <Label>收件人</Label>
                <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="a@x.com, b@y.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>抄送</Label>
                  <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="可选" />
                </div>
                <div className="space-y-1.5">
                  <Label>密送</Label>
                  <Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="可选" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>主题</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="主题" />
              </div>
              <div className="space-y-1.5 flex-1 flex flex-col">
                <Label>正文</Label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="写点什么…"
                  rows={12}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-y min-h-[200px]"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">发件人：me@gear4ai.com</p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <Button variant="outline" onClick={handleSaveDraft} disabled={saving || sending}>
                <Save className="h-4 w-4 mr-1.5" />
                {saving ? "保存中…" : "存草稿"}
              </Button>
              <Button onClick={handleSend} disabled={sending || saving}>
                <Send className="h-4 w-4 mr-1.5" />
                {sending ? "发送中…" : "发送"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
