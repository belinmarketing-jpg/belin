(()=>{
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const page=document.body.dataset.page||'home';
const nav=[['/','Главная'],['/services','Услуги'],['/templates','Шаблоны'],['/#cases','Кейсы'],['/#pricing','Цены'],['/#contacts','Контакты']];
const head=document.querySelector('[data-site-header]');
if(head){head.innerHTML=`<div class="shell-bar"><a class="shell-logo" href="/" aria-label="BELIN — главная" data-brand-logo><span>belin<b>.</b></span></a><nav class="shell-desktop" aria-label="Основные разделы"><a href="/services">Услуги</a><a href="/templates">Шаблоны</a><a href="/#cases">Кейсы</a></nav><a class="shell-action" href="/#contacts">Обсудить проект ↗</a><button class="shell-hamburger" type="button" aria-label="Открыть меню" aria-controls="shell-menu" aria-expanded="false"><span></span><span></span></button></div><div class="shell-menu" id="shell-menu" hidden><div class="shell-menu-inner"><span class="shell-kicker">НАВИГАЦИЯ / BELIN</span>${nav.map(([url,name],i)=>`<a href="${url}" ${page===url.slice(1)?'aria-current="page"':''}><small>0${i+1}</small>${name}<span>↗</span></a>`).join('')}</div></div>`;
const btn=head.querySelector('.shell-hamburger'),menu=head.querySelector('.shell-menu');
const close=()=>{btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-label','Открыть меню');menu.hidden=true;document.body.classList.remove('menu-open')};
btn.addEventListener('click',()=>{const open=btn.getAttribute('aria-expanded')!=='true';btn.setAttribute('aria-expanded',String(open));btn.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');menu.hidden=!open;document.body.classList.toggle('menu-open',open)});
menu.addEventListener('click',e=>{if(e.target.closest('a'))close()});document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
}
const footer=document.querySelector('[data-site-footer]');if(footer)footer.innerHTML=`<div class="shell-footer-inner"><a href="/" class="shell-logo" data-brand-logo><span>belin<b>.</b></span></a><p>Создаём сайты и цифровые продукты, которые работают.</p><div><a href="/services">Услуги</a><a href="/templates">Шаблоны</a><a href="/#contacts">Контакты</a><a href="/privacy">Политика</a></div><small>© ${new Date().getFullYear()} BELIN</small></div>`;
function applyLogo(settings){const src=String(settings?.logoUrl||'');if(!src||!(src.startsWith('/assets/')||/^https:\/\//.test(src)))return;document.querySelectorAll('[data-brand-logo]').forEach(el=>{el.replaceChildren();const img=document.createElement('img');img.src=src;img.alt=String(settings.logoAlt||'BELIN').slice(0,120);img.className='brand-image';el.append(img)});}
window.BELIN={esc,applyLogo};
fetch('/api/public',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(Error('API'))).then(data=>{applyLogo(data.settings);document.dispatchEvent(new CustomEvent('belin:data',{detail:data}))}).catch(e=>console.warn('BELIN public data:',e.message));
})();