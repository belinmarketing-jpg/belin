begin;
alter table public.leads
 add column if not exists consent_at timestamptz,
 add column if not exists privacy_text text,
 add column if not exists consent_text text,
 add column if not exists policy_version text,
 add column if not exists is_test boolean not null default false;
alter table public.leads enable row level security;
alter table public.lead_throttle enable row level security;
revoke all on public.leads,public.lead_throttle from public,anon,authenticated;
grant all on public.leads,public.lead_throttle to service_role;
grant select,update on public.site_settings to service_role;
do $$ declare seq text; begin
 select pg_get_serial_sequence('public.leads','id') into seq;
 if seq is not null then execute format('grant usage,select on sequence %s to service_role',seq); end if;
end $$;

create or replace function public.accept_studio_lead(
 p_ip_hash text,p_name text,p_contact text,p_service text,p_message text,
 p_privacy_text text,p_consent_text text,p_policy_version text,p_test boolean default false
) returns bigint language plpgsql security invoker set search_path='' as $$
declare
 current_privacy text; current_consent text; accepted_ip text; lead_id bigint;
begin
 if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$'
 or p_name is null or length(p_name) not between 2 and 100
 or p_contact is null or length(p_contact) not between 4 and 150
 or p_service is null or length(p_service)>100
 or p_message is null or length(p_message)>2000
 or p_privacy_text is null or length(p_privacy_text) not between 100 and 25000
 or p_consent_text is null or length(p_consent_text) not between 100 and 25000
 or p_test is null then raise exception using errcode='22023',message='Invalid lead'; end if;
 if p_test then
  if p_name<>'BELIN TEST' or p_contact<>'belin-test@example.invalid'
   or p_service<>'Тестовая заявка BELIN' or p_message<>'Проверка формы BELIN: вымышленные данные.'
  then raise exception using errcode='22023',message='Synthetic fixture required'; end if;
  current_privacy:=p_privacy_text;current_consent:=p_consent_text;
 else
  -- Hold the relevant configuration rows until this submission commits.
  perform 1 from public.site_settings where key in ('formsEnabled','privacyApproved','privacyText','consentText') for share;
  if not exists(select 1 from public.site_settings where key='formsEnabled' and value='true')
   or not exists(select 1 from public.site_settings where key='privacyApproved' and value='true')
  then raise exception using errcode='P0002',message='Form disabled'; end if;
  select value into current_privacy from public.site_settings where key='privacyText';
  select value into current_consent from public.site_settings where key='consentText';
 end if;
 if current_privacy is distinct from p_privacy_text or current_consent is distinct from p_consent_text
  or p_policy_version is distinct from encode(sha256(convert_to(current_privacy||E'\n---\n'||current_consent,'UTF8')),'hex')
 then raise exception using errcode='P0002',message='Documents changed'; end if;
 insert into public.lead_throttle(ip_hash,last_at) values(p_ip_hash,now())
 on conflict(ip_hash) do update set last_at=excluded.last_at
 where public.lead_throttle.last_at<=now()-interval '60 seconds'
 returning ip_hash into accepted_ip;
 if accepted_ip is null then raise exception using errcode='P0001',message='Rate limited'; end if;
 insert into public.leads(name,contact,service,message,consent_at,privacy_text,consent_text,policy_version,is_test)
 values(p_name,p_contact,p_service,p_message,now(),p_privacy_text,p_consent_text,p_policy_version,p_test)
 returning id into lead_id;
 return lead_id;
end $$;
revoke all on function public.accept_studio_lead(text,text,text,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.accept_studio_lead(text,text,text,text,text,text,text,text,boolean) to service_role;
commit;
