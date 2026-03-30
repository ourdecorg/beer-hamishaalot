-- Migration 034: dual embedding + English translation in enrichment
--
-- translation_en: standard English translation of the wish, produced by the LLM
--   during enrichment. Used to build a language-agnostic English embedding so that
--   cross-lingual wish pairs (e.g. Hebrew ↔ English) can be matched via ANN.
--
-- embedding_original: the embedding computed from the wish text in its original
--   language. Stored for future use (e.g. secondary scoring signal). The primary
--   `embedding` column now holds the English-based embedding.

alter table public.wish_enrichment
  add column if not exists translation_en text;

alter table public.wish_embeddings
  add column if not exists embedding_original vector(1536);
