-- Apply manually to staging first. This migration does not publish existing sites.
begin;

create table if not exists public.customer_sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'BELIN Clean',
  template_key text not null default 'belin-clean',
  status text not null default 'draft',
  content jsonb not null default '{}'::jsonb
);
-- Existing installations must already have id, owner_id, name, template_key,
-- status and content with the types above; incompatible schemas fail atomically.
alter table public.customer_sites
  add column if not exists slug text,
  add column if not exists publication_enabled boolean not null default false,
  add column if not exists published_content jsonb,
  add column if not exists published_at timestamptz;
alter table public.customer_sites alter column id set default gen_random_uuid();
create unique index if not exists customer_sites_public_slug on public.customer_sites(slug);
create index if not exists customer_sites_owner on public.customer_sites(owner_id);
alter table public.customer_sites enable row level security;

-- Replace legacy permissive policies and column grants, not just table grants.
do $$ declare p record; c record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='customer_sites' loop
    execute format('drop policy %I on public.customer_sites', p.policyname);
  end loop;
  for c in select column_name from information_schema.columns where table_schema='public' and table_name='customer_sites' loop
    execute format('revoke all (%I) on public.customer_sites from public, anon, authenticated', c.column_name);
  end loop;
end $$;
revoke all on public.customer_sites from public, anon, authenticated;
grant select on public.customer_sites to authenticated;
grant update(content) on public.customer_sites to authenticated;
grant all on public.customer_sites to service_role;
create policy customer_sites_read_own on public.customer_sites for select to authenticated
  using (owner_id = (select auth.uid()));
create policy customer_sites_update_own_draft on public.customer_sites for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create table public.customer_leads (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.customer_sites(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  contact text not null check (char_length(contact) between 4 and 150),
  message text not null default '' check (char_length(message) <= 2000),
  privacy_text text not null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index customer_leads_site_created on public.customer_leads(site_id, created_at desc);
alter table public.customer_leads enable row level security;
revoke all on public.customer_leads from public, anon, authenticated;
grant select on public.customer_leads to authenticated;
grant all on public.customer_leads to service_role;
create policy customer_leads_read_own on public.customer_leads for select to authenticated
  using (exists (select 1 from public.customer_sites s where s.id=site_id and s.owner_id=(select auth.uid())));

create table public.customer_lead_throttle (
  site_id uuid not null references public.customer_sites(id) on delete cascade,
  ip_hash text not null,
  last_at timestamptz not null,
  primary key (site_id, ip_hash)
);
alter table public.customer_lead_throttle enable row level security;
revoke all on public.customer_lead_throttle from public, anon, authenticated;
grant all on public.customer_lead_throttle to service_role;

-- Atomic throttle and insertion. Only the server may invoke this function.
create function public.accept_customer_lead(
  p_site_id uuid, p_ip_hash text, p_name text, p_contact text,
  p_message text, p_privacy_text text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare site public.customer_sites%rowtype; accepted timestamptz; lead_id uuid;
begin
  select * into site from public.customer_sites where id=p_site_id for share;
  if not found or site.status is distinct from 'published' or site.publication_enabled is distinct from true
    or site.template_key is distinct from 'belin-clean' or site.published_content is null
    or coalesce(site.published_content->>'privacyText','') = ''
    or site.published_content->>'privacyText' is distinct from p_privacy_text then
    raise exception 'Site unavailable' using errcode='P0002';
  end if;
  insert into public.customer_lead_throttle(site_id, ip_hash, last_at)
    values (p_site_id, p_ip_hash, clock_timestamp())
    on conflict (site_id, ip_hash) do update set last_at=excluded.last_at
    where public.customer_lead_throttle.last_at <= clock_timestamp() - interval '1 minute'
    returning last_at into accepted;
  if accepted is null then raise exception 'Rate limit' using errcode='P0001'; end if;
  insert into public.customer_leads(site_id,name,contact,message,privacy_text)
    values (p_site_id,p_name,p_contact,p_message,p_privacy_text) returning id into lead_id;
  return lead_id;
end $$;
revoke all on function public.accept_customer_lead(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.accept_customer_lead(uuid,text,text,text,text,text) to service_role;
commit;
