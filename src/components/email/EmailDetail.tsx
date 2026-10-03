"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Reply, Forward, CheckCheck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import useTranslation from "@/lib/hooks/useTranslation";
import { useSettingsStore } from "@/lib/store/settings";
import EmailContent from "@/components/email/EmailContent";
import EmailAvatar from "@/components/email/EmailAvatar";
import EmailEditResult from "@/components/email/EmailEditResult";
import ComposeDialog from "@/components/email/ComposeDialog";
import { useMarkEmail, useMarkImportantHandled } from "@/lib/hooks/useEmailApi";
import type { Email } from "@/types";
import type { ComposeInitial } from "@/components/email/ComposeDialog";

export default function EmailDetail({ email }: { email: Email | null }) {
  const { t } = useTranslation();
  const { editMode } = useSettingsStore();
  const { mutate: markEmail } = useMarkEmail();
  const { mutate: markHandled } = useMarkImportantHandled();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<ComposeInitial | undefined>(undefined);
  const [composeTitle, setComposeTitle] = useState("写邮件");

  useEffect(() => {
    if (!email || email.readStatus === 1) {
      return;
    }

    markEmail({ emailId: email.id, isRead: true });
  }, [email, markEmail]);

  if (!email) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center justify-center h-full w-full"
      >
        <div className="flex flex-col items-center text-center p-8">
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4"
          >
            <Mail className="h-10 w-10 text-muted-foreground" />
          </motion.div>
          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="text-lg font-semibold text-foreground mb-2"
          >
            选择一封邮件
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="text-sm text-muted-foreground max-w-sm"
          >
            从左侧列表中选择一封邮件以查看详细内容
          </motion.p>
        </div>
      </motion.div>
    );
  }

  const openReply = () => {
    if (!email) return;
    const subj = email.title || "";
    setComposeInitial({
      to: email.direction === "outbound" ? email.toAddress || "" : email.fromAddress || "",
      subject: /^re:/i.test(subj) ? subj : `Re: ${subj}`,
      bodyText: `\n\nOn ${email.sentAt || ""}, ${email.fromAddress || ""} wrote:\n` + (email.bodyText || "").split("\n").map((l) => `> ${l}`).join("\n"),
      inReplyTo: email.messageId || undefined,
    });
    setComposeTitle("回复邮件");
    setComposeOpen(true);
  };

  const openForward = () => {
    if (!email) return;
    const subj = email.title || "";
    setComposeInitial({
      subject: /^fw:/i.test(subj) ? subj : `Fw: ${subj}`,
      bodyText: `---------- Forwarded message ----------\nFrom: ${email.fromAddress || ""}\nDate: ${email.sentAt || ""}\nSubject: ${subj}\n\n${email.bodyText || ""}`,
    });
    setComposeTitle("转发邮件");
    setComposeOpen(true);
  };

  const formatFullTime = (sentAt: string | null): string => {
    if (!sentAt) return '';
    const date = new Date(sentAt);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <motion.div
      key={email.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col h-full"
    >
      {/* 头部 + 邮件主题 */}
      <div className="flex-shrink-0 bg-card">
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex-shrink-0"
            >
              <EmailAvatar
                name={email.fromName || ""}
                fromAddress={email.fromAddress}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="flex-1 min-w-0"
            >
              <div>
                <span className="mr-1 text-xl font-bold">{email.fromName}</span>
                <span className="text-sm text-muted-foreground">
                  {email.fromAddress}
                </span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground mr-1">
                  {email.toAddress}
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatFullTime(email.sentAt)}
                </span>
              </div>
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="px-6 pb-2 flex items-center justify-between gap-2"
        >
          <h3 className="text-base font-semibold text-foreground leading-relaxed flex-1 min-w-0">
            {email.title}
          </h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" title="回复" onClick={openReply}>
              <Reply className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" title="转发" onClick={openForward}>
              <Forward className="h-4 w-4" />
            </Button>
            {email.isImportant === 1 && email.importantHandled === 0 && (
              <Button
                variant="ghost"
                size="icon"
                title={t("markHandled")}
                aria-label={t("markHandled")}
                onClick={() => markHandled(email.id)}
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
            )}
          </div>
        </motion.div>


        {editMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.3 }}
            className="px-6 pb-4"
          >
            <EmailEditResult email={email} />
          </motion.div>
        )}

        <div className="border-b border-border"></div>
      </div>

      {/* 内容区域 */}
      <ScrollArea className="flex-1 min-h-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
        >
          {/* 邮件正文 */}
          <EmailContent
            bodyHtml={email.bodyHtml}
            bodyText={email.bodyText}
          />
        </motion.div>
      </ScrollArea>
      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} initial={composeInitial} title={composeTitle} />
    </motion.div >
  );
}
