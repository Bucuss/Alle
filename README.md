<p align="center">
  <img src="public/image/icons/icon.svg" width="80px" />
</p>

<div align="center">
  <h1>Alle</h1>
</div>

<div align="center">
  <span>简体中文 | <a href="/README_en.md" style="margin-left: 5px">English</a></span>
</div>

---

## 🌟 项目简介

**Alle** 是一款专为个人用户打造的 **邮件聚合与管理平台**。  
通过整合各个邮箱服务商的 **邮件转发功能**，Alle 实现了跨账户邮件的 **集中接收与统一管理**，让用户无需频繁切换邮箱，也能随时掌握全部信息。  

以简洁的设计和智能识别为核心，Alle 让邮件管理更高效、更清晰、更安全。  

---

## 🖼️ 界面预览

### 桌面端

![](public/image/screenshot/desktop-1.png) 

### 移动端
 ![](public/image/screenshot/mobile-1.png) | ![](public/image/screenshot/mobile-2.png) |
| ---- | ---- |

---

## 🚀 核心功能特点

### 📬 邮件聚合

Alle 依托于各邮箱服务商的 **自动转发功能** 来实现聚合。  
用户只需在原邮箱中设置转发规则，将邮件自动发送到 Alle 平台提供的专属地址，  
即可在一个界面中查看所有邮箱的收件内容。  

> ✅ 支持 Gmail、Outlook、QQ 邮箱 等主流邮箱  
> ✅ 支持自定义域名邮箱的转发设置  
> ✅ 无需输入邮箱密码，安全可靠  

这种聚合方式避免了多平台登录的麻烦，也降低了安全风险，轻松实现「一处收全邮」。  

---

### 🤖 AI 识别

Alle 内置的 AI 引擎可对邮件内容进行分析，自动识别并提取关键信息。  

**识别内容包括：**  
- 🔐 **验证码**：自动识别并提取验证码内容，支持快速复制与使用。  
- 🔗 **链接识别与分类**：智能区分邮件中的不同类型链接：  
  - 📨 **验证链接**：用于注册、登录确认、身份验证等场景（如登录 GitHub、验证新设备）。  
  - ⚙️ **服务链接**：识别来自 GitHub、GitLab、Notion 等服务的通知类链接（如 commit、pull request、任务变更等）。  
  - 🚫 **订阅链接**：识别广告营销邮件中的退订或偏好管理链接，帮助用户快速清理无用订阅。  

AI 识别功能让邮件阅读更直观，用户可直接从提取结果中完成操作，大幅提升使用体验。  

**工作流程：**  
- ⚡ **收信时同步提取**：邮件到达后立即提取验证码、验证链接等关键信息，实时可用  
- 🔄 **定时异步分类**：后台定时任务批量对邮件进行智能分类（验证码 / 订阅营销 / 账单财务 / 通知提醒 / 其他），置信度不足时归为"其他"  
- ⚙️ **可配置**：提取与分类所用的模型、定时频率、批量大小、置信度阈值等均通过环境变量配置（`EXTRACT_*`、`CLASSIFY_*`），无需改代码  

---

### 📨 临时邮箱服务

借助 **Cloudflare Workers** 的域名邮箱功能，Alle 允许用户快速创建 **无限数量的临时邮箱地址**。  

这些临时邮箱可用于：  
- 🧾 注册网站或服务时接收验证码  
- 🕵️‍♂️ 保持主邮箱隐私安全  
- ⚡ 临时接收一次性信息或测试邮件  

所有临时邮箱接收的邮件均会自动汇入主界面，统一管理，避免遗漏。  

---

### 📤 邮件发送

Alle 支持直接在网页端撰写并发送邮件（基于 Cloudflare Email Service，无需第三方发信服务）：  

- ✍️ **写邮件**：新建邮件并发送  
- ↩️ **回复 / 转发**：在邮件详情中一键回复或转发  
- 📝 **草稿箱**：自动保存、随时继续编辑、一键发送  
- 📥📤 **收件箱 / 已发送**：一键切换视图  
- 🔑 **API Keys 管理**：`Settings → API Keys` 可创建 / 吊销用于 MCP 调用的 API Key（明文只在创建时显示一次）  

> 发送域名需先在 Cloudflare Email Service 中完成验证；发件地址需在 Worker 的 `allowed_sender_addresses` 中配置。  

---

### 🔌 MCP 接口

Alle 提供 **MCP（Model Context Protocol）** 接口，可被 AI 助手调用，实现邮件的读取、管理、起草与发送。  

**接入信息**  
- 地址：`https://<你的域名>/api/mcp`  
- 协议：JSON-RPC 2.0 的 Streamable HTTP（无状态），支持 `initialize`、`tools/list`、`tools/call`  
- 认证：`Authorization: Bearer <api_key>`（在网页端 `Settings → API Keys` 创建）  

**可用工具（14 个）**  

| 工具 | 说明 |
| ---- | ---- |
| `list_emails` | 按条件列出邮件（支持 direction / category / read / limit 等过滤） |
| `get_email` | 读取单封邮件全文 |
| `set_read_status` | 标记已读 / 未读 |
| `set_category` | 修改邮件分类 |
| `delete_email` | 删除邮件 |
| `send_email` | 发送邮件（支持 `dry_run` 先预览不发送） |
| `reply_email` | 回复邮件 |
| `forward_email` | 转发邮件 |
| `list_drafts` / `get_draft` | 列出 / 读取草稿 |
| `create_draft` / `update_draft` / `delete_draft` | 新建 / 更新 / 删除草稿 |
| `send_draft` | 发送草稿 |

**调用示例**  

```bash
# 列出可用工具
curl -X POST https://<你的域名>/api/mcp \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 发邮件前先 dry_run 预览（不实际发送）
curl -X POST https://<你的域名>/api/mcp \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call",
       "params":{"name":"send_email","arguments":{
         "to":"someone@example.com","subject":"Hi","body":"Hello",
         "dry_run": true}}}'
```

> ⚠️ API Key 等同于登录凭证，请妥善保管；不再使用时请及时在网页端吊销。  

---

### 🔒 安全说明

- 网页端登录采用 JWT 鉴权；登录接口带限流（每 IP 每 60 秒 5 次、全局 20 次），防止暴力破解  
- API Key 仅存储哈希值，明文只在创建时显示一次，可随时吊销  
- 邮件正文在无脚本权限的沙箱 iframe 中渲染，阻断邮件内恶意脚本  

---

## 🛠️ 技术亮点

- 🌩️ **基于 Cloudflare Workers 构建**：  
  Alle 仅需一个域名即可部署，无需额外服务器或复杂环境配置，  
  充分利用边缘计算的高可用与低延迟特性。  

- ⚙️ **Next.js 架构**：  
  采用 **Next.js** 框架开发，拥有高性能渲染能力与良好的开发体验，  
  支持服务端渲染（SSR）与静态生成（SSG），确保页面加载快速、稳定。  

- 📱 **多平台自适应设计**：  
  使用响应式布局与 Tailwind CSS 样式体系，  
  为桌面端与移动端提供一致、流畅的交互体验。  

---

## 🧭 部署指南

Alle 的部署过程极为简洁，只需一个域名即可在 Cloudflare Workers 上运行。  
详细部署步骤请参考以下文档：  

👉 [📘 部署文档](docs/deploy.md)  

---

## 💡 愿景

Alle 致力于成为新一代的 **个人邮件中心**，通过智能聚合、AI 辅助与轻量部署，  
让用户以最小的成本享受高效、简洁、私密的邮件管理体验。  

---

<p align="center">
  <b>📧 Alle —— 让邮件更聪明，更简单。</b>
</p>
