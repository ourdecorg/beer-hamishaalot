# באר המשאלות — Well of Wishes

> *A platform for connecting people through collaborative wishes, intentions, and resonance.*

People submit wishes — what they want to achieve and what they offer — and the system finds meaningful matches using AI enrichment, vector embeddings, and semantic scoring.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth & DB | Supabase (PostgreSQL + pgvector + Auth) |
| AI | OpenAI (GPT-5.2 + text-embedding-3-small) |
| Email | Resend |
| Hosting | Railway |
| Fonts | Heebo + Rubik (Google Fonts) |

---

## Features

- **Submit a wish** — Freeform text describing what you want and what you offer
- **AI enrichment** — GPT extracts themes, needs, skills, intent, location, and date range
- **Semantic matching** — Vector embeddings (English cross-lingual) find relevant matches across all wishes
- **Complementarity scoring** — Per-term embeddings compare needs ↔ skills between wish pairs (observability)
- **Connection emails** — When a match is created, both owners receive an email with both wishes, a shared-basis summary, and a CTA button to confirm the connection (Resend). Contact details are NOT revealed — only after mutual acceptance (double opt-in)
- **Admin tools** — Run batch matching, review match quality, debug connection scoring
- **Double opt-in disclosure** — Each connection requires both parties to accept and choose which profile fields to share (display_name, email, phone, country, city). Contact details are revealed only after mutual acceptance
- **Magic link auth** — Passwordless email authentication via Supabase
- **RTL-first design** — Full Hebrew direction support

---

## Matching Engine (v13)

Matches are scored using a single signal:

```
match_score = semantic_similarity   (English embedding cosine similarity)
final_score = match_score × exp(-distance_km / 50)
```

**Threshold:** `final_score ≥ 0.55` to create a `wish_connection`

**Relevance gate:** `semantic_similarity ≥ 0.30` — candidates below this are logged but not scored

**Full-scan mode:** When the DB has ≤ 300 wishes, all pairs are evaluated directly (no ANN threshold). Activated automatically on both API submission and admin batch run.

**Logged signals (observability only):** `complementarity_score`, `structural_similarity`, `geo_penalty`

---

## Project Structure

```
beer-hamishaalot/
├── app/
│   ├── (auth)/login/              # Magic link login
│   ├── admin/
│   │   ├── connections/           # Debug connection scoring
│   │   ├── review-matches/        # Match quality feedback
│   │   ├── run-matching/          # Trigger batch matching
│   │   ├── settlements/           # Load city data
│   │   └── test-data/             # Load test wishes
│   ├── api/
│   │   ├── wishes/                # CRUD + matching pipeline
│   │   ├── connections/           # Connection state machine
│   │   ├── admin/                 # Admin-only endpoints
│   │   └── getUserMatches/        # Webhook
│   ├── matches/                   # User's matches page
│   ├── wishes/[id]/               # Wish detail
│   ├── opengraph-image.tsx        # OG image 1200×630 (next/og)
│   └── layout.tsx
├── components/
│   ├── admin/                     # ReviewMatchesClient, AdminNav
│   ├── wishes/                    # WishForm, WishCard, SettlementPicker
│   └── layout/                    # Header, Footer
├── lib/
│   ├── matching/                  # Full matching engine
│   │   ├── index.ts               # Orchestrator (processWishForMatching)
│   │   ├── analyze.ts             # GPT enrichment
│   │   ├── embed.ts               # Dual embeddings
│   │   ├── complementEmbed.ts     # Per-term embeddings + complementarity
│   │   ├── similarity.ts          # ANN recall + cosine similarity
│   │   ├── score.ts               # Scoring formula (v13)
│   │   ├── keywords.ts            # Anchor keywords + structural similarity
│   │   ├── geo.ts                 # Haversine distance penalty
│   │   └── timeRange.ts           # Date range overlap filter
│   ├── email/
│   │   └── sendConnectionEmail.ts # Resend email on new connection
│   ├── supabase/                  # client / server / admin clients
│   └── types.ts
├── public/
│   └── logo.png
├── supabase/migrations/           # 047 migrations
└── SYSTEM.md                      # Full technical documentation
```

---

## Setup

### 1. Clone and install

```bash
git clone <repo>
cd beer-hamishaalot
npm install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Supabase service role (bypasses RLS) |
| `OPENAI_API_KEY` | ✓ | GPT + embeddings |
| `ADMIN_EMAIL` | ✓ | Admin guard (server-side) |
| `NEXT_PUBLIC_ADMIN_EMAIL` | ✓ | Admin guard (client-side) |
| `RESEND_API_KEY` | ✓ | Connection notification emails |
| `RESEND_FROM_EMAIL` | ✓ | Sender address (verified Resend domain) |
| `NEXT_PUBLIC_SITE_URL` | ✓ | Production URL (for OG image metadataBase) |
| `NEXT_PUBLIC_ENV` | | `dev` to show environment badge |

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Verify the OG image at [http://localhost:3000/opengraph-image](http://localhost:3000/opengraph-image)

---

## Deployment

The app is hosted on **Railway** connected to a GitHub repo. Every push to the `dev` branch triggers an automatic deploy.

Set all environment variables in Railway → Service → Variables.

---

## Admin Tools

| Screen | Path | Description |
|--------|------|-------------|
| Run Matching | `/admin/run-matching` | Batch match all wishes (full-scan for ≤ 300) |
| Review Matches | `/admin/review-matches` | Browse `match_attempts_log`, label quality |
| Connections | `/admin/connections` | Debug scoring for a specific wish pair |
| Test Data | `/admin/test-data` | Load CSV of test wishes |
| Settlements | `/admin/settlements` | Load Israeli city data (CBS format) |

---

## Documentation

See [SYSTEM.md](SYSTEM.md) for the full technical reference: pipeline steps, scoring formula, DB schema, migrations history, and all lib/matching modules.
