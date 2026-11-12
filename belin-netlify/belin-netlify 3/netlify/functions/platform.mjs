import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { escapeHTML, renderClean, validatePublication } from '../../public/assets/clean.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern=/^clean-[0-9a-f-]{36}$/;
const json=(body,statusCode=200)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)});
const fail=(message,status=400)=>json({error:message},status);
const html=body=>({statusCode:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src https:; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"},body});
function readBody(event){
  if(!/^application\/json(?:;|$)/i.test(event.headers['content-type']||''))throw Error('Ожидается JSON');
  const raw=event.isBase64Encoded?Buffer.from(event.body||'','base64').toString('utf8'):event.body||'{}';
  if(Buffer.byteLength(raw)>12000)throw Error('Слишком большой запрос');
  const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Неверный запрос');return body;
}
function sameOrigin(event){
  const origin=event.headers.origin;if(!origin)return true;
  try{const url=new URL(origin);return url.host===event.headers.host&&['http:','https:'].includes(url.protocol)}catch{return false}
}
export function createPlatformHandler({client=createClient,env=process.env,logger=console}={}){
  return async event=>{
    try{
      if(env.BELIN_PLATFORM_ENABLED!=='true')return fail('Платформа пока не включена.',503);
      if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.LEAD_THROTTLE_SALT)return fail('Платформа не настроена.',503);
      const db=client(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      // Netlify may report the original URL or the function rewrite target.
      let path=decodeURIComponent(event.path).replace(/\/$/,'');
      const originalSite=path.match(/^\/s\/(clean-[0-9a-f-]{36})(\/privacy)?$/);
      path=originalSite?(originalSite[2]?'privacy/':'site/')+originalSite[1]:path.replace(/^\/(?:\.netlify\/functions\/platform|api\/platform)\/?/,'');
      const publicMatch=path.match(/^(site|privacy)\/(clean-[0-9a-f-]{36})$/);
      if(publicMatch){
        if(event.httpMethod!=='GET')return fail('Метод не поддерживается',405);
        const {data:site,error}=await db.from('customer_sites').select('id,slug,published_content').eq('slug',publicMatch[2]).eq('status','published').eq('publication_enabled',true).eq('template_key','belin-clean').maybeSingle();
        if(error)throw error;if(!site?.published_content)return fail('Сайт не найден',404);
        const content=validatePublication(site.published_content);
        if(publicMatch[1]==='privacy')return html('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Политика обработки данных</title><body><main style="max-width:850px;margin:40px auto;padding:20px;font:16px/1.7 sans-serif"><h1>Политика обработки персональных данных</h1><p>Оператор: '+escapeHTML(content.operatorName)+'</p><div style="white-space:pre-wrap">'+escapeHTML(content.privacyText)+'</div><p><a href="/s/'+site.slug+'">Вернуться на сайт</a></p></main></body></html>');
        return html(renderClean(content,{slug:site.slug,policyVersion:hash(content.privacyText)}));
      }
      const publish=path.match(/^sites\/([^/]+)\/publish$/);
      if(publish){
        if(event.httpMethod!=='POST')return fail('Метод не поддерживается',405);
        if(!uuid.test(publish[1]))return fail('Неверный ID сайта');
        if(!sameOrigin(event))return fail('Недопустимый источник запроса',403);
        const token=(event.headers.authorization||'').replace(/^Bearer\s+/i,'');
        if(!token)return fail('Войдите в аккаунт',401);
        const {data:{user},error:authError}=await db.auth.getUser(token);if(authError||!user)return fail('Войдите в аккаунт',401);
        const {data:site,error}=await db.from('customer_sites').select('id,owner_id,template_key,content,publication_enabled').eq('id',publish[1]).eq('owner_id',user.id).maybeSingle();
        if(error)throw error;if(!site)return fail('Сайт не найден',404);
        if(!site.publication_enabled)return fail('Публикация ещё не разрешена BELIN. Свяжитесь с поддержкой.',403);
        if(site.template_key!=='belin-clean')return fail('Неподдерживаемый шаблон');
        let content;try{content=validatePublication(site.content)}catch(error){return fail(error.message)}
        let body;try{body=readBody(event)}catch{return fail('Проверьте формат запроса')}
        if(typeof body.expectedDraftVersion!=='string'||!/^[a-f\d]{64}$/.test(body.expectedDraftVersion))return fail('Не указана версия черновика');
        if(body.expectedDraftVersion!==hash(JSON.stringify(content)))return fail('Черновик изменился в другом окне. Обновите редактор и повторите публикацию.',409);
        const slug='clean-'+site.id.toLowerCase();
        const {data:updated,error:updateError}=await db.from('customer_sites').update({slug,published_content:content,status:'published',published_at:new Date().toISOString()}).eq('id',site.id).eq('owner_id',user.id).eq('publication_enabled',true).select('id').maybeSingle();
        if(updateError)throw updateError;if(!updated)return fail('Публикация недоступна',403);
        return json({ok:true,url:'/s/'+slug});
      }
      const leads=path.match(/^sites\/([^/]+)\/leads$/);
      if(leads){
        if(event.httpMethod!=='POST')return fail('Метод не поддерживается',405);
        if(!slugPattern.test(leads[1]))return fail('Сайт не найден',404);
        if(!sameOrigin(event))return fail('Недопустимый источник запроса',403);
        let body;try{body=readBody(event)}catch{return fail('Проверьте формат и размер запроса')}
        if(body.website)return json({ok:true},201);
        if(body.consent!==true)return fail('Необходимо согласие на обработку данных');
        for(const [key,min,max] of [['name',2,80],['contact',4,150],['message',0,2000]]){
          if(typeof body[key]!=='string'||body[key].trim().length<min||body[key].length>max)return fail('Проверьте имя, контакты и сообщение');
        }
        const {data:site,error}=await db.from('customer_sites').select('id,published_content').eq('slug',leads[1]).eq('status','published').eq('publication_enabled',true).eq('template_key','belin-clean').maybeSingle();
        if(error)throw error;if(!site?.published_content)return fail('Сайт не найден',404);
        let content;try{content=validatePublication(site.published_content)}catch{return fail('Приём заявок недоступен',403)}
        if(body.policyVersion!==hash(content.privacyText))return fail('Политика обновилась. Обновите страницу и повторите отправку.',409);
        // Trust only the Netlify-provided address, never user-supplied forwarding headers.
        const ip=event.headers['x-nf-client-connection-ip'];if(!ip)return fail('Не удалось проверить запрос. Попробуйте позже.',503);
        const {error:insertError}=await db.rpc('accept_customer_lead',{p_site_id:site.id,p_ip_hash:hash(env.LEAD_THROTTLE_SALT+'|'+ip),p_name:body.name.trim(),p_contact:body.contact.trim(),p_message:body.message.trim(),p_privacy_text:content.privacyText});
        if(insertError?.code==='P0001')return fail('Подождите минуту перед повторной отправкой.',429);
        if(insertError?.code==='P0002')return fail('Приём заявок недоступен. Обновите страницу.',409);
        if(insertError)throw insertError;
        return json({ok:true},201);
      }
      return fail('Маршрут не найден',404);
    }catch(error){logger.error('BELIN platform request failed',{code:error.code||'internal'});return fail('Ошибка сервера. Попробуйте позже.',500)}
  };
}
export const handler=createPlatformHandler();
