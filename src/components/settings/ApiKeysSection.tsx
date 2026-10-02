"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import DeleteDialog from "@/components/common/DeleteDialog";
import CopyButton from "@/components/common/CopyButton";
import { fetchApiKeys, createApiKey, revokeApiKey } from "@/lib/api/send";
import { Plus, Trash2 } from "lucide-react";

import type { ApiKeyInfo } from "@/lib/api/send";

export default function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setKeys(await fetchApiKeys());
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    setError("");
    setLoading(true);
    try {
      const created = await createApiKey(name.trim() || "default");
      setNewKey(created.raw);
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      await revokeApiKey(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "吊销失败");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">API Keys（MCP / Agent 调用）</h3>
        <p className="text-sm text-muted-foreground">
          给 agent（如 Muse）的调用凭证，请求头 <code>Authorization: Bearer &lt;key&gt;</code>。
          Key 明文只显示一次，请妥善保存。
        </p>
      </div>

      <Separator />

      {newKey && (
        <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
          <Label className="text-sm font-medium">新 Key（仅显示一次）</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs break-all bg-background rounded-lg px-3 py-2 border border-border">
              {newKey}
            </code>
            <CopyButton text={newKey} isCopied={copied} onCopy={() => setCopied(true)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setNewKey(null)}>
            我已保存
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key 名称，如 Muse"
          className="flex-1"
        />
        <Button onClick={handleCreate} disabled={loading}>
          <Plus className="h-4 w-4 mr-1.5" />
          {loading ? "创建中…" : "创建"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {keys.length === 0 && <p className="text-sm text-muted-foreground">暂无 API Key</p>}
        {keys.map((k) => (
          <div key={k.id} className="rounded-xl border border-border p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{k.name}</p>
                {k.revoked ? (
                  <Badge variant="destructive">已吊销</Badge>
                ) : (
                  <Badge variant="secondary">有效</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {k.keyPrefix}… · 创建于 {k.createdAt?.slice(0, 10)}
                {k.lastUsedAt ? ` · 上次使用 ${k.lastUsedAt.slice(0, 16).replace("T", " ")}` : ""}
              </p>
            </div>
            {!k.revoked && (
              <DeleteDialog
                trigger={
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                }
                title="吊销 API Key？"
                description={`吊销后使用该 Key 的 agent 将无法调用，确定吊销「${k.name}」吗？`}
                confirmText="吊销"
                cancelText="取消"
                onConfirm={() => handleRevoke(k.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
