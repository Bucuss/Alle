"use client";

import { useState, useRef, useMemo } from "react";

/**
 * 净化邮件 HTML 中的链接目标：
 * 邮件原文可能自带 <base> 标签或链接自带 target="_self"/"_parent" 等属性，
 * 会覆盖外层注入的 <base target="_blank">，导致点击后在 iframe 内直接导航；
 * 遇到带 X-Frame-Options 的站点（如 chatgpt.com）就会报 ERR_BLOCKED_BY_RESPONSE。
 * 这里强制所有链接在新标签页打开，并移除邮件自带的 <base>（避免相对路径被劫持）。
 * head 中的 <style> 会保留，渲染效果与之前直接注入一致。
 */
function sanitizeEmailHtml(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("base").forEach((el) => el.remove());
    doc.querySelectorAll("a[href]").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
    const headHtml = doc.head?.innerHTML ?? "";
    const bodyHtml = doc.body?.innerHTML ?? "";
    return headHtml + bodyHtml;
  } catch {
    return html;
  }
}

export default function EmailContent({ bodyHtml, bodyText }: { bodyHtml: string | null; bodyText: string | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(500);
  const safeBodyHtml = useMemo(() => (bodyHtml ? sanitizeEmailHtml(bodyHtml) : bodyHtml), [bodyHtml]);

  // 监听 iframe 加载事件，获取实际高度
  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentDocument) return;

    const doc = iframe.contentDocument;
    const body = doc.body;
    const html = doc.documentElement;

    // 获取内容实际高度
    const actualHeight = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );

    setIframeHeight(actualHeight);
  };

  if (!bodyHtml && !bodyText) {
    return null;
  }

  return (
    <div className="overflow-hidden">
      {bodyHtml ? (
        <iframe
          ref={iframeRef}
          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"></head><body>${safeBodyHtml}</body></html>`}
          style={{
            width: '100%',
            height: `${iframeHeight}px`,
            border: 'none',
            background: 'transparent'
          }}
          onLoad={handleIframeLoad}
          sandbox="allow-same-origin allow-popups allow-forms"
          title="Email Content"
        />
      ) : (
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {bodyText}
        </p>
      )}
    </div>
  );
}