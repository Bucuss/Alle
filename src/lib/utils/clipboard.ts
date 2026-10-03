/**
 * 可靠的文本复制：带降级链，适配被嵌入 iframe 等受限场景。
 *
 * - 优先使用异步 Clipboard API（navigator.clipboard.writeText）；
 * - 在 iframe 未获得 `allow="clipboard-write"` 时该 API 会抛 NotAllowedError，
 *   此时降级为传统的 document.execCommand('copy')（不经过 Permissions Policy，
 *   在用户手势触发时可用）；
 * - 都失败时返回 false，由调用方决定如何提示用户。
 */
export async function copyText(text: string): Promise<boolean> {
  // 1. 现代 Clipboard API
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 被 Permissions Policy 拦截等，继续走降级
  }

  // 2. 传统 execCommand 降级
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
