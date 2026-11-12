import { template } from './clean-template.mjs';

export const defaults = {
  company:'Чисто.', headline:'Идеальная чистота.', highlight:'Без потери вашего времени.',
  description:'Уборка квартир, домов и офисов. Рассчитайте стоимость и оставьте заявку.',
  primary:'#146e60', deep:'#0b4e43', background:'#f6f8f5', phone:'', email:'',
  heroImage:'', basePrice:2500, operatorName:'', privacyText:'',
  seoTitle:'Профессиональная уборка квартир и домов',
  seoDescription:'Профессиональная уборка квартир и домов. Рассчитайте стоимость и оставьте заявку.',
  services:[
    {title:'Поддерживающая уборка',description:'Поддерживаем порядок в вашем доме.',price:'от 2 500 ₽'},
    {title:'Генеральная уборка',description:'Тщательная уборка всех основных зон.',price:'от 4 500 ₽'},
    {title:'После ремонта',description:'Убираем строительную пыль и следы работ.',price:'от 6 000 ₽'}
  ]
};
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const limits={company:100,headline:200,highlight:200,description:2000,phone:50,email:150,heroImage:2000,operatorName:300,privacyText:25000,seoTitle:200,seoDescription:500};

export function normalizeContent(input) {
  if(!input || typeof input!=='object' || Array.isArray(input))throw Error('Настройки должны быть объектом');
  const output=structuredClone(defaults);
  for(const [key,max] of Object.entries(limits)){
    if(!(key in input))continue;
    if(typeof input[key]!=='string'||input[key].length>max)throw Error('Проверьте поле: '+key);
    output[key]=input[key].trim();
  }
  for(const key of ['primary','deep','background']){
    if(key in input){if(typeof input[key]!=='string'||!/^#[a-f\d]{6}$/i.test(input[key]))throw Error('Неверный цвет');output[key]=input[key]}
  }
  if('basePrice' in input){
    if(typeof input.basePrice!=='number'||!Number.isFinite(input.basePrice)||input.basePrice<1||input.basePrice>1000000)throw Error('Базовая цена: от 1 до 1 000 000 ₽');
    output.basePrice=Math.round(input.basePrice);
  }
  if(output.heroImage){let url;try{url=new URL(output.heroImage)}catch{throw Error('Неверная ссылка на изображение')}
    if(url.protocol!=='https:'||url.username||url.password)throw Error('Изображение должно иметь HTTPS-адрес');
  }
  if('services' in input){
    if(!Array.isArray(input.services)||input.services.length!==3)throw Error('Нужно три услуги');
    output.services=input.services.map(service=>{
      if(!service||typeof service!=='object'||Array.isArray(service))throw Error('Неверная услуга');
      const result={};for(const key of ['title','description','price']){
        if(typeof service[key]!=='string'||service[key].length>2000)throw Error('Неверное поле услуги');result[key]=service[key].trim();
      }return result;
    });
  }
  return output;
}
export function validatePublication(input){
  const data=normalizeContent(input);
  if(!data.company||!data.headline||!data.operatorName||data.privacyText.length<100)throw Error('Заполните название, заголовок, оператора и политику обработки данных (не менее 100 символов)');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)||data.email==='hello@example.ru'||data.phone.replace(/\D/g,'').length<10)throw Error('Укажите действующие телефон и email клиента');
  if(data.services.some(service=>!service.title||!service.price))throw Error('Заполните названия и цены услуг');
  return data;
}
export function renderClean(input,{slug='',preview=false,policyVersion=''}={}){
  const data=normalizeContent(input);
  if(!preview&&!/^clean-[0-9a-f-]{36}$/.test(slug))throw Error('Неверный адрес сайта');
  const values={...data,
    phoneHref:data.phone.replace(/[^+\d]/g,''),
    heroImage:data.heroImage||'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1100&q=85',
    privacyUrl:preview?'#preview-policy':'/s/'+slug+'/privacy'
  };
  data.services.forEach((service,i)=>{for(const key of ['title','description','price'])values['service'+i+key[0].toUpperCase()+key.slice(1)]=service[key]});
  const config=JSON.stringify({slug,preview,basePrice:data.basePrice,policyVersion}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  values.runtime='<script type="application/json" id="clean-config">'+config+'</script><script src="/assets/clean-runtime.js" defer></script>';
  let html=template.replace(/\{\{([a-zA-Z0-9]+)\}\}/g,(_,key)=>key==='runtime'?values.runtime:escapeHTML(values[key]));
  if(preview)html=html.replace('</body>','<section id="preview-policy" style="white-space:pre-wrap;padding:30px">'+escapeHTML(data.privacyText||'Здесь будет политика клиента.')+'</section></body>');
  return html;
}
