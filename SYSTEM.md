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
        │     ├── openai_api_log
        │     └── settlements
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
| `/matches` | app/matches/page.tsx | Server Component — ההתאמות שלי (מקובצות לפי משאלה חיצונית) |
| `/(auth)/login` | app/(auth)/login/page.tsx | דף התחברות (magic link) |
| `/admin` | app/admin/layout.tsx | Layout עם sidebar + auth guard |
| `/admin/connections` | app/admin/connections/page.tsx | Client Component — תחקור חיבורים |
| `/admin/test-data` | app/admin/test-data/page.tsx | Client Component — טעינת נתוני מבחן |
| `/admin/run-matching` | app/admin/run-matching/page.tsx | הרצת MATCHES |
| `/admin/settlements` | app/admin/settlements/page.tsx | העלאת קובץ ישובים |
| `/admin/review-matches` | app/admin/review-matches/page.tsx | Server Component — פידבק על איכות ההתאמות |

### API Routes (app/api/)

| Endpoint | Method | מטרה |
|----------|--------|------|
| `/api/wishes` | POST | יצירת משאלה + הפעלת pipeline |
| `/api/wishes` | GET | משאלות המשתמש המחובר |
| `/api/wishes/[id]` | GET | פרטי משאלה בודדת |
| `/api/wishes/[id]` | PATCH | עדכון משאלה (בעלים בלבד) |
| `/api/wishes/[id]` | DELETE | soft delete — מסמן `status='cancelled'` + connections→`deleted` |
| `/api/wishes/[id]/matches` | GET | חיבורים של המשאלה (בעלים בלבד, מסנן deleted) |
| `/api/wishes/[id]/resonate` | GET/POST/DELETE | ניהול resonances |
| `/api/connections/[id]/approve` | POST | State machine לאישור חיבורים |
| `/api/auth/magic-link` | POST | שליחת magic link |
| `/auth/callback` | GET | OAuth callback מ-Supabase |
| `/api/admin/run-matching` | POST | הפעלת batch matching (admin בלבד) |
| `/api/admin/load-test-data` | POST | ייבוא CSV (admin בלבד) |
| `/api/admin/connections` | GET | נתוני debug לזוג משאלות |
| `/api/admin/seed-settlements` | POST | העלאת קובץ ישובים CBS (admin בלבד, Windows-1255) |
| `/api/admin/review-matches` | POST | upsert לטבלת match_reviews (admin בלבד) |
| `/api/getUserMatches` | POST | webhook — קבלת התאמות לפי email |
| `/api/feed` | GET | Feed מותאם אישית |

### דף `/matches` — היגיון עיבוד

**שלב 1:** שליפת כל משאלות המשתמש + ה-wish_connections שלהן (ללא `status='deleted'`)

**שלב 2:** איסוף ה-IDs של המשאלות התואמות + שליפת wish_enrichment (themes) + פרטי קשר

**שלב 3:** קיבוץ לפי `theirWishId` — כרטיס אחד לכל משאלה חיצונית, עם כל המשאלות של המשתמש שתואמות אותה

**StructuredMatch:**
```
GroupedMatch {
  theirWishId, theirWishText, theirName, theirEmail, theirPhone
  maxScore, maxMatchType       // מהחיבור בציון הגבוה ביותר
  myMatches[]                  // ממוינות לפי match_score desc
  allSharedThemes              // איחוד ה-themes מכל myMatches
}
```

### מסך `/admin/review-matches`

Server component שטוען עד 60 רשומות מ-`match_attempts_log`, מציג אותן כ-cards עם:
- טקסטי שתי המשאלות + סיגנלים: ציון · סמנטי (×0.55) · משלים (×0.25) · מבני (×0.20) · גיאו
- Badge: נוצר חיבור / נפסל בשער / לא נוצר חיבור
- כפתורי label: טוב / אולי / לא טוב + שדה הערה → POST `/api/admin/review-matches`

**סינונים (URL searchParams → server re-fetch):** סוג (עבר/לא עבר סף) · סקירה (סוקרו/לא) · שער · קרוב לסף · כולל מבוטלות (ברירת מחדל: מסתיר)

**מיון (URL param `sort`):** match_score · semantic_en · complementarity · structural · geo — server-side ORDER BY

**דפדוף:** server-side pagination, 60 רשומות לעמוד · prev/next Links · "עמוד X מתוך Y · N רשומות"

**חיפוש טקסט:** client-side, מסנן כרטיסים לפי תוכן משאלות ללא round-trip לשרת

---

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
| components/wishes/WishForm.tsx | טופס יצירת משאלה (ללא שדה ארץ, contact_country מוכנס ל-'Israel') |
| components/wishes/WishCard.tsx | כרטיס משאלה |
| components/wishes/SettlementPicker.tsx | חיפוש ישוב server-side עם ilike, debounce 150ms |
| components/wishes/DeleteWishButton.tsx | כפתור מחיקה עם אישור דו-שלבי (soft delete) |
| components/wishes/MatchesSection.tsx | רשימת חיבורים לצד משאלה בודדת |
| components/wishes/ResonanceButton.tsx | כפתור לב |
| components/admin/AdminNav.tsx | Sidebar ניווט לאדמין (5 מסכים) |
| components/admin/ReviewMatchesClient.tsx | Client Component — כרטיסי review עם חיפוש טקסט וסינונים |
| components/layout/Header.tsx | Client Component — ניווט עליון; badge סביבה ב-dev |
| components/layout/Footer.tsx | כותרת תחתית |

**Header — mobile hamburger menu:**
- `menuOpen` state + `menuRef` לסגירה על-ידי לחיצה מחוץ
- מוצג בלבד ב-`< sm`; desktop nav מוצג ב-`sm+`
- Dropdown מכיל: "משאלה חדשה" (CTA), המשאלות שלי, ההתאמות שלי, סקציית admin (אם `isAdmin`), יציאה
- Guard: `user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL`
- Badge סביבה: מוצג רק כש-`NEXT_PUBLIC_ENV === 'dev'`

---

## 3. מסד הנתונים (Supabase)

### טבלאות

#### `wishes`
```
id              uuid PK
user_id         uuid FK→auth.users
original_text   text (עד 1000 תווים)
visibility      'open'
status          text NOT NULL DEFAULT 'pending' — 'pending'|'cancelled'
contact_name    text
contact_email   text (מאוכלס אוטומטית מ-user.email)
contact_country text DEFAULT 'Israel' (מוכנס תמיד כ-'Israel')
contact_city    text (לא חובה, נבחר מ-SettlementPicker)
contact_address text
contact_phone   text
user_email      text (denormalized)
created_at      timestamptz
updated_at      timestamptz
```

**Soft delete:** DELETE endpoint מסמן `status='cancelled'` (לא מוחק פיזית).
RLS מסנן `status != 'cancelled'` לכלל השאילתות (בעלים + ציבורי).

#### `settlements`
```
id        integer PK (סמל ישוב CBS)
name      text NOT NULL (שם בעברית)
name_en   text
district  text
council   text
```
RLS: public read. נטען מקובץ CBS (Windows-1255) דרך `/api/admin/seed-settlements`.

#### `wish_enrichment`
```
wish_id            uuid PK FK→wishes
translation_en     text — תרגום לאנגלית תקנית (migration 034); בסיס ל-English embedding
themes             text[] (3-5 מילות מפתח, באנגלית)
intent             text (אנגלית)
needs              text[] (מה הרוצה צריך, באנגלית)
skills_offered     text[] (מה הרוצה מציע, באנגלית)
collaboration_type 'build'|'learn'|'connect'|'support'|'share'
subject_entities   text[]
domain_entities    text[]
primary_domain     text (15 ערכים מוגדרים)
anchor_keywords    text[] NOT NULL DEFAULT '{}' — canonical IDs מ-needs+skills+entities (migration 026)
location_lat       float (WGS-84, null אם לא הוזכר מקום)
location_lng       float
location_name      text
date_range_start   date (YYYY-MM-DD)
date_range_end     date
analyzed_at        timestamptz
--- שדות legacy (לא נכתבים בניתוחים חדשים) ---
emotional_tone, subject_type, target_action, object_of_need, constraints, confidence, ambiguity_flag
```
**Index:** GIN על `anchor_keywords` — מאפשר `&&` overlap search ב-O(log n)

#### `wish_embeddings`
```
wish_id            uuid PK FK→wishes
embedding          vector(1536) — English embedding (מ-translation_en); ראשי לחיפוש ANN
embedding_original vector(1536) — embedding שפת מקור (migration 034); signal ניקוד משני
created_at         timestamptz
```
**Index:** HNSW (m=16, ef_construction=64, cosine) על `embedding`

#### `wish_connections`
```
id          uuid PK
wish_a      uuid FK→wishes (תמיד wish_a < wish_b — UUID lex order)
wish_b      uuid FK→wishes
match_score float (0–1)
match_type  'strong'|'complementary'|'similar'
status      'suggested'|'accepted_by_a'|'connected'|'rejected'|'deleted'
created_at  timestamptz
UNIQUE(wish_a, wish_b), CHECK(wish_a < wish_b)
```
`status='deleted'` נקבע אוטומטית כשמשאלה מסומנת כ-cancelled.
כל שאילתות wish_connections מסננות `status != 'deleted'`.

#### `match_attempts_log`
```
id                       uuid PK
wish_id                  uuid
candidate_wish_id        uuid
semantic_similarity      float NOT NULL  ← English embedding similarity (v12: ×0.70)
semantic_similarity_orig float           ← original-language similarity (migration 035); נכתב NULL ב-v10
complementarity_score    float NOT NULL
theme_overlap            float NOT NULL  ← תמיד 0 (legacy NOT NULL)
intent_compatibility     float           ← תמיד 0 (הוסר מהנוסחה ב-v9, לא נכתב ב-v10)
domain_match             float           ← 0/1 לפי primary_domain (אובסרווביליות בלבד)
structural_similarity    float
recall_source            text            ← 'semantic'|'structured'|'both'
geo_penalty              float           ← exp(-km/50), 1 אם אין מיקום
match_score              float NOT NULL
match_type               text (null אם לא עבר)
passed_threshold         boolean NOT NULL
gate_passed              boolean  ← null=לא הגיע לשער, true=עבר, false=נפסל
gate_reason              text     ← 'passed' | סיבת כשל
created_at               timestamptz
```
*עמודות ישנות בטבלה (לא נכתבות יותר):* freshness_factor, object_alignment, anchor_overlap, failed_distance

**מה נרשם:** כל ניסיון שעבר את סינון טווח התאריכים ואת שער הכניסה לניקוד

#### `match_reviews`
```
id                 uuid PK
wish_id            uuid FK→wishes
candidate_wish_id  uuid FK→wishes
connection_id      uuid FK→wish_connections (nullable)
reviewer_email     text
label              'good'|'maybe'|'bad'
note               text (nullable)
created_at         timestamptz
UNIQUE(wish_id, candidate_wish_id, reviewer_email)
```
Human-in-the-loop feedback על זוגות התאמה, לצורך כיוונון עתידי של הסף והמשקולות.
נכתב מ-`/api/admin/review-matches` (POST, upsert on conflict).

#### `openai_api_log`
```
id         bigint (generated identity)
caller     text ('analyzeWishText'|'generateEmbedding')
model      text
request    jsonb
response   jsonb
error      text
elapsed_ms integer
wish_id    uuid FK→wishes (nullable — מאוכלס מה-pipeline)
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

## 4. מנגנון ההפגשה (Resonance Engine v12 — 2 signals)

### pipeline ראשי — `processWishForMatching(wishId, wishText, {onlyLowerId?, explicitCandidateIds?})`

```
שלב 1: analyzeAndStoreWish()
  └── GPT-5.2 → JSON → wish_enrichment (upsert, מדלג אם קיים)
      שדות: translation_en, themes, intent, needs, skills_offered,
             collaboration_type, subject_entities, domain_entities,
             primary_domain, location, date_range, keywords, anchor_entities
  └── buildAnchorKeywords() → שמירת anchor_keywords בשורת ה-enrichment

שלב 2: generateAndStoreEmbedding() → DualEmbedding { en, orig }
  ├── English embedding (ראשי):
  │     buildEnglishEmbeddingText(translation_en, { themes })
  │     → text-embedding-3-small → wish_embeddings.embedding
  └── Original embedding (נשמר, לא בשימוש בניקוד):
        buildEmbeddingText(wishText, { themes })
        → text-embedding-3-small → wish_embeddings.embedding_original
  מדלג אם שני ה-embeddings קיימים

שלב 2b: generateAndStoreTermEmbeddings() — per-term embeddings
  └── כל need + skill_offered מוטמע בנפרד (batch call אחד ל-OpenAI)
  └── → wish_term_embeddings (skip-if-exists)

שלב 3a: findSimilarWishes(embeddingEn) — ANN recall
  └── match_wishes() RPC → HNSW ANN search על embedding (אנגלית) → candidates (similarity ≥ 0.30)

שלב 3b: findStructuredCandidates() — Structural recall
  └── find_structured_candidates() RPC → GIN &&-overlap על anchor_keywords
  └── לא-קריטי: כשל מחזיר []

שלב 3c: Merge + back-fill
  └── מועמדים: ANN בלבד / Structural בלבד / שניהם (recallSource)
  └── computeSimilaritiesForIds(embeddingEn, null, ids) →
      DualSimilarityMaps { en: Map, orig: Map (ריק) }

שלב 3d: loadTermVecsForWishes(allWishIds) — pre-load term embeddings
  └── שאילתה אחת לכל המשאלות בבאץ' → TermVecMap { wish_id → { needs[][], skills[][] } }

**מצב Full-scan** (≤ 300 משאלות):
  └── IDs ממוינים; wish[i] מקבל explicitCandidateIds = sortedIds.slice(0, i)
  └── מדלג ANN + structural — computeSimilaritiesForIds ישירות על כל הזוגות
  └── מבטיח כיסוי 100% (N×(N-1)/2 זוגות)

שלב 4: ניקוד וסינון
  ├── [filter קשה] dateRangesOverlap()
  ├── אם יש enrichment למועמד:
  │     ├── computeEmbeddingComplementarity(termVecMap, A, B) → complementarityScore
  │     └── computeStructuralSimilarity() → structuralSimilarity (observability בלבד)
  ├── [שער רלוונטיות] semantic_en ≥ 0.30 OR complementarity ≥ 0.20
  │     נכשל → gate_passed=false → דלג
  ├── computeMatchScore(semanticEn, complementarity) → match_score
  └── geo soft penalty: finalScore × exp(-distance_km / 50)

שלב 5: Persistence
  ├── match_attempts_log INSERT
  └── wish_connections UPSERT (finalScore ≥ 0.48, ignoreDuplicates)
```

### נוסחת הציון (v12)

```
match_score = 0.70 × semantic_similarity      (English embedding — cross-lingual)
            + 0.30 × complementarity           (needs ↔ skills pairwise embedding similarity)

final_score = match_score × exp(-distance_km / 50)
            (= match_score כשאין מיקום לאחת המשאלות)
```

**ציון סף:** ≥ 0.48 · **שער רלוונטיות:** semantic_en ≥ 0.30 **או** complementarity ≥ 0.20

### סיווג סוג ההתאמה

| match_type | תנאי |
|---|---|
| `strong` | final_score ≥ 0.75 |
| `complementary` | complementarity > 0.50 |
| `similar` | כל השאר |

### חישוב Complementarity — embedding-based (`lib/matching/complementEmbed.ts`)

כל `need` וכל `skill_offered` מוטמע כיחידה סמנטית עצמאית ב-`wish_term_embeddings`.
בזמן ריצה: pairwise cosine similarity, ללא קריאת OpenAI.

**לוגיקה:**
```
score = max cosine(needVec, skillVec)
        מעל כל הזוגות: A.needs × B.skills  ו-  B.needs × A.skills
        בתנאי cosine ≥ 0.35 (noise floor)
        אם אין זוג שעובר את הסף → 0
```

**סף רעש:** cosine < 0.35 מטופל כ-0 — מונע תרומה של התאמות חלשות לציון.
אין ממוצע, אין asymmetric boost — ציון אחד: ה-maximum הגבוה ביותר שנמצא.

### Structural Similarity (`lib/matching/keywords.ts`) — observability בלבד

נחשב ונרשם ב-`match_attempts_log.structural_similarity` אך **אינו משתתף בנוסחת הציון (v12)**.
מאפשר ניתוח רטרואקטיבי בלבד.

### חישוב Anchor Keywords (`lib/matching/keywords.ts`)

`buildAnchorKeywords(enrichment)` — מייצר את `anchor_keywords` שנשמר ב-DB ומשמש ל-GIN recall:

```
canonicalize([
  ...needs, ...skills_offered, ...subject_entities, ...domain_entities
])
```

### `find_structured_candidates` RPC (migration 026, עודכן 032)

```sql
SELECT e.wish_id FROM wish_enrichment e JOIN wishes w ON w.id = e.wish_id
WHERE e.wish_id != source_wish_id
  AND w.visibility IN ('anonymous', 'open')
  AND w.status != 'cancelled'
  AND e.anchor_keywords && source_keywords
  AND (NOT only_lower_id OR e.wish_id < source_wish_id)
```

`&&` = PostgreSQL array overlap — מוצא כל משאלה שיש לה לפחות מילת עוגן אחת משותפת. דורש GIN index לביצועים.

### סינונים

| סינון | סוג | תנאי |
|-------|-----|------|
| טווח תאריכים | קשה (hard) | אין חפיפה → דחייה |
| שער רלוונטיות | קשה | semantic < 0.30 **וגם** complementarity < 0.20 → דחייה |
| מרחק גיאוגרפי | רך (soft) | `final_score × exp(-km/50)` |
| status cancelled | קשה | מסונן ב-RLS + ב-RPCs |

---

## 5. ניתוח GPT (lib/matching/analyze.ts)

**מודל:** `gpt-5.2` · `max_completion_tokens: 4096` · `response_format: json_object`

### שדות מחולצים (רק שדות המשתתפים ב-matching)

| שדה | סוג | שפה | תיאור |
|-----|-----|-----|--------|
| translation_en | string | אנגלית | תרגום תקני לאנגלית (בסיס ל-English embedding) |
| themes | string[3-5] | אנגלית | מילות מפתח נושאיות |
| intent | string | אנגלית | פועל קצר המתאר המטרה |
| needs | string[2-5] | אנגלית | מה חסר |
| skills_offered | string[2-5] | אנגלית | מה מוצע |
| collaboration_type | enum | אנגלית | build/learn/connect/support/share |
| subject_entities | string[1-3] | אנגלית | ישויות קונקרטיות |
| domain_entities | string[2-5] | אנגלית | שמות עצם תחומיים |
| primary_domain | enum | אנגלית | אחד מ-15 תחומים |
| location.lat/lng/name | float/string | — | WGS-84, null אם לא מוזכר |
| date_range.start/end | ISO date | — | null אם לא מוזכר |
| keywords | string[3-8] | אנגלית | מונחים חשובים מהמשאלה |
| anchor_entities | string[0-3] | אנגלית | שמות עצם קונקרטיים לצורך matching |

**כללים קריטיים:** כל שדות הטקסט החופשי באנגלית · לא להמציא מידע שלא נזכר · העדף מערכים ריקים על ניחושים

### withRetry — backoff על 429

```
"Xms" → parseInt(ms) + 200
"Xs"  → Math.ceil(s * 1000) + 200
fallback → 1000 × 2^attempt (עד 4 ניסיונות)
```

---

## 6. הטמעה (lib/matching/embed.ts)

**מודל:** `text-embedding-3-small` (1536 ממדים)

**שני embeddings לכל משאלה (`wish_embeddings`):**

| עמודה | בנוי מ | מטרה |
|-------|--------|------|
| `embedding` | `translation_en` + `themes` | ANN cross-lingual (ראשי) + ניקוד semantic v12 |
| `embedding_original` | `wishText` + `themes` | נשמר בלבד — לא בשימוש בניקוד |

**skip-if-exists:** שני ה-embeddings קיימים → מחזיר `{ en, orig }` ללא קריאת OpenAI

**return type:** `DualEmbedding { en: number[], orig: number[] }`

**per-term embeddings (`wish_term_embeddings`, migration 036):**

כל `need` וכל `skill_offered` מוטמע בנפרד. batch call אחד ל-OpenAI לכל המונחים החסרים.

| עמודה | תוכן |
|-------|------|
| `wish_id` | FK→wishes |
| `term_type` | `'need'` \| `'skill'` |
| `term_text` | המונח הגולמי מה-enrichment |
| `embedding` | vector(1536) |

**skip-if-exists:** בדיקת `(wish_id, term_type, term_text)` לפני כל insert

---

## 7. חיפוש דמיון (lib/matching/similarity.ts)

### `findSimilarWishes` — ANN recall

**match_wishes SQL (migration 020, עודכן 032):**
```sql
SELECT wish_id, 1 - (embedding <=> query_embedding) AS similarity
FROM wish_embeddings e JOIN wishes w ON w.id = e.wish_id
WHERE wish_id != match_wish_id
  AND visibility IN ('anonymous','open')
  AND status != 'cancelled'
  AND (NOT only_lower_id OR wish_id < match_wish_id)
  AND similarity >= min_similarity
ORDER BY embedding <=> query_embedding
```

**Retry:** 3 ניסיונות, backoff 2s/4s על timeout

### `findStructuredCandidates` — Structural recall

קורא ל-`find_structured_candidates` RPC (GIN `&&` על `anchor_keywords`). לא-קריטי — כשל מחזיר `[]` ומאפשר המשך ANN-only.

### `computeSimilaritiesForIds` — Back-fill similarity

מביא `embedding` + `embedding_original` ב**שאילתה אחת** ומחשב cosine similarity ב-JavaScript. קריאה עם `queryEmbeddingOrig=null` מחזירה `orig: Map` ריק. מחזיר `DualSimilarityMaps { en: Map<wish_id, similarity>, orig: Map<wish_id, similarity> }`.

---

## 8. משתני סביבה

| משתנה | רגישות | שימוש |
|--------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | ציבורי | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ציבורי | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | סודי | Admin client (bypass RLS) |
| `OPENAI_API_KEY` | סודי | GPT + embeddings |
| `ADMIN_EMAIL` | סודי | Admin guard (API routes) |
| `NEXT_PUBLIC_ADMIN_EMAIL` | ציבורי | Admin guard (Header client component) |
| `NEXT_PUBLIC_ENV` | ציבורי | `'dev'` בסביבת פיתוח — מציג badge בכותרת |
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
| wishes | בעלים ← CRUD (status != 'cancelled') · כולם ← open wishes (status != 'cancelled') |
| settlements | כולם ← read only |
| wish_resonances | auth users ← resonance על open wishes |
| wish_enrichment | בעלים OR public wish |
| wish_embeddings | בעלים בלבד |
| wish_connections | משתתפים (wish_a OR wish_b) |
| match_attempts_log | admin client (service role) |
| openai_api_log | admin client (service role) |

---

## 11. עיצוב (Design System)

**שפה:** עברית, RTL · **פונטים:** Rubik (headings + body)

**פלטת צבעים:** לבן (רקע) · `slate-*` (טקסט, גבולות, קלטים) · `indigo-*` (CTA, accent, badges)

**קלאסות מרכזיות:**

| קלאס | תיאור |
|------|--------|
| `.card` | לבן, blur, פינות מעוגלות |
| `.card-hover` | card + hover scale |
| `.card-featured` | card בולט |
| `.btn-primary` | indigo-600 background |
| `.btn-amber` | amber-400, shadow |
| `.section-label` | uppercase, slate-400, small |
| `.tag-badge` | תגית עגולה |
| `.fade-in` | אנימציית כניסה 0.5s |

**מסכי Admin:** רקע slate-50 · כרטיסים bg-white border-slate-200 · CTAs indigo-600 · active nav indigo-600 · idle nav slate-600 hover:slate-100

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
| 021 | match_type enum → text, ביטול enum |
| 022 | geo_penalty בלוג |
| 023 | MATCH_THRESHOLD 0.55 → 0.48 |
| 024 | domain_match בלוג (observability) |
| 025 | anchor_entities ב-enrichment, anchor_overlap בלוג (deprecated) |
| 026 | anchor_keywords + GIN index ב-enrichment, find_structured_candidates RPC, structural_similarity + recall_source בלוג |
| 027 | settlements table + RLS (public read) |
| 028 | wish_id ב-openai_api_log |
| 029 | migration_test table (בדיקת pipeline — נמחקת ב-030) |
| 030 | DROP migration_test |
| 031 | status column ב-wishes + RLS מסנן cancelled |
| 032 | 'deleted' ב-connection_status enum; match_wishes + find_structured_candidates מסננים cancelled |
| 033 | gate_passed + gate_reason ב-match_attempts_log; טבלת match_reviews |
| 034 | translation_en ב-wish_enrichment; embedding_original (vector 1536) ב-wish_embeddings |
| 035 | semantic_similarity_orig ב-match_attempts_log |
| 036 | wish_term_embeddings — per-term embeddings לחישוב complementarity |

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
| index.ts | `processWishForMatching()`, `prepareWishForMatching()` — orchestrator v12 |
| analyze.ts | `analyzeWishText()`, `analyzeAndStoreWish()` — enrichment + translation_en |
| embed.ts | `buildEmbeddingText()`, `buildEnglishEmbeddingText()`, `generateEmbedding()`, `generateAndStoreEmbedding()` → `DualEmbedding` |
| similarity.ts | `findSimilarWishes()`, `findStructuredCandidates()`, `computeSimilaritiesForIds()` → `DualSimilarityMaps` |
| keywords.ts | `buildAnchorKeywords()`, `computeStructuralSimilarity()` |
| score.ts | `computeMatchScore(semantic, complementarity)` — v12: 0.70×semantic + 0.30×complementarity |
| complementEmbed.ts | `generateAndStoreTermEmbeddings()`, `loadTermVecsForWishes()`, `computeEmbeddingComplementarity()` |
| complement.ts | `computeComplementarity()` — legacy keyword-based (לא בשימוש ב-v12, נשמר) |
| intent.ts | `computeIntentCompatibility()` — לא בשימוש (נשמר) |
| geo.ts | `haversineKm()` — soft penalty exp(-km/50) |
| timeRange.ts | `dateRangesOverlap()` |
| canonicalize.ts | `canonicalize()`, `canonicalizeSubjectType()`, `canonicalizeAction()` |
| openaiLog.ts | `logOpenAICall(entry)` |
| anchor.ts | `computeAnchorOverlap()` — לא בשימוש ב-pipeline (נשמר) |
| objectAlignment.ts | `computeObjectAlignment()` — לא בשימוש ב-pipeline (נשמר) |
| domain.ts | `computeDomainMatch()` — לא בשימוש ב-pipeline (נשמר) |
| __tests__/ | keywords.test.ts, score.test.ts |
