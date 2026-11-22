import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
import {escapeHTML as esc,mergeTemplates,enquiryURL,safeURL} from '../public/assets/storefront.mjs';
const root=new URL('../',import.meta.url), file=p=>new URL(p,root);
let catalog=JSON.parse(await readFile(file('data/public-catalog.json'),'utf8'));
// Refresh public catalog on hosted builds. Keep the reviewed fallback if an upstream outage occurs.
if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.SUPABASE_ANON_KEY){
 try{const {handler}=await import('../netlify/functions/api.mjs');const r=await handler({httpMethod:'GET',path:'/api/public',headers:{}});if(r.statusCode!==200)throw Error('Catalog unavailable');const d=JSON.parse(r.body);catalog={services:d.services.filter(x=>x.published!==false),templates:d.templates.filter(x=>x.published!==false)};console.log('Public catalog refreshed');}
 catch{console.warn('Using reviewed public catalog fallback');}
}
const services=catalog.services,templates=mergeTemplates(catalog.templates);
await mkdir(file('public/assets/optimized'),{recursive:true});
const styles={home:['site-shell.css','assets/brand.css','assets/creative.css'],catalog:['site-shell.css','showcase.css','belin-v2.css','assets/brand.css','assets/creative.css']};const css={};
for(const [key,paths] of Object.entries(styles)){const source=(await Promise.all(paths.map(p=>readFile(file('public/'+p),'utf8')))).join('\n');const r=await build({stdin:{contents:source,resolveDir:file('public/').pathname,loader:'css'},bundle:true,minify:true,write:false,logLevel:'silent'});const buf=r.outputFiles[0].contents;const hash=createHash('sha256').update(buf).digest('hex').slice(0,12);css[key]='/assets/optimized/'+key+'-'+hash+'.css';await writeFile(file('public'+css[key]),buf);}
const origin='https://belin.su',organization={'@type':'Organization','@id':origin+'/#organization',name:'BELIN',url:origin+'/',logo:origin+'/assets/belin-logo-dark.svg',email:'belin@belin.su',telephone:'+79000758850'};
const pages=[
 ['index.html','/','BELIN — Creative studio: дизайн, брендинг и разработка сайтов','Позиционирование, дизайн, брендинг и разработка сайтов для бизнеса. BELIN creative studio: от идеи до запуска и передачи управления.','home'],
 ['services.html','/services','Разработка сайтов, дизайн и digital-услуги — BELIN','Услуги BELIN для бизнеса: сайты, брендинг, дизайн, SEO, реклама, боты и автоматизация. Описания, цены и обсуждение задачи со студией.','catalog'],
 ['templates.html','/templates','Template — шаблоны сайтов для бизнеса | BELIN','Template от BELIN: шаблоны сайтов для бизнеса с редактором и личным кабинетом. Выберите готовое решение, обсудите адаптацию и запуск.','catalog'],
 ['templates/clean/index.html','/templates/clean/','BELIN Clean — шаблон сайта клининга с редактором','Шаблон сайта клининга BELIN Clean: услуги, калькулятор, заявки и редактор. 7 000 ₽, домен и хостинг на первый год; адаптация и настройка +5 000 ₽.','catalog']
];
const images=(await readdir(file('public/assets/optimized/'))).filter(x=>/^belin-chrome-\d+-/.test(x));const img640=images.find(x=>x.startsWith('belin-chrome-640-')),img1200=images.find(x=>x.startsWith('belin-chrome-1200-'));
if(!img640||!img1200)throw Error('Optimized hero assets missing');
for(const [path,url,title,description,style] of pages){
 const {document}=parseHTML(await readFile(file('public/'+path),'utf8'));
 function meta(name,content,property=false){let q=property?'property':'name',e=document.head.querySelector(`meta[${q}="${name}"]`);if(!e){e=document.createElement('meta');e.setAttribute(q,name);document.head.append(e)}e.setAttribute('content',content)}
 document.title=title;meta('description',description);meta('theme-color','#ffffff');meta('robots','index, follow, max-image-preview:large');
 let canonical=document.head.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical)}canonical.href=origin+url;
 for(const [k,v] of Object.entries({'og:title':title,'og:description':description,'og:url':origin+url,'og:type':'website','og:locale':'ru_RU','og:site_name':'BELIN','twitter:title':title,'twitter:description':description}))meta(k,v,k.startsWith('og:'));
 for(const e of [...document.head.querySelectorAll('link[rel="stylesheet"]')])e.remove();let link=document.createElement('link');link.rel='stylesheet';link.href=css[style];document.head.append(link);
 // Preserve Inter on catalog pages, discover it directly rather than CSS @import chains.
 if(style==='catalog'){
  for(const href of ['https://fonts.googleapis.com','https://fonts.gstatic.com']){if(!document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)){let p=document.createElement('link');p.rel='preconnect';p.href=href;if(href.includes('gstatic'))p.setAttribute('crossorigin','');document.head.append(p)}}
  let f=document.createElement('link');f.rel='stylesheet';f.href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';document.head.append(f);
 }
 for(const image of document.querySelectorAll('img[src="/assets/belin-chrome-hero.webp"]')){image.src='/assets/optimized/'+img1200;image.setAttribute('srcset',`/assets/optimized/${img640} 640w, /assets/optimized/${img1200} 1200w`);image.setAttribute('sizes','(max-width: 820px) 90vw, 48vw');image.setAttribute('width','1600');image.setAttribute('height','575');image.setAttribute('fetchpriority','high');image.setAttribute('decoding','async');}
 const list=document.querySelector('#catalog-grid');if(list){list.innerHTML=services.map(x=>`<article class="catalog-card"><div class="catalog-card-top"><span>${esc(x.category)}</span><span>#${esc(x.id)}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.description||'Обсудим состав работ.')}</p><div class="catalog-card-bottom"><strong>${esc(x.price||'По запросу')}</strong><a href="${esc(enquiryURL('service',x.title))}">Обсудить ↗</a></div></article>`).join('');const count=document.querySelector('#catalog-count');if(count)count.textContent='Найдено услуг: '+services.length;}
 const tg=document.querySelector('#template-grid');if(tg)tg.innerHTML=templates.map(x=>`<article class="template-card"><div class="template-preview">${safeURL(x.details_url)==='/templates/clean/'?'<a href="/templates/clean/" aria-label="Открыть шаблон BELIN Clean"><img src="/assets/clean-preview-desktop.webp" width="1200" height="850" loading="lazy" alt=""></a>':safeURL(x.image)?`<img src="${esc(safeURL(x.image))}" width="800" height="500" loading="lazy" alt="${esc(x.title)}">`:''}</div><div class="template-body"><small>${esc(x.category||'Готовый сайт')}</small><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p><div class="template-price">${esc(x.price||'После обсуждения')}</div><div class="template-actions">${safeURL(x.details_url)?`<a href="${esc(safeURL(x.details_url))}">Подробнее</a>`:''}${safeURL(x.demo_url)?`<a href="${esc(safeURL(x.demo_url))}">Живое демо ↗</a>`:''}<a class="buy" href="${esc(enquiryURL('template',x.title))}">Обсудить шаблон ↗</a></div></div></article>`).join('');
 const graph=[organization,{'@type':'WebSite','@id':origin+'/#website',url:origin+'/',name:'BELIN',inLanguage:'ru-RU',publisher:{'@id':organization['@id']}},{'@type':['/services','/templates'].includes(url)?'CollectionPage':'WebPage','@id':origin+url+'#webpage',url:origin+url,name:title,description,inLanguage:'ru-RU',isPartOf:{'@id':origin+'/#website'}}];
 if(url!=='/')graph.push({'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'BELIN',item:origin+'/'},{'@type':'ListItem',position:2,name:url.includes('clean')?'Template':url==='/services'?'Услуги':'Template',item:origin+(url.includes('clean')?'/templates':url)},...(url.includes('clean')?[{'@type':'ListItem',position:3,name:'BELIN Clean',item:origin+url}]:[])]});
 if(url==='/services')graph.push({'@type':'ItemList',name:'Услуги BELIN',numberOfItems:services.length,itemListElement:services.map((x,i)=>({'@type':'ListItem',position:i+1,item:{'@type':'Service',name:x.title,description:x.description,provider:{'@id':organization['@id']}}}))});
 if(url==='/templates')graph.push({'@type':'ItemList',name:'Template',numberOfItems:templates.length,itemListElement:templates.map((x,i)=>({'@type':'ListItem',position:i+1,name:x.title,...(safeURL(x.details_url)?{url:new URL(x.details_url,origin).href}:{})}))});
 for(const old of document.head.querySelectorAll('script[type="application/ld+json"]'))old.remove();const ld=document.createElement('script');ld.type='application/ld+json';ld.setAttribute('data-belin-seo','');ld.textContent=JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c');document.head.append(ld);
 // Public navigation works for crawlers and clients without JavaScript, too.
 const header=document.querySelector('[data-site-header]');if(header&&!header.querySelector('a'))header.innerHTML='<div class="shell-bar"><a class="belin-brand shell-logo" href="/" aria-label="BELIN — главная"><img class="belin-brand-full" src="/assets/belin-logo-dark.svg" width="132" height="47" alt="BELIN"></a><nav class="seo-navigation" aria-label="Навигация"><a href="/services">Услуги</a><a href="/templates">Template</a><a href="/#contacts">Контакты</a><a href="/dashboard/">Кабинет</a></nav></div>';
 await writeFile(file('public/'+path),'<!doctype html>'+document.documentElement.outerHTML.replace(/^<!doctype html>/i,''));
}
console.log(`SEO HTML ready: ${services.length} services, ${templates.length} templates, ${pages.length} pages`);
