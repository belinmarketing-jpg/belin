import {createHash} from 'node:crypto';

export const TEST_LEAD = Object.freeze({name:'BELIN TEST',contact:'belin-test@example.invalid',service:'Тестовая заявка BELIN',message:'Проверка формы BELIN: вымышленные данные.'});
export const TEST_DOCUMENTS = Object.freeze({privacyText:'Тестовая политика BELIN. Приём реальных персональных данных на этом стенде отключён. Проверяется только доставка заранее подготовленной вымышленной заявки BELIN TEST. Этот документ не является опубликованной политикой рабочего сайта.',consentText:'Тестовое согласие BELIN. Нажатие кнопки отправляет только заранее подготовленные вымышленные данные для технической проверки формы. Не вводите реальные имя, телефон, email или сведения о людях.'});
export const documentsVersion = documents => createHash('sha256').update(documents.privacyText+'\n---\n'+documents.consentText).digest('hex');

export function publicLeadConfig(env=process.env) {
  if(env.BELIN_STUDIO_TEST_MODE==='true')return {enabled:true,testMode:true,endpoint:'/api/leads',documentsURL:'/api/privacy'};
  try{
    const url=new URL(env.BELIN_RU_LEADS_ORIGIN);
    if(url.protocol!=='https:'||url.username||url.password||url.origin!==env.BELIN_RU_LEADS_ORIGIN)throw Error();
    return {enabled:env.BELIN_STUDIO_FORMS_ENABLED==='true',testMode:false,endpoint:url.origin+'/leads',documentsURL:url.origin+'/documents'};
  }catch{return {enabled:false,testMode:false,endpoint:'',documentsURL:'/api/privacy'}}
}

export async function studioDocuments(db, env=process.env) {
  if(env.BELIN_STUDIO_TEST_MODE==='true') return {...TEST_DOCUMENTS,version:documentsVersion(TEST_DOCUMENTS),testMode:true,enabled:true};
  const {data,error}=await db.from('site_settings').select('key,value').in('key',['formsEnabled','privacyText','consentText','privacyApproved']);
  if(error)throw error;
  const settings=Object.fromEntries((data||[]).map(row=>[row.key,row.value]));
  const ready=settings.privacyApproved==='true' && (settings.privacyText?.trim().length||0)>=100 && (settings.consentText?.trim().length||0)>=100;
  const documents={privacyText:ready?settings.privacyText:'',consentText:ready?settings.consentText:''};
  return {...documents,version:ready?documentsVersion(documents):'',testMode:false,enabled:ready&&settings.formsEnabled==='true'&&env.BELIN_STUDIO_FORMS_ENABLED==='true'};
}

const reply=(data,statusCode=200)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(data)});
const fail=(error,status)=>reply({error},status);
export async function submitStudioLead(event,db,env=process.env,logger=console) {
  try {
    const headers=event.headers||{};
    if(!/^application\/json(?:;|$)/i.test(headers['content-type']||''))return fail('Ожидается JSON.',415);
    const raw=event.isBase64Encoded?Buffer.from(event.body||'','base64').toString('utf8'):event.body||'';
    if(Buffer.byteLength(raw)>12000)return fail('Слишком большой запрос.',413);
    let body;try{body=JSON.parse(raw)}catch{return fail('Неверный формат запроса.',400)}
    if(!body||typeof body!=='object'||Array.isArray(body))return fail('Неверный формат запроса.',400);
    const origin=headers.origin;
    if(origin){try{const url=new URL(origin);if(url.protocol!=='https:'||url.host!==headers.host)return fail('Недопустимый источник запроса.',403)}catch{return fail('Недопустимый источник запроса.',403)}}
    if(typeof body.website==='string'&&body.website.trim())return reply({ok:true});
    if(body.consent!==true)return fail('Подтвердите отдельное согласие на обработку данных.',400);
    const documents=await studioDocuments(db,env);
    if(!documents.enabled)return fail('Приём заявок пока отключён.',403);
    if(body.policyVersion!==documents.version)return fail('Документы обновились. Обновите страницу и подтвердите согласие заново.',409);
    for(const [key,min,max] of [['name',2,100],['contact',4,150],['service',0,100],['message',0,2000]]){
      if(typeof body[key]!=='string'||body[key].trim().length<min||body[key].length>max)return fail('Проверьте имя, контакт и сообщение.',400);
    }
    if(documents.testMode&&Object.entries(TEST_LEAD).some(([key,value])=>body[key]!==value))return fail('На стенде разрешена только готовая вымышленная заявка.',400);
    const ip=headers['x-nf-client-connection-ip'];
    if(!ip||!env.LEAD_THROTTLE_SALT)return fail('Приём заявок временно недоступен.',503);
    const ipHash=createHash('sha256').update(env.LEAD_THROTTLE_SALT+'|'+(documents.testMode?'test':'live')+'|'+ip).digest('hex');
    const {error}=await db.rpc('accept_studio_lead',{
      p_ip_hash:ipHash,p_name:body.name.trim(),p_contact:body.contact.trim(),p_service:body.service.trim(),p_message:body.message.trim(),
      p_privacy_text:documents.privacyText,p_consent_text:documents.consentText,p_policy_version:documents.version,p_test:documents.testMode
    });
    if(error?.code==='P0001')return fail('Подождите минуту перед повторной отправкой.',429);
    if(error?.code==='P0002')return fail('Документы или настройки изменились. Обновите страницу.',409);
    if(error)throw error;
    return reply({ok:true,testMode:documents.testMode},201);
  }catch(error){logger.error('BELIN studio lead failed',{code:error.code||'internal'});return fail('Не удалось отправить заявку. Попробуйте позже.',500)}
}
