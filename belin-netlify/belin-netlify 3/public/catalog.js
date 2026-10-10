(()=>{
  const grid=document.getElementById('catalog-grid');
  const tabs=document.getElementById('catalog-tabs');
  const search=document.getElementById('catalog-search');
  const count=document.getElementById('catalog-count');
  const more=document.getElementById('catalog-more');
  if(!grid||!tabs||!search||!count||!more)return;
  let all=[],category='Все',limit=12;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(){
    const term=search.value.trim().toLocaleLowerCase('ru');
    const data=all.filter(x=>(category==='Все'||x.category===category)&&(!term||(x.name+' '+x.description+' '+x.category).toLocaleLowerCase('ru').includes(term)));
    count.textContent='Найдено услуг: '+data.length;
    grid.innerHTML=data.slice(0,limit).map(x=>`<article class="catalog-card reveal visible"><div class="catalog-card-top"><span>${esc(x.category)}</span><small>${String(x.id).padStart(2,'0')}</small></div><h3>${esc(x.name)}</h3><p>${esc(x.description||'Подробности и состав работ согласуем по вашему запросу.')}</p><div class="catalog-card-bottom"><strong>${esc(x.price)}</strong><a href="#contacts" data-service="${esc(x.name)}" aria-label="Заказать ${esc(x.name)}">${esc(x.button_text||'Обсудить')} ↗</a></div></article>`).join('')||'<p class="catalog-empty">Ничего не найдено. Попробуйте другой запрос.</p>';
    more.hidden=data.length<=limit;
  }
  function buttons(){
    const cats=['Все',...new Set(all.map(x=>x.category).filter(Boolean))];
    if(!cats.includes(category))category='Все';
    tabs.innerHTML=cats.map(c=>`<button type="button" class="catalog-tab ${c===category?'active':''}" data-category="${esc(c)}">${esc(c)}</button>`).join('');
  }
  tabs.addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;category=b.dataset.category;limit=12;buttons();render()});
  grid.addEventListener('click',e=>{const a=e.target.closest('[data-service]');if(!a)return;const f=document.getElementById('lead-form');if(f){if(f.elements.service)f.elements.service.value='Другое';if(f.elements.message)f.elements.message.value='Интересует услуга: '+a.dataset.service}});
  search.addEventListener('input',()=>{limit=12;render()});
  more.addEventListener('click',()=>{limit+=12;render()});
  fetch('/api/public',{cache:'no-store'})
    .then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()})
    .then(data=>{
      if(!Array.isArray(data.services))throw Error('Нет массива services');
      all=data.services.filter(x=>x.published===true).map(x=>({
        id:x.id,name:x.title||'',category:x.category||'Другое',
        description:x.description||'',price:x.price||'По запросу',
        button_text:x.button_text||'Обсудить'
      }));
      buttons();render();
    })
    .catch(err=>{console.error('Ошибка загрузки услуг:',err);count.textContent='Не удалось загрузить каталог услуг.';grid.innerHTML='<p class="catalog-empty">Каталог временно недоступен. Попробуйте обновить страницу позже.</p>';more.hidden=true});
})();
