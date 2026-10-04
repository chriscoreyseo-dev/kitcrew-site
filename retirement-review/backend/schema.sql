-- Lead storage for the /retirement-review/ campaign (Mike Sheehan — 401k review leads).
-- Run once in the Supabase SQL editor for project obwjlqrzshdglrccsbtl.
-- RLS is enabled with no public policies: only the service-role key (used by the
-- retirement-lead edge function) can read or write.

create table if not exists public.retirement_leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  first_name    text not null,
  last_name     text not null,
  phone         text not null,
  email         text not null,
  age_range     text,
  state         text,
  plan_status   text,        -- current employer / former employer / both / IRA / not sure
  balance_range text,
  consent       boolean not null default false,
  page          text,
  utm           jsonb,
  user_agent    text,
  ip            text,
  status        text not null default 'new'  -- new / contacted / booked / closed / bad
);

alter table public.retirement_leads enable row level security;

create index if not exists retirement_leads_created_idx on public.retirement_leads (created_at desc);
