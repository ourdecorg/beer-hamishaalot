-- ============================================================
-- Migration 031: Soft-delete wishes (status = 'cancelled')
-- ============================================================

-- Update public select policy to hide cancelled wishes from non-owners
drop policy if exists "wishes: public can select open/anon" on public.wishes;

create policy "wishes: public can select open/anon"
  on public.wishes for select
  using (
    visibility in ('anonymous', 'open')
    and status != 'cancelled'
  );

-- Also hide cancelled wishes from the owner's own select
drop policy if exists "wishes: owner can select" on public.wishes;

create policy "wishes: owner can select"
  on public.wishes for select
  using (
    auth.uid() = user_id
    and status != 'cancelled'
  );
