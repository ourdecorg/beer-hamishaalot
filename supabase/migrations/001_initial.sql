-- ============================================================
-- באר המשאלות — Well of Wishes
-- Initial schema migration
-- ============================================================

-- Enable extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- Enums
-- ============================================================

create type wish_visibility as enum ('private', 'anonymous', 'open');

-- ============================================================
-- Tables
-- ============================================================

-- Wishes
create table public.wishes (
  id                  uuid          primary key default gen_random_uuid(),
  user_id             uuid          not null references auth.users(id) on delete cascade,
  original_text       text          not null,
  ai_summary          text,
  ai_tags             text[],
  intention_statement text,
  visibility          wish_visibility not null default 'private',
  is_ai_enriched      boolean       not null default false,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

-- Resonances (a user resonating with a wish)
create table public.wish_resonances (
  id         uuid        primary key default gen_random_uuid(),
  wish_id    uuid        not null references public.wishes(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(wish_id, user_id)
);

-- Collaborations (reserved for future multi-user wish refinement)
create table public.collaborations (
  id               uuid        primary key default gen_random_uuid(),
  wish_id          uuid        not null references public.wishes(id) on delete cascade,
  collaborator_id  uuid        not null references auth.users(id) on delete cascade,
  role             text        not null default 'collaborator',
  status           text        not null default 'pending',
  message          text,
  created_at       timestamptz not null default now(),
  unique(wish_id, collaborator_id)
);

-- ============================================================
-- Triggers
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger wishes_updated_at
  before update on public.wishes
  for each row execute function update_updated_at();

-- ============================================================
-- Indexes
-- ============================================================

create index wishes_user_id_idx       on public.wishes(user_id);
create index wishes_visibility_idx    on public.wishes(visibility);
create index wishes_created_at_idx    on public.wishes(created_at desc);
create index resonances_wish_id_idx   on public.wish_resonances(wish_id);
create index resonances_user_id_idx   on public.wish_resonances(user_id);
create index collabs_wish_id_idx      on public.collaborations(wish_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.wishes          enable row level security;
alter table public.wish_resonances enable row level security;
alter table public.collaborations  enable row level security;

-- ── Wishes policies ──────────────────────────────────────────

-- Owners can always see their own wishes (any visibility)
create policy "wishes: owner can select"
  on public.wishes for select
  using (auth.uid() = user_id);

-- Anonymous and open wishes are visible to everyone (including unauthenticated)
create policy "wishes: public can select open/anon"
  on public.wishes for select
  using (visibility in ('anonymous', 'open'));

-- Authenticated users can create wishes they own
create policy "wishes: owner can insert"
  on public.wishes for insert
  with check (auth.uid() = user_id);

-- Owners can update their own wishes
create policy "wishes: owner can update"
  on public.wishes for update
  using (auth.uid() = user_id);

-- Owners can delete their own wishes
create policy "wishes: owner can delete"
  on public.wishes for delete
  using (auth.uid() = user_id);

-- ── Resonances policies ───────────────────────────────────────

-- Anyone can view resonance counts
create policy "resonances: anyone can select"
  on public.wish_resonances for select
  using (true);

-- Authenticated users can resonate with open/anonymous wishes (not their own)
create policy "resonances: auth users can insert"
  on public.wish_resonances for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.wishes w
      where w.id = wish_id
        and w.visibility in ('anonymous', 'open')
        and w.user_id != auth.uid()
    )
  );

-- Users can remove their own resonances
create policy "resonances: user can delete own"
  on public.wish_resonances for delete
  using (auth.uid() = user_id);

-- ── Collaborations policies ───────────────────────────────────

-- Wish owners and collaborators can view
create policy "collabs: participant can select"
  on public.collaborations for select
  using (
    auth.uid() = collaborator_id
    or exists (
      select 1 from public.wishes w
      where w.id = wish_id and w.user_id = auth.uid()
    )
  );

-- Wish owners can invite collaborators
create policy "collabs: owner can insert"
  on public.collaborations for insert
  with check (
    exists (
      select 1 from public.wishes w
      where w.id = wish_id and w.user_id = auth.uid()
    )
  );

-- Owner or collaborator can update (e.g., accept invite)
create policy "collabs: participant can update"
  on public.collaborations for update
  using (
    auth.uid() = collaborator_id
    or exists (
      select 1 from public.wishes w
      where w.id = wish_id and w.user_id = auth.uid()
    )
  );
