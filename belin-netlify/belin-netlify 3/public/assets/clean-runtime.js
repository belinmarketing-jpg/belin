(()=>{
  'use strict';
  const config=JSON.parse(document.getElementById('clean-config').textContent);
  const $=selector=>document.querySelector(selector), $$=selector=>document.querySelectorAll(selector);
  $('#year').textContent=new Date().getFullYear();
  const burger=$('#burger'),nav=$('#navlinks');
  burger.addEventListener('click',()=>{const open=nav.classList.toggle('open');burger.setAttribute('aria-expanded',String(open));burger.textContent=open?'×':'☰'});
  nav.addEventListener('click',event=>{if(event.target.closest('a')){nav.classList.remove('open');burger.setAttribute('aria-expanded','false');burger.textContent='☰'}});
  const base=config.basePrice,rates={regular:base/50,deep:base*1.9/50,repair:base*2.6/50},minimum={regular:base,deep:base*1.8,repair:base*2.4};
  function calculate(){const type=$('#type').value,area=Number($('#area').value),extras=[...$$('[data-extra]:checked')].reduce((sum,input)=>sum+Number(input.value),0),roomExtra=Math.max(0,Number($('#rooms').value)-2)*200;
    const total=Math.round(Math.max(minimum[type],area*rates[type])+extras+roomExtra);$('#areaValue').textContent=area+' м²';$('#price').textContent=total.toLocaleString('ru-RU')+' ₽';return total;
  }
  ['#type','#rooms','#area','[data-extra]'].forEach(selector=>$$(selector).forEach(element=>element.addEventListener('input',calculate)));calculate();
  const modal=$('#modalback'),form=$('#orderForm'),status=$('#formStatus');let previousFocus;
  function close(){modal.classList.remove('open');document.body.style.overflow='';previousFocus?.focus()}
  function open(){previousFocus=document.activeElement;modal.classList.add('open');document.body.style.overflow='hidden';status.textContent='';form.elements.name.focus()}
  $$('[data-modal]').forEach(button=>button.addEventListener('click',open));
  $('#calcOrder').addEventListener('click',()=>{open();form.elements.details.value=`Уборка: ${$('#type').selectedOptions[0].text}; ${$('#area').value} м²; ${$('#rooms').selectedOptions[0].text}. Предварительно: ${calculate().toLocaleString('ru-RU')} ₽.`});
  $('#closeModal').addEventListener('click',close);modal.addEventListener('click',event=>{if(event.target===modal)close()});
  document.addEventListener('keydown',event=>{
    if(!modal.classList.contains('open'))return;
    if(event.key==='Escape')close();
    if(event.key==='Tab'){const fields=[...modal.querySelectorAll('button,input:not([name="website"]),textarea,a')].filter(x=>!x.disabled);const first=fields[0],last=fields.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(config.preview){status.textContent='Предпросмотр: заявка не отправлена. Проверьте форму на опубликованном сайте.';return}
    const button=form.querySelector('[type="submit"]');button.disabled=true;status.textContent='Отправляем…';
    try{
      const response=await fetch('/api/platform/sites/'+encodeURIComponent(config.slug)+'/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.elements.name.value,contact:form.elements.contact.value,message:form.elements.details.value,website:form.elements.website.value,consent:form.elements.consent.checked,policyVersion:config.policyVersion})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Не удалось отправить заявку');
      status.textContent='Заявка отправлена. Мы свяжемся с вами.';form.reset();
    }catch(error){status.textContent=error.message||'Ошибка связи. Попробуйте ещё раз.'}finally{button.disabled=false}
  });
})();
