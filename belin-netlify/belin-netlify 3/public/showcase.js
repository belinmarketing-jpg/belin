import {escapeHTML, enquiryURL, mergeTemplates, safeURL} from '/assets/storefront.mjs';
(()=>{
const esc=escapeHTML;
const directions=[
['01','Разработка сайтов','Лендинги, корпоративные сайты и каталоги. Быстрые, адаптивные и готовые к заявкам.','▣','Сайты'],
['02','Брендинг и дизайн','Логотипы, фирменный стиль и визуальная система, которую запоминают.','✦','Брендинг и дизайн'],
['03','Реклама и трафик','Запускаем рекламу и приводим аудиторию, которой нужен ваш продукт.','↗','Реклама'],
['04','SEO и рост','Помогаем находить ваш бизнес в поиске и развивать органический трафик.','◎','SEO'],
['05','Боты и автоматизация','Боты, Mini Apps и сценарии, которые сокращают рутину и ускоряют процессы.','⌘','Боты'],
['06','Поддержка сайтов','Обновления, улучшения и техническая забота о проекте после запуска.','◈','Поддержка сайтов']
];
const grid=document.getElementById('direction-grid');if(grid)grid.innerHTML=directions.map(([n,title,desc,icon,category])=>`<article class="direction-card"><span class="tag">${n} / BELIN</span><div class="mini-3d"><div class="shape" aria-hidden="true">${icon}</div></div><h3>${title}</h3><p>${desc}</p><a href="#catalog-grid" data-jump-category="${esc(category)}">Смотреть услуги ↗</a></article>`).join('');
let catalog=[],selected='Все',limit=12;const list=document.getElementById('catalog-grid'),tabs=document.getElementById('catalog-tabs'),search=document.getElementById('catalog-search'),count=document.getElementById('catalog-count'),more=document.getElementById('catalog-more');
function renderCatalog(){if(!list)return;const term=(search?.value||'').trim().toLocaleLowerCase('ru');const rows=catalog.filter(x=>(selected==='Все'||x.category===selected)&&(!term||(x.title+' '+x.description+' '+x.category).toLocaleLowerCase('ru').includes(term)));if(count)count.textContent=`Найдено услуг: ${rows.length}`;list.innerHTML=rows.slice(0,limit).map(x=>`<article class="catalog-card"><div class="catalog-card-top"><span>${esc(x.category)}</span><span>#${esc(x.id)}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.description||'Подробности и состав работ обсудим с вами.')}</p><div class="catalog-card-bottom"><strong>${esc(x.price||'По запросу')}</strong><a href="${esc(enquiryURL('service',x.title))}">Обсудить ↗</a></div></article>`).join('')||'<p>Услуги не найдены.</p>';if(more)more.hidden=rows.length<=limit}
function renderTabs(){if(!tabs)return;tabs.innerHTML=['Все',...new Set(catalog.map(x=>x.category||'Другое'))].map(x=>`<button type="button" data-category="${esc(x)}" class="${x===selected?'active':''}">${esc(x)}</button>`).join('')}
tabs?.addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;selected=b.dataset.category;limit=12;renderTabs();renderCatalog()});search?.addEventListener('input',()=>{limit=12;renderCatalog()});more?.addEventListener('click',()=>{limit+=12;renderCatalog()});grid?.addEventListener('click',e=>{const a=e.target.closest('[data-jump-category]');if(!a)return;selected=a.dataset.jumpCategory;limit=12;renderTabs();renderCatalog()});
let templates=mergeTemplates(),filter='Все';const tg=document.getElementById('template-grid'),tf=document.getElementById('template-filters'),ts=document.getElementById('template-search');
function renderTemplates(){
 if(!tg)return;
 const q=(ts?.value||'').trim().toLocaleLowerCase('ru');
 const rows=templates.filter(x=>(filter==='Все'||(x.category||'Другое')===filter)&&(!q||(x.title+' '+x.category+' '+x.description).toLocaleLowerCase('ru').includes(q)));
 tg.innerHTML=rows.map(x=>{
  const demoURL=safeURL(x.demo_url),imageURL=safeURL(x.image),detailsURL=safeURL(x.details_url);
  const demo=demoURL?`<a href="${esc(demoURL)}" target="_blank" rel="noopener noreferrer">Живое демо ↗</a>`:'';
  const img=imageURL?`<img src="${esc(imageURL)}" alt="Превью: ${esc(x.title)}" loading="lazy">`:'<span aria-hidden="true">▧</span>';
  return `<article class="template-card"><div class="template-preview">${img}</div><div class="template-body"><small>${esc(x.category||'Готовый сайт')}</small><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p><div class="template-price">${esc(x.price||'Стоимость после обсуждения')}</div><div class="template-actions">${detailsURL?`<a href="${esc(detailsURL)}">Подробнее</a>`:''}${demo}<a class="buy" href="${esc(enquiryURL('template',x.title))}">Обсудить шаблон ↗</a></div></div></article>`;
 }).join('')||'<div class="empty-templates"><h3>Шаблоны не найдены</h3><p>Попробуйте другую нишу или очистите поиск.</p><button type="button" id="template-clear" class="show-btn">Сбросить поиск</button></div>';
}

function renderTemplateFilters(){if(!tf)return;tf.innerHTML=['Все',...new Set(templates.map(x=>x.category||'Другое'))].map(x=>`<button type="button" class="${x===filter?'active':''}" data-filter="${esc(x)}">${esc(x)}</button>`).join('')}
tf?.addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;renderTemplateFilters();renderTemplates()});ts?.addEventListener('input',renderTemplates);
tg?.addEventListener('click',event=>{if(event.target.closest('#template-clear')){filter='Все';ts.value='';renderTemplateFilters();renderTemplates()}});
renderTemplateFilters();renderTemplates();
window.BELIN_PUBLIC_DATA.then(data=>{catalog=Array.isArray(data.services)?data.services:[];templates=mergeTemplates(Array.isArray(data.templates)?data.templates:[]);renderTabs();renderCatalog();renderTemplateFilters();renderTemplates()}).catch(()=>{if(count)count.textContent='Каталог услуг временно недоступен';if(list)list.innerHTML='<p>Не удалось загрузить услуги. <a href="/#contacts">Свяжитесь с BELIN</a>, чтобы уточнить состав и стоимость.</p>';if(more)more.hidden=true;renderTemplateFilters();renderTemplates()});
})();