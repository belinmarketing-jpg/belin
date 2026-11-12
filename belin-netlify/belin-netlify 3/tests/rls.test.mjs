import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SA='11111111-1111-4111-8111-111111111111',SB='22222222-2222-4222-8222-222222222222';
test('migration creates a fresh isolated platform without publishing any site',async()=>{
  const db=new PGlite();try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
    await db.exec(await readFile(new URL('../supabase/migrations/202611120001_customer_platform.sql',import.meta.url),'utf8'));
    await db.query('insert into auth.users values($1)',[A]);
    const result=await db.query('insert into public.customer_sites(owner_id) values($1) returning id,status,publication_enabled,published_content',[A]);
    assert.ok(result.rows[0].id);assert.equal(result.rows[0].status,'draft');assert.equal(result.rows[0].publication_enabled,false);assert.equal(result.rows[0].published_content,null);
  }finally{await db.close()}
});
test('migration replaces legacy grants; owners can edit drafts but never identities, publication or foreign rows',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to authenticated;
      create table public.customer_sites(id uuid primary key,owner_id uuid not null references auth.users(id),name text not null default 'Clean',template_key text not null default 'belin-clean',status text not null default 'draft',content jsonb not null default '{}');
      alter table public.customer_sites enable row level security;
      create policy legacy_everyone on public.customer_sites for all using(true) with check(true);
      grant all on public.customer_sites to anon,authenticated;
      grant update(owner_id) on public.customer_sites to authenticated;
      alter table public.customer_sites add column slug text unique;
      create index customer_sites_owner_id_idx on public.customer_sites(owner_id);
      alter table public.customer_sites add constraint customer_sites_status_check check(status in ('draft','active','suspended'));
      create table public.services(id bigint);create table public.templates(id bigint);
      grant all on public.services,public.templates to anon,authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/202611120001_customer_platform.sql',import.meta.url),'utf8'));
    await db.query('insert into auth.users values ($1),($2)',[A,B]);
    await db.query('insert into public.customer_sites(id,owner_id) values ($1,$2),($3,$4)',[SA,A,SB,B]);
    async function as(role,user,sql,params=[]){await db.exec('begin; set local role '+role);try{await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user||'']);const result=await db.query(sql,params);await db.exec('rollback');return result}catch(error){await db.exec('rollback');throw error}}
    assert.equal((await as('authenticated',A,'select id from public.customer_sites')).rows.length,1);
    const catalogRights=await as('anon',null,"select has_table_privilege(current_user,'public.services','TRUNCATE') as services,has_table_privilege(current_user,'public.templates','TRUNCATE') as templates");
    assert.equal(catalogRights.rows[0].services,false);assert.equal(catalogRights.rows[0].templates,false);
    assert.equal((await as('authenticated',A,'select id from public.customer_sites where id=$1',[SB])).rows.length,0);
    assert.equal((await as('authenticated',A,"update public.customer_sites set content='{\"headline\":\"Saved\"}' where id=$1 returning id",[SA])).rows.length,1);
    assert.equal((await as('authenticated',A,"update public.customer_sites set content='{}' where id=$1 returning id",[SB])).rows.length,0);
    for(const sql of ["update public.customer_sites set owner_id='"+B+"'","update public.customer_sites set publication_enabled=true","update public.customer_sites set status='published'","update public.customer_sites set published_content='{}'","delete from public.customer_sites","insert into public.customer_sites(id,owner_id) values(gen_random_uuid(),'"+A+"')"]){await assert.rejects(as('authenticated',A,sql))}
    await assert.rejects(as('anon',null,'select * from public.customer_sites'));
    await assert.rejects(as('authenticated',A,"select public.accept_customer_lead($1,'ip','Name','Contact','','Policy')",[SA]));
    const policy='Policy for this site';
    await db.query("update public.customer_sites set status='published',publication_enabled=true,published_content=jsonb_build_object('privacyText',$1::text) where id=$2",[policy,SA]);
    await db.exec('begin; set local role service_role');
    await db.query('select public.accept_customer_lead($1,$2,$3,$4,$5,$6)',[SA,'ip','Name','Contact','Message',policy]);await db.exec('commit');
    assert.equal((await as('authenticated',A,'select * from public.customer_leads')).rows.length,1);
    assert.equal((await as('authenticated',B,'select * from public.customer_leads')).rows.length,0);
    await assert.rejects(as('anon',null,'select * from public.customer_leads'));
    await assert.rejects(as('authenticated',A,'update public.customer_leads set name=\'Changed\''));
    await assert.rejects(as('service_role',null,'select public.accept_customer_lead($1,$2,$3,$4,$5,$6)',[SA,'ip','Name','Contact','Message',policy]),error=>error.code==='P0001');
    await assert.rejects(as('service_role',null,'select public.accept_customer_lead($1,$2,$3,$4,$5,$6)',[SA,'new-ip','Name','Contact','Message','Stale policy']),error=>error.code==='P0002');
    await assert.rejects(as('service_role',null,'select public.accept_customer_lead($1,$2,$3,$4,$5,$6)',[SB,'new-ip','Name','Contact','Message',policy]),error=>error.code==='P0002');
  }finally{await db.close()}
});
