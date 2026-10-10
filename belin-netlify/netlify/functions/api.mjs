import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
const json=(data,status=200)=>({statusCode:status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(data)});
const fail=(msg,status=400)=>json({error:msg},status);
const required=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
const getDB=()=>createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const text=(v,n=2000)=>String(v??'').trim().slice(0,n);
const parse=e=>{try{return JSON.parse(e.body||'{}')}catch{return {}}};
const ensure=async(e,db)=>{const token=(e.headers.authorization||e.headers.Authorization||'').replace(/^Bearer\s+/i,'');if(!token)return false;const {data:{user},error}=await db.auth.getUser(token);if(error||!user)return false;const {data}=await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();return !!data};
const select=async(db,table,filter=false)=>{let q=db.from(table).select('*');if(filter)q=q.eq('published',true);if(table==='projects')q=q.order('sort').order('id');else q=q.order('id',{ascending:false});const {data,error}=await q;if(error)throw error;return data};
export const handler=async(event)=>{
 try{
  if(required.some(k=>!process.env[k]))return fail('Не настроены переменные Supabase в Netlify.',503);
  const db=getDB(),method=event.httpMethod,path=decodeURIComponent(event.path.split('/api/')[1]||event.path.split('/.netlify/functions/api/')[1]||'');
  if(method==='GET'&&path==='config')return json({url:process.env.SUPABASE_URL,anonKey:process.env.SUPABASE_ANON_KEY});
  if(method==='GET'&&path==='public'){
   const [{data:settings,error:se},projects,testimonials]=await Promise.all([db.from('site_settings').select('key,value'),select(db,'projects',true),select(db,'testimonials',true)]);
   if(se)throw se;const s=Object.fromEntries((settings||[]).map(x=>[x.key,x.value]));delete s.privacyText;return json({settings:s,projects,testimonials});
  }
  if(method==='GET'&&path==='privacy'){const {data}=await db.from('site_settings').select('value').eq('key','privacyText').maybeSingle();return json({privacyText:data?.value||''})}
  if(method==='POST'&&path==='leads'){
   const b=parse(event);if(text(b.website))return json({ok:true});
   if(!b.consent)return fail('Необходимо согласие на обработку данных.');
   const {data:s}=await db.from('site_settings').select('key,value').in('key',['formsEnabled','privacyText']);const settings=Object.fromEntries((s||[]).map(x=>[x.key,x.value]));
   if(settings.formsEnabled!=='true'||!settings.privacyText?.trim())return fail('Приём заявок пока отключён.',403);
   const name=text(b.name,100),contact=text(b.contact,150),service=text(b.service,100),message=text(b.message,2000);
   if(name.length<2||contact.length<4||String(b.name||'').length>100||String(b.contact||'').length>150)return fail('Проверьте имя и контакты.');
   const ip=(event.headers['x-nf-client-connection-ip']||event.headers['client-ip']||'unknown').split(',')[0];
   const hash=createHash('sha256').update(ip+'|'+(process.env.LEAD_THROTTLE_SALT||process.env.SUPABASE_SERVICE_ROLE_KEY)).digest('hex');
   const {data:previous}=await db.from('lead_throttle').select('last_at').eq('ip_hash',hash).maybeSingle();
   if(previous&&Date.now()-Date.parse(previous.last_at)<60000)return fail('Подождите минуту перед повторной отправкой.',429);
   const {error}=await db.from('leads').insert({name,contact,service,message});if(error)throw error;
   await db.from('lead_throttle').upsert({ip_hash:hash,last_at:new Date().toISOString()});return json({ok:true},201);
  }
  if(!path.startsWith('admin/'))return fail('Не найдено',404);
  if(!await ensure(event,db))return fail('Нет доступа. Проверьте вход и список администраторов.',401);
  if(method==='GET'&&path==='admin/data'){
   const [leads,projects,testimonials,{data:settings,error}]=await Promise.all([select(db,'leads'),select(db,'projects'),select(db,'testimonials'),db.from('site_settings').select('key,value')]);if(error)throw error;
   return json({leads,projects,testimonials,settings:Object.fromEntries(settings.map(x=>[x.key,x.value]))});
  }
  if(method==='PUT'&&path==='admin/settings'){
   const b=parse(event),allowed=['brand','heroTitle','heroDescription','email','phone','telegram','address','priceSite','priceSubscription','footerText','formsEnabled','privacyText'];
   const rows=Object.entries(b).filter(([k])=>allowed.includes(k)).map(([key,value])=>({key,value:text(value,key==='privacyText'?25000:3000)}));
   if(rows.some(x=>x.key==='formsEnabled'&&x.value==='true')){const {data}=await db.from('site_settings').select('value').eq('key','privacyText').maybeSingle();if(!text(b.privacyText||data?.value))return fail('Сначала заполните политику обработки данных.');}
   if(rows.length){const {error}=await db.from('site_settings').upsert(rows);if(error)throw error;}return json({ok:true});
  }
  const lead=path.match(/^admin\/leads\/(\d+)$/);
  if(method==='PUT'&&lead){const status=text(parse(event).status,20);if(!['new','in_progress','done','spam'].includes(status))return fail('Неверный статус');const {error}=await db.from('leads').update({status}).eq('id',Number(lead[1]));if(error)throw error;return json({ok:true})}
  const item=path.match(/^admin\/(projects|testimonials)(?:\/(\d+))?$/);
  if(item){const table=item[1],id=item[2],b=parse(event);if(method==='DELETE'&&id){const {error}=await db.from(table).delete().eq('id',Number(id));if(error)throw error;return json({ok:true})}
   if(method==='POST'&&!id||method==='PUT'&&id){const keys=table==='projects'?['title','category','description','image','url','sort','published']:['name','role','body','published'];const obj=Object.fromEntries(keys.filter(k=>k in b).map(k=>[k,k==='published'?!!Number(b[k]):k==='sort'?Number(b[k])||0:text(b[k],k==='description'||k==='body'?4000:500)]));if(!text(obj.title||obj.name))return fail('Введите название или имя');if(obj.image&&!(/^(https:\/\/|\/assets\/)/.test(obj.image)))return fail('Ссылка на изображение должна быть HTTPS');if(obj.url&&!/^https:\/\//.test(obj.url))return fail('Ссылка проекта должна быть HTTPS');const q=id?db.from(table).update(obj).eq('id',Number(id)):db.from(table).insert(obj);const {error}=await q;if(error)throw error;return json({ok:true})}
  }
  if(method==='POST'&&path==='admin/upload'){
   const b=parse(event),bytes=Buffer.from(String(b.data||''),'base64');if(bytes.length<1||bytes.length>5*1024*1024)return fail('Файл должен быть до 5 МБ');
   const types={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/avif':'avif'},ext=types[b.type];if(!ext)return fail('Допустимы PNG, JPG, WEBP, AVIF');
   const signatures={'png':'89504e470d0a1a0a','jpg':'ffd8ff','webp':'52494646','avif':'000000'};if(ext==='png'&&!bytes.subarray(0,8).equals(Buffer.from(signatures.png,'hex'))||ext==='jpg'&&!bytes.subarray(0,3).equals(Buffer.from(signatures.jpg,'hex'))||ext==='webp'&&bytes.toString('ascii',0,4)!=='RIFF'||ext==='avif'&&bytes.toString('ascii',4,12).indexOf('ftyp')<0)return fail('Неверный формат файла');
   const name=`${Date.now()}-${createHash('sha256').update(bytes).digest('hex').slice(0,12)}.${ext}`;
   const {error}=await db.storage.from('site-assets').upload(name,bytes,{contentType:b.type,upsert:false});if(error)throw error;
   const {data}=db.storage.from('site-assets').getPublicUrl(name);return json({url:data.publicUrl});
  }
  return fail('Маршрут не найден',404);
 }catch(err){console.error('belin api error:',err);return fail('Ошибка сервера. Проверьте настройки Supabase и журналы функций.',500)}
};
