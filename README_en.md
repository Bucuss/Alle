<p align="center">
  <img src="public/image/icons/icon.svg" width="80px" />
</p>

<div align="center">
  <h1>Alle</h1>
</div>

<div align="center">
  <span><a href="/README.md" style="margin-right: 5px">简体中文</a> | English</span>
</div>

---

## 🌟 Overview

**Alle** is an **email aggregation and management platform** designed specifically for individual users.
By integrating the **email forwarding features** of various email service providers, Alle enables **centralized reception and unified management** of emails across multiple accounts, allowing users to stay informed without frequently switching between email platforms.

With a focus on minimalist design and intelligent recognition, Alle makes email management more efficient, clearer, and more secure.

---

## 🖼️ Interface Preview

### Desktop

![](public/image/screenshot/desktop-1.png)

### Mobile
 ![](public/image/screenshot/mobile-1.png) | ![](public/image/screenshot/mobile-2.png) |
| ---- | ---- |

---

## 🚀 Key Features

### 📬 Email Aggregation

Alle achieves aggregation through the **automatic forwarding features** of various email service providers.
Users only need to set up forwarding rules in their original email accounts to automatically send emails to the dedicated address provided by the Alle platform,
allowing them to view all email inbox content from a single interface.

> ✅ Supports Gmail, Outlook, QQ Mail and other major email providers
> ✅ Supports forwarding configuration for custom domain emails
> ✅ No need to enter email passwords, safe and reliable

This aggregation approach avoids the hassle of logging into multiple platforms and reduces security risks, easily achieving "receive all emails in one place".

---

### 🤖 AI Recognition

Alle's built-in AI engine analyzes email content and automatically identifies and extracts key information.

**Recognition includes:**
- 🔐 **Verification codes**: Automatically identifies and extracts verification code content, supporting quick copy and use.
- 🔗 **Link identification and classification**: Intelligently distinguishes different types of links in emails:
  - 📨 **Verification links**: Used for registration, login confirmation, identity verification and other scenarios (such as logging into GitHub, verifying new devices).
  - ⚙️ **Service links**: Identifies notification links from services like GitHub, GitLab, Notion (such as commits, pull requests, task changes, etc.).
  - 🚫 **Subscription links**: Identifies unsubscribe or preference management links in advertising marketing emails, helping users quickly clean up unnecessary subscriptions.

The AI recognition feature makes email reading more intuitive, allowing users to complete operations directly from the extracted results, greatly improving the user experience.

**How it works:**
- ⚡ **Synchronous extraction on receipt**: key information such as verification codes and verification links is extracted the moment an email arrives, ready for immediate use
- 🔄 **Asynchronous scheduled classification**: a background cron job classifies emails in batches (verification codes / newsletters & marketing / billing & finance / notifications / others), falling back to "Others" when confidence is low
- ⚙️ **Configurable**: the models used for extraction and classification, the cron schedule, batch size, and confidence threshold are all set via environment variables (`EXTRACT_*`, `CLASSIFY_*`) — no code changes needed

---

### 📨 Temporary Email Service

With the domain email functionality of **Cloudflare Workers**, Alle allows users to quickly create **unlimited temporary email addresses**.

These temporary email addresses can be used for:
- 🧾 Receiving verification codes when registering for websites or services
- 🕵️‍♂️ Keeping the primary email privacy secure
- ⚡ Temporarily receiving one-time information or test emails

All emails received by temporary email addresses are automatically integrated into the main interface for unified management, avoiding missed messages.

---

### 📤 Email Sending

Alle supports composing and sending emails directly in the web UI (powered by Cloudflare Email Service, no third-party sending service required):

- ✍️ **Compose**: Create and send new emails
- ↩️ **Reply / Forward**: Reply or forward right from the email detail view
- 📝 **Drafts**: Auto-save, resume editing anytime, send with one click
- 📥📤 **Inbox / Sent**: Switch views with one click
- 🔑 **API Keys**: `Settings → API Keys` to create / revoke API keys for MCP access (the plaintext key is shown only once at creation)

> The sending domain must be verified in Cloudflare Email Service first; sender addresses must be listed in the Worker's `allowed_sender_addresses`.

---

### 🔌 MCP Interface

Alle provides an **MCP (Model Context Protocol)** interface that AI assistants can call to read, manage, draft, and send emails.

**Connection info**
- Endpoint: `https://<your-domain>/api/mcp`
- Protocol: JSON-RPC 2.0 over Streamable HTTP (stateless); supports `initialize`, `tools/list`, `tools/call`
- Auth: `Authorization: Bearer <api_key>` (create one in the web UI under `Settings → API Keys`)

**Available tools (14)**

| Tool | Description |
| ---- | ----------- |
| `list_emails` | List emails with filters (direction / category / read / limit, etc.) |
| `get_email` | Read a single email in full |
| `set_read_status` | Mark as read / unread |
| `set_category` | Change an email's category |
| `delete_email` | Delete an email |
| `send_email` | Send an email (`dry_run` supported for preview) |
| `reply_email` | Reply to an email |
| `forward_email` | Forward an email |
| `list_drafts` / `get_draft` | List / read drafts |
| `create_draft` / `update_draft` / `delete_draft` | Create / update / delete drafts |
| `send_draft` | Send a draft |

**Examples**

```bash
# List available tools
curl -X POST https://<your-domain>/api/mcp \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Preview before sending with dry_run (nothing is actually sent)
curl -X POST https://<your-domain>/api/mcp \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call",
       "params":{"name":"send_email","arguments":{
         "to":"someone@example.com","subject":"Hi","body":"Hello",
         "dry_run": true}}}'
```

> ⚠️ An API key is equivalent to your login credentials — keep it safe, and revoke it in the web UI when no longer needed.

---

### 🔒 Security Notes

- Web login uses JWT authentication; the login endpoint is rate-limited (5 attempts per 60s per IP, 20 per 60s globally) against brute-force attacks
- API keys are stored as hashes only; the plaintext is shown once at creation and keys can be revoked anytime
- Email bodies render inside a script-less sandboxed iframe, blocking malicious scripts in emails

---

## 🛠️ Technical Highlights

- 🌩️ **Built on Cloudflare Workers**:
  Alle only requires one domain to deploy, no additional servers or complex environment configuration needed,
  fully utilizing the high availability and low latency features of edge computing.

- ⚙️ **Next.js Architecture**:
  Developed using the **Next.js** framework with high-performance rendering capabilities and excellent development experience,
  supporting Server-Side Rendering (SSR) and Static Site Generation (SSG) to ensure fast and stable page loading.

- 📱 **Multi-platform Adaptive Design**:
  Using responsive layout and Tailwind CSS style system,
  providing consistent and smooth interactive experience for both desktop and mobile platforms.

---

## 🧭 Deployment Guide

Alle's deployment process is extremely simple, requiring only one domain to run on Cloudflare Workers.
For detailed deployment steps, please refer to the following documentation:

👉 [📘 Deployment Documentation](docs/deploy_en.md)

---

## 💡 Vision

Alle is committed to becoming a new generation of **personal email center**. Through intelligent aggregation, AI assistance, and lightweight deployment,
we enable users to enjoy efficient, simple, and private email management experience at minimal cost.

---

<p align="center">
  <b>📧 Alle —— Making emails smarter and simpler.</b>
</p>
