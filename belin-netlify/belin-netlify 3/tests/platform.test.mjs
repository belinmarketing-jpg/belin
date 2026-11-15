import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPlatformHandler } from '../netlify/functions/platform.mjs';
import { defaults, normalizeContent } from '../public/assets/clean.mjs';

const id='11111111-1111-4111-8111-111111111111',owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const content=()=>({...structuredClone(defaults),company:'Клиент',phone:'+7 999 111-22-33',email:'owner@clean.test',operatorName:'ИП Клиент',privacyText:'Условия обработки персональных данных клиента. '.repeat(10).trim()});
const digest=value=>createHash('sha256').update(value).digest('hex');
function fixture(){
  const site={id,owner_id:owner,slug:'clean-'+id,status:'draft',template_key:'belin-clean',publication_enabled:true,content:content(),published_content:null};
  let user={id:owner},rpcError=null;const calls=[];
  const db={auth:{getUser:async token=>({data:{user:token==='valid'?user:null},error:null})},from(table){
    assert.equal(table,'customer_sites');const filters=[];let changes;
    const query={select(){return this},eq(key,value){filters.push([key,value]);return this},update(value){changes=value;calls.push({update:value});return this},async maybeSingle(){if(!filters.every(([key,value])=>site[key]===value))return {data:null,error:null};if(changes)Object.assign(site,changes);return {data:structuredClone(site),error:null}}};return query;
  },rpc:async(name,args)=>{calls.push({rpc:name,args});return {data:'lead-id',error:rpcError}}};
  const handler=createPlatformHandler({client:()=>db,env:{BELIN_PLATFORM_ENABLED:'true',SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'secret',LEAD_THROTTLE_SALT:'salt'},logger:{error(){}}});
  const event=(path,method='GET',body,token)=>({path:'/api/platform/'+path,httpMethod:method,headers:{host:'preview.test',origin:'https://preview.test','content-type':'application/json','x-nf-client-connection-ip':'192.0.2.1',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body||{})});
  return {site,calls,handler,event,setUser:value=>user=value,setRPCError:value=>rpcError=value};
}
test('server gates all routes by default',async()=>{
  const result=await createPlatformHandler({env:{},client:()=>{throw Error('Must not connect')}})({});assert.equal(result.statusCode,503);
});
test('only owner with entitlement can publish; publication is a separate escaped snapshot',async()=>{
  const f=fixture();const request=()=>f.handler(f.event('sites/'+id+'/publish','POST',{expectedDraftVersion:digest(JSON.stringify(normalizeContent(f.site.content)))},'valid'));
  assert.equal((await f.handler(f.event('sites/'+id+'/publish','POST'))).statusCode,401);
  f.setUser({id:'someone-else'});assert.equal((await request()).statusCode,404);
  f.setUser({id:owner});f.site.publication_enabled=false;assert.equal((await request()).statusCode,403);
  f.site.publication_enabled=true;assert.equal((await request()).statusCode,200);
  f.site.content.headline='Changed draft';
  const page=await f.handler(f.event('site/clean-'+id));assert.equal(page.statusCode,200);assert.ok(!page.body.includes('Changed draft'));assert.equal(page.headers['Cache-Control'],'no-store');
  for(const path of ['/s/clean-'+id,'/s/clean-'+id+'/privacy','/.netlify/functions/platform/site/clean-'+id]){
    const event=f.event('');event.path=path;assert.equal((await f.handler(event)).statusCode,200);
  }
  assert.ok(page.headers['Content-Security-Policy'].includes("frame-ancestors 'none'"));
  f.site.status='draft';assert.equal((await f.handler(f.event('site/clean-'+id))).statusCode,404);
});
test('publish validates content and repeats ownership/entitlement guards on update',async()=>{
  const f=fixture();f.site.content.privacyText='';assert.equal((await f.handler(f.event('sites/'+id+'/publish','POST',{},'valid'))).statusCode,400);
  assert.equal(f.calls.length,0);
  const event=f.event('sites/'+id+'/publish','POST',{},'valid');event.headers.origin='https://attacker.test';assert.equal((await f.handler(event)).statusCode,403);
});
test('a stale editor cannot accidentally publish another window draft',async()=>{
  const f=fixture();const expectedDraftVersion=digest(JSON.stringify(normalizeContent(f.site.content)));f.site.content.headline='Another window';
  const result=await f.handler(f.event('sites/'+id+'/publish','POST',{expectedDraftVersion},'valid'));
  assert.equal(result.statusCode,409);assert.equal(f.calls.length,0);assert.equal(f.site.published_content,null);
});
test('leads require published site, consent, current policy, valid input, and trusted IP',async()=>{
  const f=fixture(),path='sites/clean-'+id+'/leads';
  const body={name:'Анна',contact:'+7 999 000-00-00',message:'Уборка',consent:true,policyVersion:digest(f.site.content.privacyText)};
  const submit=value=>f.handler(f.event(path,'POST',value));
  assert.equal((await submit(body)).statusCode,404);
  f.site.status='published';f.site.published_content=structuredClone(f.site.content);
  assert.equal((await submit({...body,consent:'true'})).statusCode,400);
  assert.equal((await submit({...body,name:'x'.repeat(81)})).statusCode,400);
  assert.equal((await submit({...body,policyVersion:'stale'})).statusCode,409);
  let event=f.event(path,'POST',body);delete event.headers['x-nf-client-connection-ip'];assert.equal((await f.handler(event)).statusCode,503);
  event=f.event(path,'POST',body);event.headers.origin='null';assert.equal((await f.handler(event)).statusCode,403);
  assert.equal((await submit(body)).statusCode,201);
  const call=f.calls.find(x=>x.rpc);assert.equal(call.rpc,'accept_customer_lead');assert.equal(call.args.p_site_id,id);assert.equal(call.args.p_ip_hash,digest('salt|192.0.2.1'));assert.equal(call.args.p_privacy_text,f.site.content.privacyText);
  f.setRPCError({code:'P0001'});assert.equal((await submit(body)).statusCode,429);
  f.setRPCError({code:'P0002'});assert.equal((await submit(body)).statusCode,409);
  f.setRPCError({code:'XX000',message:'secret internal error'});const error=await submit(body);assert.equal(error.statusCode,500);assert.ok(!error.body.includes('secret'));
});
test('privacy renders escaped operator policy, method and body checks fail closed',async()=>{
  const f=fixture();f.site.status='published';f.site.published_content=content();f.site.published_content.operatorName='<script>bad</script>';
  const page=await f.handler(f.event('privacy/clean-'+id));assert.equal(page.statusCode,200);assert.ok(page.body.includes('&lt;script&gt;'));
  assert.equal((await f.handler(f.event('site/clean-'+id,'POST'))).statusCode,405);
  const event=f.event('sites/clean-'+id+'/leads','POST');event.body='{';assert.equal((await f.handler(event)).statusCode,400);
});
