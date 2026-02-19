# Soma — Cloud-Powered Messaging API

> Send **Email** and **SMS** via **Resend** and **Twilio**.  
> A unified messaging API with delivery tracking, templates, and webhooks.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Soma API (Express.js)                 │
│                                                              │
│  POST /v1/emails  ──► Email Record (Postgres) ──► Resend    │
│  POST /v1/sms     ──► SMS Record   (Postgres) ──► Twilio    │
│                                                              │
│  Template Rendering (Handlebars)                             │
│  Webhook Worker → POST to your app on every event           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                          │
                     PostgreSQL
```

### Third-Party Services

- **Email Delivery**: [Resend](https://resend.com) — Modern email API with excellent deliverability
- **SMS Delivery**: [Twilio](https://twilio.com) — Industry-standard SMS/MMS platform

Both services provide webhooks for delivery tracking, bounces, and clicks.

---

## Quick Start

### 1. Prerequisites

- Node.js ≥ 20
- PostgreSQL
- **Resend API key** (get from https://resend.com/api-keys)
- **Twilio credentials** (get from https://console.twilio.com)

### 2. Install

```bash
cd soma
npm install
```

### 3. Configure

```bash
cp env.example .env
# Edit .env with your:
#   - Database URL
#   - Resend API key
#   - Twilio credentials
```

### 4. Database

```bash
npm run db:migrate      # Run migrations
npm run db:seed         # Create seed user + API key (printed to console)
```

### 5. Run

```bash
npm run dev     # development (hot-reload)
npm run build && npm start    # production
```

### 6. Docker (all-in-one)

```bash
docker-compose up -d
```

---

## API Reference

All requests require:
```
Authorization: Bearer sk_<your_api_key>
```

### Authentication

| Method | Endpoint              | Description                       |
|--------|-----------------------|-----------------------------------|
| POST   | `/v1/auth/register`   | Register user, get first API key  |
| GET    | `/v1/auth/me`         | Get current user profile          |

```bash
# Register
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"supersecret123"}'
```

---

### Send Email

```bash
POST /v1/emails
```

```json
{
  "from": "Acme <noreply@acme.com>",
  "to": ["user@example.com"],
  "subject": "Welcome to Acme!",
  "html": "<h1>Hello {{name}}!</h1>",
  "text": "Hello {{name}}!",
  "tags": { "campaign": "onboarding" }
}
```

**Schedule for later:**
```json
{
  "to": "user@example.com",
  "subject": "Reminder",
  "html": "<p>Don't forget!</p>",
  "scheduledAt": "2026-03-01T09:00:00Z"
}
```

**Use a template:**
```json
{
  "to": "user@example.com",
  "subject": "Welcome",
  "templateId": "clxxx...",
  "templateData": { "name": "Alice", "plan": "Pro" }
}
```

---

### Send SMS

```bash
POST /v1/sms
```

```json
{
  "to": "+12125551234",
  "body": "Your verification code is 882934"
}
```

SMS is delivered via Twilio with international support and delivery tracking.

---

### Templates (Handlebars)

```bash
POST /v1/templates
```

```json
{
  "name": "welcome-email",
  "type": "EMAIL",
  "subject": "Welcome, {{name}}!",
  "html": "<h1>Hi {{name}},</h1><p>Your plan: <strong>{{plan}}</strong></p>",
  "text": "Hi {{name}}, your plan is {{plan}}."
}
```

Preview a template:
```bash
POST /v1/templates/:id/preview
{ "data": { "name": "Alice", "plan": "Pro" } }
```

---

### Webhooks

Register a URL to receive events:

```bash
POST /v1/webhooks
```

```json
{
  "name": "My App Webhook",
  "url": "https://myapp.com/soma/events",
  "events": ["email.sent", "email.failed", "email.bounced", "sms.sent", "sms.failed"]
}
```

**Verify the signature** on incoming deliveries:
```typescript
import crypto from 'crypto';

function verify(body: string, secret: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// In your handler:
const signature = req.headers['x-soma-signature'] as string;
const isValid = verify(JSON.stringify(req.body), webhookSecret, signature);
```

**Event payload structure:**
```json
{
  "event": "email.sent",
  "createdAt": "2026-02-18T10:30:00.000Z",
  "data": {
    "id": "clxxx...",
    "to": ["user@example.com"],
    "subject": "Welcome!",
    "messageId": "<msg-id@yourdomain.com>",
    "sentAt": "2026-02-18T10:30:00.000Z"
  }
}
```

---

### Domains

Add and verify your sending domain (DKIM + SPF check):

```bash
POST /v1/domains
{ "domain": "acme.com" }
```

The response includes DNS records to publish. After publishing:

```bash
POST /v1/domains/:id/verify
```

---

### API Keys

```bash
POST   /v1/api-keys        # Create scoped key
GET    /v1/api-keys        # List keys
PATCH  /v1/api-keys/:id    # Update / disable
DELETE /v1/api-keys/:id    # Revoke
```

**Permission scopes:**
`email:send` · `email:read` · `sms:send` · `sms:read` ·
`template:read` · `template:write` · `webhook:read` · `webhook:write` ·
`domain:read` · `domain:write`

---

## Project Structure

```
soma/
├── src/
│   ├── api/
│   │   ├── controllers/          # Request handlers
│   │   │   ├── auth.controller.ts
│   │   │   ├── email.controller.ts
│   │   │   ├── sms.controller.ts
│   │   │   ├── template.controller.ts
│   │   │   ├── webhook.controller.ts
│   │   │   └── domain.controller.ts
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts   # API key validation
│   │   │   ├── validate.middleware.ts
│   │   │   └── error.middleware.ts
│   │   └── routes/                # Express routers
│   ├── config/
│   │   ├── env.ts                 # Validated env vars (Zod)
│   │   └── database.ts            # Prisma client
│   ├── services/
│   │   ├── email.service.ts       # Resend integration
│   │   ├── sms.service.ts         # Twilio integration
│   │   ├── webhook.service.ts     # Webhook fan-out & delivery
│   │   └── template.service.ts    # Handlebars rendering
│   ├── types/index.ts
│   ├── utils/
│   │   ├── apikey.ts              # Key generation & HMAC signing
│   │   ├── logger.ts              # Winston logger
│   │   ├── response.ts            # HTTP response helpers
│   │   └── schemas.ts             # Zod validation schemas
│   ├── app.ts                     # Express app factory
│   └── server.ts                  # Bootstrap & graceful shutdown
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── docker-compose.yml
├── Dockerfile
├── env.example
└── package.json
```

---

## Integration Example

```typescript
// In your app — unified messaging API
const SOMA_API = 'http://localhost:3000';
const API_KEY = 'sk_your_key_here';

// Send email
await fetch(`${SOMA_API}/v1/emails`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: 'customer@example.com',
    subject: 'Order confirmed',
    html: '<p>Your order <strong>#1042</strong> is confirmed!</p>',
  }),
});

// Send SMS
await fetch(`${SOMA_API}/v1/sms`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: '+12125551234',
    body: 'Order #1042 shipped!',
  }),
});
```

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use a strong `JWT_SECRET` (≥ 32 chars)
- [ ] Verify your domain in Resend (add DKIM/SPF records)
- [ ] Purchase and verify a Twilio phone number
- [ ] Set up webhooks in Resend and Twilio for delivery tracking
- [ ] Configure database backups (automated snapshots)
- [ ] Monitor API usage and set rate limits
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Review and rotate API keys regularly

---

## Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.yourdomain.com

# Security
JWT_SECRET=your_long_random_secret_here_min_32_chars
API_KEY_PREFIX=sk_

# Database
DATABASE_URL=postgresql://user:pass@host:5432/soma_db

# Resend (Email)
RESEND_API_KEY=re_yourapikey
RESEND_FROM_NAME=Acme
RESEND_FROM_EMAIL=noreply@acme.com

# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# Logs
LOG_LEVEL=info
LOG_DIR=logs
```

---

## Why Soma?

- **Unified API**: One API for email and SMS, instead of juggling multiple SDKs
- **Template Management**: Store and version your message templates
- **Delivery Tracking**: Track sends, failures, bounces, and clicks
- **Webhook Support**: Get notified of all messaging events
- **Multi-tenancy**: API keys with scoped permissions
- **Cost Control**: Use Resend + Twilio credits for predictable pricing

---

## License

MIT
