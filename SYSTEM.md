# תיק מערכת — באר המשאלות (Well of Wishes)

## תקציר מנהלים

**באר המשאלות** היא פלטפורמה עברית להפגשת משאלות לשיתוף פעולה. משתמשים מפרסמים משאלות (מה הם רוצים להשיג, מה הם מציעים), והמערכת מוצאת ביניהם התאמות על ידי שילוב של ניתוח GPT, חיפוש וקטורי, ומודל ניקוד רב-ממדי.

**Stack:** Next.js 14 (App Router) · Supabase (PostgreSQL + pgvector + Auth) · OpenAI (GPT-5.2 + text-embedding-3-small) · Railway (hosting)

---

## 1. ארכיטקטורה כללית

```
משתמש
  │
  ▼
Next.js 14 App Router (Railway)
  ├── Server Components (app/page.tsx, app/wishes/[id]/page.tsx)
  ├── Client Components (WishForm, Header, Admin pages)
  └── API Routes (app/api/*)
        │
        ├── Supabase (PostgreSQL + pgvector)
        │     ├── wishes, wish_enrichment, wish_embeddings
        │     ├── wish_connections, match_attempts_log
        │     └── openai_api_log
        │
        └── OpenAI API
              ├── GPT-5.2 (ניתוח משאלה → JSON structured)
              └── text-embedding-3-small (1536 dims)
```

**אסטרטגיית עיבוד:**
- POST /api/wishes מחזיר תגובה מיד
- `waitUntil(processWishForMatching(...))` — pipeline רץ ברקע (fire-and-forget)
- Railway שומר את ה-process חי עד שה-pipeline מסתיים

---

## 2. מפת הקבצים

### אפליקציה (app/)

| URL | קובץ | סוג |
|-----|------|-----|
| `/` | app/page.tsx | Server Component — דף הבית |
| `/wishes/new` | app/wishes/new/page.tsx | Server Component — יצירת משאלה |
| `/wishes/my` | app/wishes/my/page.tsx | Server Component — המשאלות שלי |
| `/wishes/[id]` | app/wishes/[id]/page.tsx | Server Component — פרטי משאלה |
| `/(auth)/login` | app/(auth)/login/page.tsx | דף התחברות (magic link) |
| `/admin/connections` | app/admin/connections/page.tsx | Client Component — תחקור חיבורים |
| `/admin/test-data` | app/admin/test-data/page.tsx | Client Component — טעינת נתוני מבחן |

### API Routes (app/api/)

| Endpoint | Method | מטרה |
|----------|--------|------|
| `/api/wishes` | POST | יצירת משאלה + הפעלת pipeline |
| `/api/wishes` | GET | משאלות המשתמש המחובר |
| `/api/wishes/[id]` | GET | פרטי משאלה בודדת |
| `/api/wishes/[id]` | PATCH | עדכון משאלה (בעלים בלבד) |
| `/api/wishes/[id]` | DELETE | מחיקת משאלה |
| `/api/wishes/[id]/matches` | GET | חיבורים של המשאלה (בעלים בלבד) |
| `/api/wishes/[id]/resonate` | GET/POST/DELETE | ניהול resonances |
| `/api/connections/[id]/approve` | POST | State machine לאישור חיבורים |
| `/api/auth/magic-link` | POST | שליחת magic link |
| `/auth/callback` | GET | OAuth callback מ-Supabase |
| `/api/admin/run-matching` | POST | הפעלת batch matching (admin בלבד) |
| `/api/admin/load-test-data` | POST | ייבוא CSV (admin בלבד) |
| `/api/admin/connections` | GET | נתוני debug לזוג משאלות |
| `/api/feed` | GET | Feed מותאם אישית |

### ספריות (lib/)

| מודול | קבצים | מטרה |
|-------|-------|------|
| Supabase clients | lib/supabase/client.ts, server.ts, admin.ts | חיבורים ל-DB |
| Matching engine | lib/matching/*.ts | כל pipeline ההפגשה |
| Feed engine | lib/feed/*.ts | Feed מותאם אישית |
| Types | lib/types.ts | TypeScript interfaces |

### קומפוננטות (components/)

| קובץ | מטרה |
|------|------|
| components/wishes/WishForm.tsx | טופס יצירת משאלה |
| components/wishes/WishCard.tsx | כרטיס משאלה |
| components/wishes/MatchesSection.tsx | רשימת חיבורים |
| components/wishes/ResonanceButton.tsx | כפתור לב |
| components/layout/Header.tsx | ניווט עליון |
| components/layout/Footer.tsx | כותרת תחתית |

---

## 3. מסד הנתונים (Supabase)

### טבלאות

#### `wishes`
```
id              uuid PK
user_id         uuid FK→auth.users
original_text   text (עד 1000 תווים)
visibility      'open' (כל המשאלות פתוחות)
contact_name    text NOT NULL
contact_email   text NOT NULL
contact_country text NOT NULL
contact_city    text NOT NULL
contact_address text
contact_phone   text
user_email      text (denormalized)
created_at      timestamptz
updated_at      timestamptz
```

#### `wish_enrichment`
```
wish_id            uuid PK FK→wishes
themes             text[] (5-7 מילות מפתח)
intent             text
needs              text[] (מה הרוצה צריך)
skills_offered     text[] (מה הרוצה מציע)
collaboration_type 'build'|'learn'|'connect'|'support'|'share'
emotional_tone     'hopeful'|'urgent'|'reflective'|'excited'|'uncertain'
subject_type       text (16 ערכים)
subject_entities   text[]
target_action      text
object_of_need     text[]
constraints        text[]
domain_entities    text[]
primary_domain     text (15 ערכים מוגדרים)
location_lat       float (WGS-84, null אם לא הוזכר מקום)
location_lng       float
location_name      text
date_range_start   date (YYYY-MM-DD)
date_range_end     date
confidence         float (0.0–1.0)
ambiguity_flag     boolean
analyzed_at        timestamptz
```

#### `wish_embeddings`
```
wish_id    uuid PK FK→wishes
embedding  vector(1536) — text-embedding-3-small
created_at timestamptz
```
**Index:** HNSW (m=16, ef_construction=64, cosine)

#### `wish_connections`
```
id          uuid PK
wish_a      uuid FK→wishes (תמיד wish_a < wish_b — UUID lex order)
wish_b      uuid FK→wishes
match_score float (0–1)
match_type  'strong'|'complementary'|'similar'
status      'suggested'|'accepted_by_a'|'connected'|'rejected'
created_at  timestamptz
UNIQUE(wish_a, wish_b), CHECK(wish_a < wish_b)
```

#### `match_attempts_log`
```
id                    uuid PK
wish_id               uuid
candidate_wish_id     uuid
semantic_similarity   float NOT NULL
complementarity_score float NOT NULL
theme_overlap         float NOT NULL  ← תמיד 0 (הוסר מהניקוד, NOT NULL legacy)
intent_compatibility  float
match_score           float NOT NULL
match_type            text (null אם לא עבר)
passed_threshold      boolean NOT NULL
created_at            timestamptz
```
*עמודות נוספות בטבלה (לא נכתבות יותר):* freshness_factor, object_alignment, domain_match, distance_km, failed_distance, failed_date_range

**מה נרשם:** כל ניסיון שעבר את סינון טווח התאריכים

#### `openai_api_log`
```
id         bigint (generated identity)
caller     text ('analyzeWishText'|'generateEmbedding')
model      text
request    jsonb
response   jsonb
error      text
elapsed_ms integer
created_at timestamptz
```

#### `wish_resonances`
```
id         uuid PK
wish_id    uuid FK→wishes
user_id    uuid FK→auth.users
created_at timestamptz
UNIQUE(wish_id, user_id)
```

---

## 4. מנגנון ההפגשה (Resonance Engine)

### pipeline ראשי — `processWishForMatching(wishId, wishText, {onlyLowerId?})`

```
שלב 1: analyzeAndStoreWish()
  └── GPT-5.2 → JSON → wish_enrichment (upsert, מדלג אם קיים)

שלב 2: generateAndStoreEmbedding()
  └── buildEmbeddingText() — טקסט + domain + themes + entities + intent
  └── text-embedding-3-small → vector(1536) → wish_embeddings (upsert, מדלג אם קיים)

שלב 3: findSimilarWishes()
  └── match_wishes() RPC → HNSW ANN search → candidates (similarity ≥ 0.30)
  └── onlyLowerId=true בbatch: רק מועמדים עם id < wishId

שלב 4: ניקוד וסינון
  ├── [filter קשה] dateRangesOverlap() — אם אין חפיפה → דלג
  ├── אם יש enrichment למועמד:
  │     ├── computeComplementarity() → complementarity
  │     └── computeIntentCompatibility() → intent
  ├── אם אין enrichment → fallback: match_score = semantic_similarity
  ├── computeMatchScore(semantic, complementarity, intent)
  └── geo soft penalty: finalScore × exp(-distance_km / 50)

שלב 5: persistance
  ├── match_attempts_log INSERT (כל הניסיונות שעברו date filter)
  └── wish_connections UPSERT (finalScore ≥ 0.55, ignoreDuplicates)
```

### נוסחת הציון (v6)

```
match_score = 0.45 × semantic_similarity
            + 0.25 × complementarity
            + 0.15 × intent_compatibility
            + 0.15 × keywords_jaccard

final_score = match_score × exp(-distance_km / 50)
            (= match_score כשאין מיקום לאחת המשאלות)
```

**ציון סף:** ≥ 0.48 · **כניסה לניקוד:** similarity ≥ 0.30

### סיווג סוג ההתאמה

| match_type | תנאי |
|---|---|
| `strong` | final_score ≥ 0.75 |
| `complementary` | complementarity > 0.50 |
| `similar` | כל השאר |

### חישוב Complementarity (`lib/matching/complement.ts`)

ללא קריאת AI — השוואה טהורה של `needs` ↔ `skills_offered`.

**שלב 1 — קנוניזציה:** שני הצדדים עוברים `canonicalize()` — מיפוי מילים נרדפות ("investment"→"funding" וכו').

**שלב 2 — ציון דו-כיווני:**
```
aOffersWhatBNeeds = max(jaccard(skillsA, needsB), softOverlap(skillsA, needsB))
bOffersWhatANeeds = max(jaccard(skillsB, needsA), softOverlap(skillsB, needsA))
```
- `jaccard` — חיתוך/איחוד קבוצות (exact match לאחר lowercase+trim)
- `softOverlap` — token substring match (טוקנים > 3 תווים) לטיפול בהתאמות חלקיות כמו "technical help" ↔ "technical skills"

**שלב 3 — ציון סופי:**

| מצב | נוסחה |
|-----|-------|
| פרק↔מבקש טהור (`maxDir > 0.4` ו-`minDir < 0.15`) | `min(1, maxDir × 1.3)` |
| שניהם תורמים | `min(1, avg(max, min) × 1.2)` |

הגיון: כשרק כיוון אחד חזק זו ההשלמה הטובה ביותר — לכן מתוגמלת ישירות במקום להידלל בממוצע.

### חישוב Intent Compatibility (`lib/matching/intent.ts`)

Lookup בטבלת ציונים סימטרית לפי `collaboration_type` של שתי המשאלות:

| | build | learn | connect | support | share |
|---|---|---|---|---|---|
| **build** | 0.60 | 0.35 | 0.40 | 0.40 | 0.30 |
| **learn** | | 0.40 | 0.35 | **0.85** | 0.50 |
| **connect** | | | **0.75** | 0.40 | 0.65 |
| **support** | | | | 0.40 | 0.40 |
| **share** | | | | | 0.60 |

- `learn ↔ support` = 0.85 — המשלים ביותר (אחד רוצה ללמוד, השני מציע הדרכה)
- `connect ↔ connect` = 0.75 — שניהם מחפשים קשרים
- Fallback לערך לא מוכר: 0.40

### סינונים

| סינון | סוג | תנאי |
|-------|-----|------|
| טווח תאריכים | קשה (hard) | אין חפיפה → דחייה |
| מרחק גיאוגרפי | רך (soft) | `final_score × exp(-km/50)` |
| enrichment חסר | fallback | match_score = semantic_similarity |

---

## 5. ניתוח GPT (lib/matching/analyze.ts)

**מודל:** `gpt-5.2` · `max_completion_tokens: 1024` · `response_format: json_object`

### שדות מחולצים

| שדה | סוג | תיאור |
|-----|-----|--------|
| themes | string[5-7] | מילות מפתח בשפת המשאלה |
| intent | string | פועל קצר (אנגלית) |
| needs | string[2-5] | מה חסר (בשפת המשאלה) |
| skills_offered | string[2-5] | מה מוצע (בשפת המשאלה) |
| collaboration_type | enum | build/learn/connect/support/share |
| emotional_tone | enum | hopeful/urgent/reflective/excited/uncertain |
| subject_type | enum | community/partner/project/startup/... |
| subject_entities | string[1-3] | ישויות קונקרטיות |
| target_action | enum | build/join/find/offer/learn/teach/... |
| object_of_need | string[1-3] | מה נדרש קונקרטית |
| constraints | string[0-3] | מגבלות מאומתות בלבד |
| domain_entities | string[2-5] | שמות עצם תחומיים |
| primary_domain | enum | אחד מ-15 תחומים |
| location.lat/lng/name | float/string | WGS-84, null אם לא מוזכר |
| date_range.start/end | ISO date | null אם לא מוזכר |
| confidence | float 0-1 | רמת בטחון בחילוץ |
| ambiguity_flag | boolean | true אם המשאלה עמומה |

**כללים קריטיים:** שדות חופשיים בשפת המשאלה המקורית · לא להמציא מידע שלא נזכר · העדף מערכים ריקים על ניחושים

### withRetry — backoff על 429

```
"Xms" → parseInt(ms) + 200
"Xs"  → Math.ceil(s * 1000) + 200
fallback → 1000 × 2^attempt (עד 4 ניסיונות)
```

---

## 6. הטמעה (lib/matching/embed.ts)

**מודל:** `text-embedding-3-small` (1536 ממדים)

**buildEmbeddingText — העשרת הטקסט:**
```
[טקסט המשאלה]
Domain: {primary_domain}
Themes: {themes}
Topics: {subject_entities + domain_entities}
Intent: {intent}
```

**skip-if-exists:** embedding קיים → מחזיר וקטור קיים (ללא קריאת OpenAI)

---

## 7. חיפוש דמיון (lib/matching/similarity.ts)

**match_wishes SQL:**
```sql
SELECT wish_id, 1 - (embedding <=> query_embedding) AS similarity
FROM wish_embeddings e JOIN wishes w ON w.id = e.wish_id
WHERE wish_id != match_wish_id
  AND visibility IN ('anonymous','open')
  AND (NOT only_lower_id OR wish_id < match_wish_id)
  AND similarity >= min_similarity
ORDER BY embedding <=> query_embedding
```

**Retry:** 3 ניסיונות, backoff 2s/4s על timeout

---

## 8. משתני סביבה

| משתנה | רגישות | שימוש |
|--------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ציבורי | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ציבורי | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | סודי | Admin client (bypass RLS) |
| `OPENAI_API_KEY` | סודי | GPT + embeddings |
| `ADMIN_EMAIL` | סודי | Admin guard |
| `APP_URL` | Runtime | Auth redirects |

---

## 9. אימות (Authentication)

**שיטה:** Supabase Magic Link (OTP ב-email)

1. POST `/api/auth/magic-link` → שליחת OTP
2. קישור → `/auth/callback?code=...&next=...`
3. Callback → session
4. Middleware מגן על `/wishes/new`, `/profile`

**Admin guard:** `user.email === process.env.ADMIN_EMAIL`

---

## 10. RLS (Row Level Security)

| טבלה | מדיניות |
|------|---------|
| wishes | בעלים ← CRUD · כולם ← open wishes |
| wish_resonances | auth users ← resonance על open wishes |
| wish_enrichment | בעלים OR public wish |
| wish_embeddings | בעלים בלבד |
| wish_connections | משתתפים (wish_a OR wish_b) |
| match_attempts_log | admin client (service role) |
| openai_api_log | admin client (service role) |

---

## 11. עיצוב (Design System)

**שפה:** עברית, RTL · **פונטים:** Heebo (body), Frank Ruhl Libre (headings)

**פלטת צבעים:** `sand-*` (רקעים) · `well-*` (ראשי, כחול-כהה) · `amber-*` (accent/CTA)

**קלאסות מרכזיות:**

| קלאס | תיאור |
|------|--------|
| `.card` | לבן, blur, פינות מעוגלות |
| `.card-hover` | card + hover scale |
| `.card-featured` | card בולט |
| `.btn-primary` | well-700 |
| `.btn-amber` | amber-400, shadow |
| `.section-label` | uppercase, sand-500, small |
| `.tag-badge` | תגית עגולה |
| `.fade-in` | אנימציית כניסה 0.5s |

---

## 12. Migrations Timeline

| # | מה הוסף |
|---|---------|
| 001 | wishes, resonances, collaborations, RLS |
| 002 | שדות יצירת קשר |
| 003 | wish_enrichment, wish_embeddings (pgvector), wish_connections, IVFFlat |
| 004 | status default → 'connected' |
| 005 | user_email denormalized |
| 006 | feed_match_wishes() function |
| 007 | SECURITY DEFINER על match_wishes |
| 008 | match_attempts_log |
| 009 | הסרת LIMIT מ-match_wishes |
| 010 | min_similarity parameter |
| 011 | explanation JSONB, intent/freshness בלוג |
| 012 | object fields ב-enrichment, object_alignment בלוג |
| 013 | primary_domain, domain_match בלוג |
| 014 | HNSW במקום IVFFlat |
| 015 | openai_api_log |
| 016 | location + date_range ב-enrichment |
| 017 | distance_km, failed_distance בלוג |
| 018 | failed_date_range בלוג |
| 019 | confidence, ambiguity_flag ב-enrichment |
| 020 | only_lower_id ב-match_wishes (אופטימיזציית batch) |

---

## 13. Dependencies

| חבילה | גרסה | מטרה |
|-------|------|------|
| next | 14.2.35 | Framework |
| react/react-dom | ^18 | UI |
| @supabase/supabase-js | ^2.99.1 | DB + Auth |
| @supabase/ssr | ^0.9.0 | Cookie auth |
| openai | ^6.27.0 | GPT + Embeddings |
| @vercel/functions | ^3.4.3 | waitUntil() |
| tailwindcss | ^3.4.1 | Styling |
| typescript | ^5 | Types |
| jest/ts-jest | ^30/^29 | Unit tests |

---

## 14. lib/matching — כל הקבצים

| קובץ | פונקציות |
|------|---------|
| index.ts | `processWishForMatching()` |
| analyze.ts | `analyzeWishText()`, `analyzeAndStoreWish()` |
| embed.ts | `buildEmbeddingText()`, `generateEmbedding()`, `generateAndStoreEmbedding()` |
| similarity.ts | `findSimilarWishes()` |
| score.ts | `computeMatchScore()` — 3 signals only |
| complement.ts | `computeComplementarity()` |
| intent.ts | `computeIntentCompatibility()` |
| objectAlignment.ts | `computeObjectAlignment()` — unused in pipeline (kept) |
| domain.ts | `computeDomainMatch()` — unused in pipeline (kept) |
| geo.ts | `haversineKm()` — soft penalty exp(-km/50) |
| timeRange.ts | `dateRangesOverlap()` |
| canonicalize.ts | `canonicalize()`, `canonicalizeSubjectType()`, `canonicalizeAction()` |
| openaiLog.ts | `logOpenAICall()` |
| __tests__/ | Unit tests |
