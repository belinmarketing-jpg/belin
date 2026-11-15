import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {studioDocuments,submitStudioLead,TEST_LEAD,TEST_DOCUMENTS,documentsVersion} from '../netlify/functions/studio-leads.mjs';

const env={BELIN_STUDIO_TEST_MODE:'true',LEAD_THROTTLE_SALT:'test-only-salt'};
const version=documentsVersion(TEST_DOCUMENTS);
const event=body=>({headers:{host:'preview.test',origin:'https://preview.test','content-type':'application/json','x-nf-client-connection-ip':'192.0.2.11'},body:JSON.stringify(body)});
const body=()=>({...TEST_LEAD,consent:true,policyVersion:version});
const fixture=()=>{const calls=[];return {calls,db:{rpc:async(name,args)=>{calls.push({name,args});return {error:null}}}}};
test('test mode accepts only a fixed synthetic fixture and records both documents',async()=>{
 const {db,calls}=fixture();
 assert.equal((await submitStudioLead(event(body()),db,env)).statusCode,201);
 assert.equal(calls.length,1);assert.equal(calls[0].name,'accept_studio_lead');
 assert.equal(calls[0].args.p_privacy_text,TEST_DOCUMENTS.privacyText);assert.equal(calls[0].args.p_consent_text,TEST_DOCUMENTS.consentText);
 assert.equal(calls[0].args.p_test,true);assert.match(calls[0].args.p_ip_hash,/^[a-f0-9]{64}$/);
 for(const patch of [{consent:'true'},{name:'Real person'},{contact:'real@example.com'},{policyVersion:'old'}])assert.ok((await submitStudioLead(event({...body(),...patch}),db,env)).statusCode>=400);
 assert.equal(calls.length,1);
});
test('request validation rejects forged origin, oversized JSON, missing trusted IP and unconfigured salt',async()=>{
 const {db,calls}=fixture();let e=event(body());e.headers.origin='https://evil.test';assert.equal((await submitStudioLead(e,db,env)).statusCode,403);
 e=event(body());e.body='x'.repeat(12001);assert.equal((await submitStudioLead(e,db,env)).statusCode,413);
 e=event(body());e.headers['content-type']='text/plain';assert.equal((await submitStudioLead(e,db,env)).statusCode,415);
 e=event(body());delete e.headers['x-nf-client-connection-ip'];e.headers['client-ip']='192.0.2.12';assert.equal((await submitStudioLead(e,db,env)).statusCode,503);
 assert.equal((await submitStudioLead(event(body()),db,{...env,LEAD_THROTTLE_SALT:''})).statusCode,503);assert.equal(calls.length,0);
});
test('unapproved documents never enable normal collection',async()=>{
 const db={from(){return {select(){return this},async in(){return {data:[{key:'formsEnabled',value:'true'},{key:'privacyText',value:'draft'},{key:'consentText',value:'draft'}],error:null}}}}};
 const docs=await studioDocuments(db,{BELIN_STUDIO_FORMS_ENABLED:'true'});assert.equal(docs.enabled,false);assert.equal(docs.version,'');
 assert.equal((await submitStudioLead(event(body()),db,{BELIN_STUDIO_FORMS_ENABLED:'true'})).statusCode,403);
});
test('studio migration atomically saves consent, rejects stale versions, and prevents duplicate submissions',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;
   create table public.site_settings(key text primary key,value text);
   create table public.leads(id bigserial primary key,name text not null,contact text not null,service text,message text,status text default 'new',created_at timestamptz default now());
   create table public.lead_throttle(ip_hash text primary key,last_at timestamptz not null);`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261112114950_studio_lead_consent.sql',import.meta.url),'utf8'));
  await db.exec('set role service_role');
  const sql='select public.accept_studio_lead($1,$2,$3,$4,$5,$6,$7,$8,$9)';
  const args=['a'.repeat(64),...Object.values(TEST_LEAD),TEST_DOCUMENTS.privacyText,TEST_DOCUMENTS.consentText,version,true];
  const results=await Promise.allSettled([db.query(sql,args),db.query(sql,args)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.find(x=>x.status==='rejected').reason.code,'P0001');
  const saved=(await db.query('select * from public.leads')).rows;assert.equal(saved.length,1);assert.ok(saved[0].consent_at);assert.equal(saved[0].consent_text,TEST_DOCUMENTS.consentText);assert.equal(saved[0].policy_version,version);
  await assert.rejects(db.query(sql,['b'.repeat(64),...args.slice(1,7),'old',true]),{code:'P0002'});
  await assert.rejects(db.query(sql,['c'.repeat(64),...args.slice(1,8),false]),{code:'P0002'});
  await db.exec('reset role;set role anon');await assert.rejects(db.query(sql,args));await assert.rejects(db.query('select * from public.leads'));
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int as n from public.lead_throttle')).rows[0].n,1);
 }finally{await db.close()}
});
