"use client";

import { useCallback, useRef, useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/utils";
import { copyText } from "@/lib/utils/clipboard";

interface CopyButtonProps {
  text: string;
  isCopied: boolean;
  onCopy: () => void;
  className?: string;
}

export default function CopyButton({ text, isCopied, onCopy, className }: CopyButtonProps) {
  const [failed, setFailed] = useState(false);
  const failTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const ok = await copyText(text);
      if (ok) {
        onCopy();
        return;
      }
      // 两种复制方式都失败（如极端受限的嵌入环境）：明确提示而非假装成功
      setFailed(true);
      if (failTimer.current) clearTimeout(failTimer.current);
      failTimer.current = setTimeout(() => setFailed(false), 2000);
    },
    [onCopy, text],
  );

  return (
    <span className="relative inline-flex">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        title={failed ? "复制失败，请手动选择复制" : "复制"}
        className={cn("transition-all duration-200", className)}
      >
        <AnimatePresence mode="wait">
          {failed ? (
            <motion.div
              key="failed"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              <TriangleAlert className="text-destructive" />
            </motion.div>
          ) : isCopied ? (
            <motion.div
              key="check"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ duration: 0.2 }}
            >
              <Check className="text-chart-2" />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Copy />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>
      {failed && (
        <span className="absolute -top-8 right-0 whitespace-nowrap rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow-md">
          复制失败，请手动选择复制
        </span>
      )}
    </span>
  );
}
