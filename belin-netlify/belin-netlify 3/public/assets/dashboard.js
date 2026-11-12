(async()=>{
  const status=document.getElementById('status'),sites=document.getElementById('sites'),inbox=document.getElementById('inbox');
  const element=(tag,text,className)=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node};
  try{
    const sb=await window.belinAuthReady;
    const {data:{user},error:authError}=await sb.auth.getUser();if(authError||!user){location.replace('/login/');return}
    document.getElementById('userEmail').textContent=user.email||'Аккаунт';
    document.getElementById('logout').onclick=async()=>{await sb.auth.signOut();location.replace('/login/')};
    const {data,error}=await sb.from('customer_sites').select('id,name,slug,status,template_key').eq('owner_id',user.id).order('id').limit(100);
    if(error)throw error;status.textContent='';
    if(!data?.length)sites.append(element('p','У вас пока нет сайтов. После покупки сайт появится здесь.','empty'));
    for(const site of data||[]){
      const card=element('article','','site');const info=element('div','');info.append(element('h3',site.name||'Сайт'),element('p',site.status==='published'?'Опубликован':'Черновик','sub'));card.append(info);
      if(site.template_key==='belin-clean'){const edit=element('a','Редактировать →');edit.href='/dashboard/editor/?id='+encodeURIComponent(site.id);card.append(edit)}
      if(site.status==='published'&&/^clean-[0-9a-f-]{36}$/.test(site.slug||'')){const link=element('a','Открыть сайт ↗');link.href='/s/'+site.slug;link.target='_blank';link.rel='noopener';card.append(link)}
      sites.append(card);
    }
    const siteNames=new Map((data||[]).map(site=>[site.id,site.name||'Сайт']));
    // RLS is the authority; the explicit site filter also limits payloads.
    if(!siteNames.size){inbox.textContent='Заявок пока нет.';return}
    const {data:leads,error:leadError}=await sb.from('customer_leads').select('id,site_id,name,contact,message,created_at').in('site_id',[...siteNames.keys()]).order('created_at',{ascending:false}).limit(100);
    if(leadError){inbox.textContent='Не удалось загрузить заявки. Попробуйте обновить страницу.';return}
    inbox.replaceChildren();if(!leads?.length)inbox.append(element('p','Заявок пока нет.'));
    for(const lead of leads||[]){const card=element('article','','card');card.style.marginBottom='16px';card.append(element('h3',lead.name),element('p',lead.contact),element('p',lead.message),element('small',siteNames.get(lead.site_id)+' · '+new Date(lead.created_at).toLocaleString('ru-RU')));inbox.append(card)}
  }catch{status.textContent='Не удалось загрузить кабинет. Попробуйте обновить страницу или войти заново.';status.className='message error'}
})();
