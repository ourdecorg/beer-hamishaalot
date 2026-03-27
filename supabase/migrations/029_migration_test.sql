create table if not exists migration_test (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  note text
);
