# באר המשאלות — Well of Wishes

> *A sacred space to cast your deepest wishes into the universe.*

An MVP web application where people can submit personal wishes, have them enriched by AI, and share them with a community that can "resonate" in response.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth & DB | Supabase (magic link auth + PostgreSQL) |
| AI | OpenAI (`gpt-4o`) |
| Fonts | Heebo + Frank Ruhl Libre (Google Fonts) |

---

## Features

- **Home page** — Landing page explaining the product (Hebrew + English)
- **Magic link auth** — Passwordless email authentication via Supabase
- **Submit a wish** — Freeform text with visibility control
- **Wish visibility** — `private` / `anonymous` / `open`
- **AI enrichment** — Claude generates a poetic summary, tags, and an intention statement
- **Wish detail page** — Full wish view with AI-enriched content
- **Public feed** — Browse anonymous and open wishes
- **Resonance** — Authenticated users can "resonate" with public wishes
- **RTL-first design** — Full Hebrew direction support

---

## Project Structure

```
beer-hamishaalot/
├── app/
│   ├── (auth)/login/          # Magic link login page
│   ├── auth/callback/         # Supabase auth callback handler
│   ├── wishes/
│   │   ├── new/               # Submit a new wish
│   │   ├── [id]/              # Wish detail page
│   │   └── feed/              # Public wish feed
│   ├── api/wishes/
│   │   ├── route.ts           # POST (create) / GET (list own)
│   │   └── [id]/
│   │       ├── route.ts       # GET / PATCH / DELETE
│   │       ├── resonate/      # POST / DELETE / GET resonance
│   │       └── enrich/        # POST re-trigger AI enrichment
│   ├── layout.tsx             # Root layout (RTL, fonts)
│   ├── page.tsx               # Home/landing page
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── wishes/
│       ├── WishCard.tsx       # Reusable wish card component
│       ├── WishForm.tsx       # New wish form (client component)
│       └── ResonanceButton.tsx # Toggle resonance (client component)
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser Supabase client
│   │   └── server.ts          # Server Supabase client
│   ├── claude.ts              # Claude enrichment function
│   └── types.ts               # Domain types
├── middleware.ts              # Auth protection + session refresh
├── supabase/
│   └── migrations/
│       └── 001_initial.sql    # Full schema with RLS
└── tailwind.config.ts
```

---

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd beer-hamishaalot
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration:
   ```
   supabase/migrations/001_initial.sql
   ```
3. Go to **Authentication → URL Configuration** and add:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
4. Go to **Authentication → Email** and ensure **Magic Link** is enabled

### 4. Get OpenAI API key

Sign up at [platform.openai.com](https://platform.openai.com/api-keys) and create an API key.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Database Schema

### `wishes`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK → auth.users |
| original_text | text | User's raw wish |
| ai_summary | text | Claude-generated poetic summary |
| ai_tags | text[] | Claude-generated topic tags |
| intention_statement | text | Claude-generated intention sentence |
| visibility | enum | `private` / `anonymous` / `open` |
| is_ai_enriched | boolean | Whether Claude has processed it |
| created_at | timestamptz | |
| updated_at | timestamptz | Auto-updated via trigger |

### `wish_resonances`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| wish_id | uuid | FK → wishes |
| user_id | uuid | FK → auth.users |
| created_at | timestamptz | |

### `collaborations` *(reserved for future use)*
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| wish_id | uuid | FK → wishes |
| collaborator_id | uuid | FK → auth.users |
| role | text | `collaborator` / `advisor` |
| status | text | `pending` / `accepted` / `declined` |

All tables have **Row Level Security (RLS)** enabled with appropriate policies.

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/wishes` | Required | Create wish + AI enrichment |
| `GET` | `/api/wishes` | Required | List own wishes |
| `GET` | `/api/wishes/[id]` | Optional | Get single wish |
| `PATCH` | `/api/wishes/[id]` | Required (owner) | Update wish |
| `DELETE` | `/api/wishes/[id]` | Required (owner) | Delete wish |
| `POST` | `/api/wishes/[id]/resonate` | Required | Add resonance |
| `DELETE` | `/api/wishes/[id]/resonate` | Required | Remove resonance |
| `GET` | `/api/wishes/[id]/resonate` | Optional | Get resonance count |
| `POST` | `/api/wishes/[id]/enrich` | Required (owner) | Re-trigger AI enrichment |

---

## Deployment (Vercel)

```bash
npx vercel
```

Set the same environment variables in your Vercel project settings. Update Supabase URL configuration to include your production domain in the redirect allowlist.

---

## Design Principles

- **RTL-first** — Hebrew direction throughout (`dir="rtl"` on `<html>`)
- **Warm & minimal** — Sand + well-blue + amber color palette
- **Server Components** — Data fetching in RSC where possible; Client Components only for interactivity
- **Clean architecture** — Supabase logic isolated in `lib/supabase/`, AI in `lib/claude.ts`, types in `lib/types.ts`

---

## Roadmap

- [ ] User profile page with personal wish history
- [ ] Collaboration invitations between users
- [ ] Admin dashboard for content moderation
- [ ] Email notifications on resonance
- [ ] Wish categorization and search
- [ ] Multi-language support
