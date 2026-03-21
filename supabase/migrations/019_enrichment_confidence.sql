-- Migration 019: add confidence + ambiguity_flag to wish_enrichment
alter table wish_enrichment
  add column if not exists confidence     numeric(4,3) default null,
  add column if not exists ambiguity_flag boolean      default null;

comment on column wish_enrichment.confidence     is '0.0–1.0 GPT extraction confidence score';
comment on column wish_enrichment.ambiguity_flag is 'true when the wish is vague or unclear for matching';
