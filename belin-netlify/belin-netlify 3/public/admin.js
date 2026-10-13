const $ = (q) => document.querySelector(q);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names = {leads:'Заявки',projects:'Кейсы',testimonials:'Отзывы',services:'Услуги',templates:'Шаблоны',settings:'Настройки',privacy:'Политика'};
let state = null, tab = 'leads', editing = null, supabase = null, session = null;
function flash(message) { $('#feedback').textContent = message; setTimeout(() => $('#feedback').textContent = '', 5000); }
async function initAuth() {
  const response = await fetch('/api/config', {cache:'no-store'});
  const config = await response.json();
  if (!response.ok) throw Error(config.error || 'Ошибка подключения');
  if (!config.url || !config.anonKey) throw Error('Supabase не настроен');
  const {createClient} = await import('https://esm.sh/@supabase/supabase-js@2.49.0');
  supabase = createClient(config.url, config.anonKey);
  const {data, error} = await supabase.auth.getSession();
  if (error) throw error;
  session = data.session;
}
async function api(url, options={}) {
  const headers = {'Content-Type':'application/json', ...(session?.access_token ? {Authorization:'Bearer '+session.access_token} : {}), ...options.headers};
  const response = await fetch(url, {...options, headers});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(body.error || 'Ошибка сервера (' + response.status + ')');
  return body;
}
async function reload() {
  const {data, error} = await supabase.auth.getSession();
  if (error) throw error;
  session = data.session;
  if (!session) throw Error('Войдите в систему');
  state = await api('/api/admin/data');
  state.services ||= [];
  state.templates ||= [];
  $('#login').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');
  render();
}
async function start() { try { await initAuth(); if (session) await reload(); } catch (error) { $('#login-error').textContent = error.message; } }
start();
$('#login-form').onsubmit = async (event) => {
  event.preventDefault();
  $('#login-error').textContent = '';
  try {
    if (!supabase) await initAuth();
    const form = new FormData(event.target);
    const {data, error} = await supabase.auth.signInWithPassword({email:form.get('email'), password:form.get('password')});
    if (error) throw error;
    session = data.session;
    await reload();
  } catch (error) { $('#login-error').textContent = error.message; }
};
$('#logout').onclick = async () => { await supabase?.auth.signOut(); location.reload(); };
document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => {
  tab = button.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === button));
  render();
});
function field(label, key, value='', type='text', wide=false) {
  const safe = esc(value);
  const cls = `field ${wide ? 'wide' : ''}`;
  if (type === 'textarea') return `<label class="${cls}">${esc(label)}<textarea name="${key}" rows="${key==='privacyText'?14:4}">${safe}</textarea></label>`;
  if (type === 'checkbox') return `<label class="${cls}">${esc(label)}<input type="checkbox" name="${key}" ${value?'checked':''}></label>`;
  if (type === 'file') return `<label class="${cls}">${esc(label)}<input type="file" name="${key}" accept="image/png,image/jpeg,image/webp,image/avif"></label>`;
  return `<label class="${cls}">${esc(label)}<input type="${type}" name="${key}" value="${safe}"></label>`;
}
function render() {
  if (!state) return;
  $('#page-title').textContent = names[tab];
  const box = $('#content');
  if (tab === 'leads') {
    box.innerHTML = `<div class="panel"><h2>Заявки (${state.leads.length})</h2><div class="items">${state.leads.map(l => `<article class="item"><div class="item-head"><h3>${esc(l.name)} <span class="badge">#${esc(l.id)}</span></h3><small>${esc(l.created_at)}</small></div><p>${esc(l.contact)} · ${esc(l.service)}</p><p>${esc(l.message)}</p><label>Статус <select data-lead="${Number(l.id)}">${[['new','Новая'],['in_progress','В работе'],['done','Завершена'],['spam','Спам']].map(([v,t])=>`<option value="${v}" ${l.status===v?'selected':''}>${t}</option>`).join('')}</select></label></article>`).join('') || '<p>Пока нет заявок.</p>'}</div></div>`;
    box.querySelectorAll('[data-lead]').forEach(s => s.onchange = () => changeStatus(Number(s.dataset.lead), s.value));
    return;
  }
  if (tab === 'settings' || tab === 'privacy') {
    const s = state.settings;
    const fields = tab === 'privacy' ? field('Текст политики','privacyText',s.privacyText,'textarea',true) : [
      field('Название','brand',s.brand),field('Заголовок главной','heroTitle',s.heroTitle),
      field('Описание главной','heroDescription',s.heroDescription,'textarea',true),
      field('Email','email',s.email),field('Телефон','phone',s.phone),
      field('Telegram (https://t.me/...)','telegram',s.telegram),field('Адрес','address',s.address),
      field('Цена сайта (₽)','priceSite',s.priceSite),field('Цена подписки (₽)','priceSubscription',s.priceSubscription),
      field('Текст подвала','footerText',s.footerText),
      field('Логотип (HTTPS URL или /assets/...)','logoUrl',s.logoUrl||''),
      field('Описание логотипа','logoAlt',s.logoAlt||'BELIN'),
      field('Загрузить логотип (PNG / WEBP / AVIF / JPG)','logoUpload','','file'),field('Включить приём заявок','formsEnabled',s.formsEnabled==='true','checkbox')
    ].join('');
    box.innerHTML = `<form class="panel" id="settings-form"><h2>${tab==='privacy'?'Политика обработки данных':'Контент и контакты'}</h2><div class="fields">${fields}</div><button class="btn">Сохранить настройки</button></form>`;
    $('#settings-form').onsubmit = saveSettings;
    return;
  }
  const rows = state[tab] || [];
  const isServices = tab === 'services';
  const isTemplates = tab === 'templates';
  box.innerHTML = `<div class="panel"><div class="item-head"><h2>${names[tab]} (${rows.length})</h2><button class="btn" id="add-item">+ Добавить</button></div><p class="notice">${isServices?'Услуги управляются через Supabase и выводятся в полном каталоге.':'Публикуйте только реальные кейсы и согласованные отзывы.'}</p><div class="items">${rows.map(r => `<article class="item"><div class="item-head"><h3>${esc(r.title || r.name)} <span class="badge">${r.published?'Опубликовано':'Скрыто'}</span></h3><div class="item-actions"><button class="btn secondary" data-edit="${Number(r.id)}">Редактировать</button><button class="btn danger" data-delete="${Number(r.id)}">Удалить</button></div></div>${isServices?`<p>${esc(r.category)} · ${esc(r.price)} ${esc(r.price_note)}</p>`:''}${isTemplates?`<p>${esc(r.category)} · ${esc(r.price)} · ${esc(r.demo_url||'Без демо')}</p>`:''}<p>${esc(r.description || r.body)}</p></article>`).join('') || '<p>Записей пока нет.</p>'}</div></div>`;
  $('#add-item').onclick = () => openEditor(null);
  box.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openEditor(Number(b.dataset.edit)));
  box.querySelectorAll('[data-delete]').forEach(b => b.onclick = () => removeItem(Number(b.dataset.delete)));
}
async function uploadImage(file) {
  const data = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});
  const result = await api('/api/admin/upload',{method:'POST',body:JSON.stringify({data,type:file.type})});
  return result.url;
}
async function saveSettings(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target).entries());
  if (tab === 'settings') data.formsEnabled = event.target.elements.formsEnabled.checked ? 'true' : 'false';
  delete data.logoUpload;
  try {
    const logo = event.target.elements.logoUpload?.files[0];
    if (logo) data.logoUrl = await uploadImage(logo);
    await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(data)}); await reload(); flash('Настройки сохранены'); }
  catch(error) { flash(error.message); }
}
async function changeStatus(id,status) {
  try { await api('/api/admin/leads/'+id,{method:'PUT',body:JSON.stringify({status})}); flash('Статус изменён'); }
  catch(error) { flash(error.message); }
}
function openEditor(id) {
  editing = id;
  const row = id ? state[tab].find(x => x.id === id) : {};
  if (!row) return flash('Запись не найдена');
  $('#modal-title').textContent = (id?'Редактировать':'Добавить') + ' · ' + names[tab];
  let fields;
  if (tab === 'services') {
    const features = Array.isArray(row.features) ? row.features.join('\n') : '';
    fields = [
      field('Название услуги','title',row.title||''),
      field('Категория','category',row.category||''),
      field('Описание','description',row.description||'','textarea',true),
      field('Цена (например, от 14 000 ₽)','price',row.price||''),
      field('Примечание к цене','price_note',row.price_note||''),
      field('Иконка (например, globe)','icon',row.icon||''),
      field('Изображение (HTTPS URL)','image',row.image||''),
      field('Загрузить изображение','imageUpload','','file'),
      field('Преимущества (одно на строку)','featuresText',features,'textarea',true),
      field('Текст кнопки','button_text',row.button_text||'Оставить заявку'),
      field('Порядок сортировки','sort',row.sort||0,'number'),
      field('Опубликовать','published',id?row.published:true,'checkbox')
    ];
  } else if (tab === 'templates') {
    const features = Array.isArray(row.features) ? row.features.join('\n') : '';
    fields = [field('Название шаблона','title',row.title||''),field('Ниша / категория','category',row.category||''),field('Краткое описание','description',row.description||'','textarea',true),field('Цена','price',row.price||''),field('Скриншот (HTTPS URL)','image',row.image||''),field('Загрузить превью','imageUpload','','file'),field('Ссылка на живое демо (HTTPS)','demo_url',row.demo_url||''),field('Что входит (по строкам)','featuresText',features,'textarea',true),field('Порядок','sort',row.sort||0,'number'),field('Опубликовать','published',id?row.published:true,'checkbox')];
  } else if (tab === 'projects') {
    fields = [field('Название','title',row.title||''),field('Отрасль','category',row.category||''),field('Описание','description',row.description||'','textarea',true),field('Изображение (HTTPS URL)','image',row.image||''),field('Загрузить изображение','imageUpload','','file'),field('Ссылка на проект','url',row.url||''),field('Порядок сортировки','sort',row.sort||0,'number'),field('Опубликовать','published',id?row.published:true,'checkbox')];
  } else {
    fields = [field('Имя','name',row.name||''),field('Должность / компания','role',row.role||''),field('Текст отзыва','body',row.body||'','textarea',true),field('Опубликовать','published',id?row.published:true,'checkbox')];
  }
  $('#editor-fields').innerHTML = fields.join('');
  $('#modal').classList.remove('hidden');
}
$('#cancel-modal').onclick = () => $('#modal').classList.add('hidden');
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); };
$('#editor').onsubmit = async event => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  data.published = form.elements.published.checked ? 1 : 0;
  delete data.imageUpload;
  if (tab === 'services' || tab === 'templates') {
    data.features = String(data.featuresText || '').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    delete data.featuresText;
  }
  try {
    const file = form.elements.imageUpload?.files[0];
    if (file) {
      if (file.size > 5*1024*1024) throw Error('Изображение должно быть до 5 МБ');
      const encoded = await new Promise((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const uploaded = await api('/api/admin/upload',{method:'POST',body:JSON.stringify({data:encoded,type:file.type})});
      data.image = uploaded.url;
    }
    await api('/api/admin/'+tab+(editing?'/'+editing:''),{method:editing?'PUT':'POST',body:JSON.stringify(data)});
    $('#modal').classList.add('hidden');
    await reload();
    flash('Сохранено');
  } catch(error) { flash(error.message); }
};
async function removeItem(id) {
  if (!confirm('Удалить запись без возможности восстановления?')) return;
  try { await api('/api/admin/'+tab+'/'+id,{method:'DELETE'}); await reload(); flash('Удалено'); }
  catch(error) { flash(error.message); }
}
