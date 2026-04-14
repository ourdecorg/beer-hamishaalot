-- 050_wish_notes.sql
-- Stores notes (פתקים) left by visitors via the Peek feature.
-- No login required to submit. Only the wish owner can read them.

CREATE TABLE public.wish_notes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id        uuid        NOT NULL REFERENCES public.wishes(id) ON DELETE CASCADE,
  sender_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name    text        CHECK (char_length(sender_name)  <= 100),
  sender_email   text        CHECK (char_length(sender_email) <= 200),
  message        text        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wish_notes ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can insert a note
CREATE POLICY "wish_notes_insert_public" ON public.wish_notes
  FOR INSERT WITH CHECK (true);

-- Only the wish owner can read notes on their wishes
CREATE POLICY "wish_notes_owner_select" ON public.wish_notes
  FOR SELECT USING (
    wish_id IN (
      SELECT id FROM public.wishes WHERE user_id = auth.uid()
    )
  );
