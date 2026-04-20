# Well of Wishes — Community Integration Guide

This document describes how to integrate a third-party community system (Discord bot, forum platform, guild portal, etc.) with **באר המשאלות / Well of Wishes (WoW)** so that community members can link their community identity to their WoW account.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [The Linking Flow — Step by Step](#3-the-linking-flow--step-by-step)
4. [Step 1 — Initiate: Server-to-Server API Call](#4-step-1--initiate-server-to-server-api-call)
   - [Request signing](#41-request-signing)
   - [Request format](#42-request-format)
   - [Response format](#43-response-format)
   - [Code examples](#44-code-examples)
5. [Step 2 — Redirect: Send the User to WoW](#5-step-2--redirect-send-the-user-to-wow)
6. [Step 3 — Completion: WoW authenticates the user](#6-step-3--completion-wow-authenticates-the-user)
7. [Querying Link Status](#7-querying-link-status)
8. [Unlinking](#8-unlinking)
9. [Error Reference](#9-error-reference)
10. [Security Notes](#10-security-notes)
11. [Sequence Diagram](#11-sequence-diagram)
12. [Checklist](#12-checklist)

---

## 1. Overview

Linking a community account to WoW is a three-step handshake:

```
Community Backend  →  POST /api/community-links/initiate  →  WoW Backend
WoW Backend        →  returns link_url                    →  Community Backend
Community Frontend →  redirect user to link_url           →  WoW (user authenticates)
WoW                →  creates permanent link, redirects   →  /connect/community/success
```

The flow proves that **the user controls the email address** they registered with in the community system. WoW stores a permanent mapping between `(server_id, community_user_id)` and the authenticated WoW account. No passwords or tokens are ever exchanged directly — the only shared secret is the HMAC signing key.

---

## 2. Prerequisites

Before you can call any WoW API you need two secrets. Request them from the WoW team:

| Secret | Purpose | Header / Env var |
|---|---|---|
| `COMMUNITY_LINK_CLIENT_KEY` | Static API key — identifies your community system | `X-Community-Key` |
| `COMMUNITY_LINK_SHARED_SECRET` | HMAC-SHA256 signing key — proves request integrity | Used to compute `X-Signature` |

Store both secrets in your backend environment. **Never expose them in frontend code, mobile apps, or logs.**

---

## 3. The Linking Flow — Step by Step

```
User clicks "Link WoW account" in your community UI
        │
        ▼
[Your backend]  POST /api/community-links/initiate
        │       (signed server-to-server request)
        │
        ▼
[WoW backend]   validates signature, creates pending handshake
        │       returns { link_url, handshake_token, expires_at }
        │
        ▼
[Your frontend] redirects the user's browser to link_url
        │       (link_url is valid for 10 minutes)
        │
        ▼
[WoW UI]        user signs in with Google or email magic-link
        │       WoW verifies the email matches, creates permanent link
        │
        ▼
[WoW]           redirects user to /connect/community/success
        │
        ▼
User sees success screen, returns to your community
```

---

## 4. Step 1 — Initiate: Server-to-Server API Call

### 4.1 Request Signing

Every request must be signed with HMAC-SHA256. The signature proves the request was sent by a holder of `COMMUNITY_LINK_SHARED_SECRET` and was not tampered with in transit.

**Signing algorithm:**

```
timestamp      = current UTC time as ISO 8601 string  (e.g. "2024-11-15T14:30:00.000Z")
nonce          = cryptographically random string, used exactly once  (e.g. 32 hex chars)
canonical_body = JSON.stringify(body, keys sorted A–Z, no extra whitespace)
message        = timestamp + "\n" + nonce + "\n" + canonical_body
signature      = HMAC-SHA256(message, COMMUNITY_LINK_SHARED_SECRET)  →  lowercase hex
```

**Critical rules:**
- The body keys **must be sorted alphabetically** (A→Z) before serialising. This makes the canonical form deterministic regardless of the order you construct the object.
- Use **no extra whitespace** in the JSON — `JSON.stringify(sorted)`, not pretty-printed.
- The timestamp in the message must match the `X-Timestamp` header **and** the `timestamp` field in the body (they are the same value).
- Nonces are single-use. A nonce that has been accepted once will be rejected forever. Generate a fresh nonce for every request.
- Requests whose timestamp is more than **5 minutes** away from WoW server time are rejected. Keep your system clock synchronised (NTP).

**Required headers:**

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-Community-Key` | Your `COMMUNITY_LINK_CLIENT_KEY` |
| `X-Timestamp` | Same ISO 8601 timestamp as in the body |
| `X-Nonce` | Same nonce as in the body |
| `X-Signature` | HMAC-SHA256 hex string computed as above |

---

### 4.2 Request Format

```
POST https://wow.example.com/api/community-links/initiate
```

**Body (JSON):**

| Field | Type | Required | Description |
|---|---|---|---|
| `community_user_id` | `string` | Yes | Stable, unique identifier for the user within your system (e.g. Discord user ID, database UUID). Never changes for a given user. |
| `server_id` | `string` | Yes | Stable identifier for your community / server (e.g. Discord guild ID). Used to scope the link — one WoW user may only link one community identity per server. |
| `email` | `string` | Yes | The email address the user registered with in your system. WoW will verify the user authenticates with this exact address. |
| `display_name` | `string` | No | Human-readable name to show on the WoW linking screen (e.g. Discord username). |
| `timestamp` | `string` | Yes | ISO 8601 UTC timestamp. Must match `X-Timestamp` header. |
| `nonce` | `string` | Yes | Random single-use string. Must match `X-Nonce` header. |

**Example body (before sorting for signature):**

```json
{
  "community_user_id": "123456789012345678",
  "server_id": "987654321098765432",
  "email": "user@example.com",
  "display_name": "AwesomeUser#1234",
  "timestamp": "2024-11-15T14:30:00.000Z",
  "nonce": "a3f8c2e1d4b7091e5f6a2c3d4e5f60718"
}
```

**Canonical body (keys sorted A–Z):**

```json
{"community_user_id":"123456789012345678","display_name":"AwesomeUser#1234","email":"user@example.com","nonce":"a3f8c2e1d4b7091e5f6a2c3d4e5f60718","server_id":"987654321098765432","timestamp":"2024-11-15T14:30:00.000Z"}
```

---

### 4.3 Response Format

**Success — HTTP 200:**

```json
{
  "status": "ok",
  "handshake_token": "hl_a1b2c3d4e5f6...",
  "link_url": "https://wow.example.com/connect/community?token=hl_a1b2c3d4e5f6...",
  "expires_at": "2024-11-15T14:40:00.000Z"
}
```

| Field | Description |
|---|---|
| `handshake_token` | Opaque token. Store it if you want to track completion. |
| `link_url` | Redirect the user's browser here. Valid for **10 minutes**. |
| `expires_at` | ISO 8601 UTC — when the link_url expires. |

**Error — HTTP 4xx/5xx:**

```json
{ "error": "ERROR_CODE" }
```

See [Section 9 — Error Reference](#9-error-reference) for all codes.

---

### 4.4 Code Examples

#### Node.js / TypeScript

```typescript
import { createHmac, randomBytes } from 'crypto'

const WOW_BASE_URL  = 'https://wow.example.com'
const CLIENT_KEY    = process.env.COMMUNITY_LINK_CLIENT_KEY!
const SHARED_SECRET = process.env.COMMUNITY_LINK_SHARED_SECRET!

interface InitiateParams {
  communityUserId: string
  serverId:        string
  email:           string
  displayName?:    string
}

async function initiateWowLink(params: InitiateParams) {
  const timestamp = new Date().toISOString()
  const nonce     = randomBytes(16).toString('hex')

  const body = {
    community_user_id: params.communityUserId,
    server_id:         params.serverId,
    email:             params.email,
    ...(params.displayName ? { display_name: params.displayName } : {}),
    timestamp,
    nonce,
  }

  // Sort keys A–Z for deterministic canonical form
  const sorted         = Object.fromEntries(Object.entries(body).sort(([a], [b]) => a.localeCompare(b)))
  const canonicalBody  = JSON.stringify(sorted)
  const message        = `${timestamp}\n${nonce}\n${canonicalBody}`
  const signature      = createHmac('sha256', SHARED_SECRET).update(message, 'utf8').digest('hex')

  const res = await fetch(`${WOW_BASE_URL}/api/community-links/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-Community-Key': CLIENT_KEY,
      'X-Timestamp':     timestamp,
      'X-Nonce':         nonce,
      'X-Signature':     signature,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`WoW link initiation failed: ${err.error ?? res.status}`)
  }

  return res.json() as Promise<{
    status:          string
    handshake_token: string
    link_url:        string
    expires_at:      string
  }>
}
```

#### Python

```python
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timezone

import httpx  # pip install httpx

WOW_BASE_URL  = "https://wow.example.com"
CLIENT_KEY    = os.environ["COMMUNITY_LINK_CLIENT_KEY"]
SHARED_SECRET = os.environ["COMMUNITY_LINK_SHARED_SECRET"]


def initiate_wow_link(
    community_user_id: str,
    server_id: str,
    email: str,
    display_name: str | None = None,
) -> dict:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + \
                f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"
    nonce = secrets.token_hex(16)

    body: dict = {
        "community_user_id": community_user_id,
        "server_id":         server_id,
        "email":             email,
        "timestamp":         timestamp,
        "nonce":             nonce,
    }
    if display_name:
        body["display_name"] = display_name

    # Sort keys A–Z for deterministic canonical form
    sorted_body    = dict(sorted(body.items()))
    canonical_body = json.dumps(sorted_body, separators=(",", ":"))
    message        = f"{timestamp}\n{nonce}\n{canonical_body}"
    signature      = hmac.new(
        SHARED_SECRET.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    response = httpx.post(
        f"{WOW_BASE_URL}/api/community-links/initiate",
        json=body,
        headers={
            "Content-Type":    "application/json",
            "X-Community-Key": CLIENT_KEY,
            "X-Timestamp":     timestamp,
            "X-Nonce":         nonce,
            "X-Signature":     signature,
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()
```

#### PHP

```php
<?php

function initiateWowLink(
    string $communityUserId,
    string $serverId,
    string $email,
    ?string $displayName = null
): array {
    $wowBaseUrl   = 'https://wow.example.com';
    $clientKey    = getenv('COMMUNITY_LINK_CLIENT_KEY');
    $sharedSecret = getenv('COMMUNITY_LINK_SHARED_SECRET');

    $timestamp = gmdate('Y-m-d\TH:i:s.') . sprintf('%03d', (int)(microtime(true) * 1000) % 1000) . 'Z';
    $nonce     = bin2hex(random_bytes(16));

    $body = [
        'community_user_id' => $communityUserId,
        'server_id'         => $serverId,
        'email'             => $email,
        'timestamp'         => $timestamp,
        'nonce'             => $nonce,
    ];
    if ($displayName !== null) {
        $body['display_name'] = $displayName;
    }

    // Sort keys A–Z for deterministic canonical form
    ksort($body);
    $canonicalBody = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $message       = "{$timestamp}\n{$nonce}\n{$canonicalBody}";
    $signature     = hash_hmac('sha256', $message, $sharedSecret);

    $ch = curl_init("{$wowBaseUrl}/api/community-links/initiate");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($body),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            "X-Community-Key: {$clientKey}",
            "X-Timestamp: {$timestamp}",
            "X-Nonce: {$nonce}",
            "X-Signature: {$signature}",
        ],
    ]);
    $raw      = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($raw, true);
    if ($httpCode !== 200) {
        throw new RuntimeException('WoW link initiation failed: ' . ($data['error'] ?? $httpCode));
    }
    return $data;
}
```

---

## 5. Step 2 — Redirect: Send the User to WoW

After a successful initiate call, redirect the user's **browser** (not a server-side request) to `link_url`:

```
HTTP 302  Location: https://wow.example.com/connect/community?token=hl_...
```

- The link is valid for **10 minutes** from the time of the initiate call. If the user does not complete the flow within this window, they must start over.
- Do **not** fetch the `link_url` server-side. It is a user-facing page, not an API endpoint.
- If your community system is a **Discord bot**, send the user a DM or ephemeral message containing the link rather than redirecting.

---

## 6. Step 3 — Completion: WoW Authenticates the User

WoW handles everything from this point:

1. The user arrives at `/connect/community?token=...`
2. WoW verifies the token is valid and not expired.
3. The user signs in with Google OAuth or an email magic-link.
4. WoW confirms that the authenticated email matches the email you submitted in the initiate request.
5. WoW writes a permanent link row and redirects the user to `/connect/community/success`.

**Your system does not need to poll or take any further action.** The link is now active and can be queried via the status endpoint (Section 7).

### What happens if the email doesn't match?

The user sees an error screen and is invited to sign in again with the correct address. No link is created. You may initiate a new handshake if needed.

---

## 7. Querying Link Status

You can check whether a specific community identity is currently linked by calling the initiate endpoint and inspecting the response code:

| Response | Meaning |
|---|---|
| `200 ok` with `link_url` | User is **not** linked — flow was initiated |
| `409 ALREADY_LINKED` | User **is** linked |

Alternatively, maintain your own state: store the `handshake_token` from the initiate response and treat a later `ALREADY_LINKED` response (or a user-triggered re-link attempt) as confirmation.

> There is no public polling endpoint; link verification is intentionally kept at the initiate boundary to avoid leaking link status to unauthenticated callers.

---

## 8. Unlinking

The user can unlink their WoW account at any time from the WoW UI. When they do, the `link_status` is set to `'unlinked'` (the row is kept for audit).

If the user initiates a new link after unlinking, the handshake will succeed and the row will be updated to `'linked'` again.

From your community system's perspective: if you receive `ALREADY_LINKED` for a user you believe is unlinked, it means the user re-linked via WoW's UI. You can re-initiate the flow to get a fresh `link_url` if needed — the new link will overwrite the previous one for that `(server_id, community_user_id)` pair.

---

## 9. Error Reference

All error responses have the shape `{ "error": "ERROR_CODE" }`.

### Initiate endpoint errors

| HTTP | Code | Cause | Action |
|---|---|---|---|
| 400 | `INVALID_PAYLOAD` | Missing required body fields | Check all required fields are present and non-empty |
| 400 | `EXPIRED_REQUEST` | `timestamp` is more than 5 minutes old | Sync system clock; generate a fresh timestamp per request |
| 401 | `INVALID_CLIENT_KEY` | `X-Community-Key` header missing or wrong | Verify `COMMUNITY_LINK_CLIENT_KEY` env var |
| 401 | `INVALID_SIGNATURE` | HMAC check failed | Verify signing algorithm; check key sorting, encoding, no extra whitespace in canonical body |
| 409 | `ALREADY_LINKED` | This `(server_id, community_user_id)` pair already has an active link | No action needed — user is already linked |
| 409 | `NONCE_ALREADY_USED` | The nonce was seen in a previous request | Always generate a new random nonce per request |
| 500 | `INTERNAL_ERROR` | WoW server error | Retry with exponential back-off; contact WoW team if persistent |

### Connect flow errors (shown to users in the browser)

| Scenario | What the user sees |
|---|---|
| Token not found | "קישור לא תקין" — link is invalid |
| Token expired | "קישור פג תוקף" — link expired, must re-initiate |
| Token already consumed | "קישור כבר שומש" — link was already used |
| Email mismatch | Invited to sign in with the correct email address |
| Link conflict | The WoW account is already linked to a different community identity on this server |

---

## 10. Security Notes

### Secrets management
- Store `COMMUNITY_LINK_CLIENT_KEY` and `COMMUNITY_LINK_SHARED_SECRET` in environment variables only — never in code, config files committed to git, or client-side bundles.
- Rotate secrets periodically. Contact the WoW team to coordinate rotation.

### Nonce requirements
- Generate a new nonce for **every** initiate call using a cryptographically secure RNG (`crypto.randomBytes`, `secrets.token_hex`, `random_bytes`).
- A nonce that is accepted once is stored permanently. Any replay of the same nonce within the WoW system will be rejected with `NONCE_ALREADY_USED`.

### Timestamp window
- The 5-minute freshness window prevents replay of captured requests. If your backend's clock is more than 5 minutes off, all requests will be rejected. Use NTP.

### HMAC key ordering
- The canonical body is `JSON.stringify` of the body object with **keys sorted alphabetically (A→Z)**. Any difference in key order will produce a different signature and your request will fail. Verify this carefully in your implementation.

### User email as identity proof
- WoW uses the email you submit as the sole proof-of-identity mechanism. Submit the email address the user actually registered with in your system. Do not submit a placeholder or admin address.
- Emails are stored as lowercase + trimmed. Submit addresses in that form to avoid mismatch errors caused by case differences.

### HTTPS only
- All communication with the WoW API must be over HTTPS. HTTP requests will be refused.

### Server-to-server only
- The initiate endpoint is server-to-server. Never call it from frontend JavaScript — the shared secret would be exposed.

---

## 11. Sequence Diagram

```
Community User        Community Frontend   Community Backend   WoW API          WoW Frontend
      │                       │                   │               │                  │
      │  click "Link WoW"     │                   │               │                  │
      │──────────────────────►│                   │               │                  │
      │                       │  POST /initiate   │               │                  │
      │                       │──────────────────►│               │                  │
      │                       │                   │  POST /api/   │                  │
      │                       │                   │  community-   │                  │
      │                       │                   │  links/initiate                  │
      │                       │                   │──────────────►│                  │
      │                       │                   │               │ verify key+HMAC  │
      │                       │                   │               │ check timestamp  │
      │                       │                   │               │ store nonce      │
      │                       │                   │               │ create pending   │
      │                       │                   │  { link_url } │                  │
      │                       │                   │◄──────────────│                  │
      │                       │  redirect to      │               │                  │
      │                       │  link_url         │               │                  │
      │                       │◄──────────────────│               │                  │
      │  browser redirected   │                   │               │                  │
      │◄──────────────────────│                   │               │                  │
      │                                                           │                  │
      │  GET /connect/community?token=...                         │                  │
      │──────────────────────────────────────────────────────────►│                  │
      │                                                           │ validate token   │
      │                                                           │ show auth UI     │
      │◄──────────────────────────────────────────────────────────│                  │
      │                                                                              │
      │  sign in with Google / magic-link                                            │
      │─────────────────────────────────────────────────────────────────────────────►│
      │                                                           │ verify email     │
      │                                                           │ create link      │
      │                                                           │ mark consumed    │
      │◄─────────────────────────────────────────────────────────────────────────────│
      │  /connect/community/success                                                  │
```

---

## 12. Checklist

Use this checklist before going live:

- [ ] Received `COMMUNITY_LINK_CLIENT_KEY` and `COMMUNITY_LINK_SHARED_SECRET` from WoW team
- [ ] Secrets stored in backend environment variables only (not in code or frontend)
- [ ] System clock is NTP-synchronised
- [ ] Signing implementation sorts body keys alphabetically before `JSON.stringify`
- [ ] A fresh cryptographically-random nonce is generated for every request
- [ ] `timestamp` in body matches `X-Timestamp` header exactly
- [ ] `nonce` in body matches `X-Nonce` header exactly
- [ ] Email submitted is the user's actual registered email (lowercase, trimmed)
- [ ] `link_url` is opened in the user's **browser**, not fetched server-side
- [ ] Your UI informs the user the link expires in 10 minutes and shows a "retry" path
- [ ] `ALREADY_LINKED` (409) is handled gracefully — user is already connected
- [ ] Tested a complete flow end-to-end in staging before production

---

*Last updated: 2026-04-20. For questions or to request credentials, contact the WoW development team.*
