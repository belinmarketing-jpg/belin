(() => {
  const form=document.getElementById('lead-form');if(!form)return;
  const button=form.querySelector('[type="submit"]'),status=document.getElementById('form-message');
  let config,documents,ready=false;
  button.disabled=true;
  window.BELIN_PUBLIC_DATA.then(async data=>{
    config=data.leadConfig;
    if(!config?.enabled)throw Error('Онлайн-форма пока недоступна. Напишите на belin@belin.su.');
    const response=await fetch(config.documentsURL,{cache:'no-store'});
    if(!response.ok)throw Error('Не удалось загрузить документы. Попробуйте позже.');
    documents=await response.json();
    if(!documents.enabled||!documents.version||!documents.consentText)throw Error('Приём заявок пока отключён.');
    if(documents.testMode){
      form.elements.name.value='BELIN TEST';form.elements.name.readOnly=true;
      form.elements.contact.value='belin-test@example.invalid';form.elements.contact.readOnly=true;
      form.elements.message.value='Проверка формы BELIN: вымышленные данные.';form.elements.message.readOnly=true;
      form.elements.service.replaceChildren(new Option('Тестовая заявка BELIN','Тестовая заявка BELIN'));
      form.elements.service.disabled=true;
      button.textContent='Отправить тестовую заявку';
      status.textContent='Тестовый режим: отправляется только готовая вымышленная заявка. Реальные данные не вводятся.';
    }else{button.textContent='Отправить заявку';status.textContent=''}
    ready=true;button.disabled=false;
  }).catch(error=>{status.textContent=error.message;button.textContent='Форма пока недоступна';button.disabled=true});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!ready||button.disabled)return;
    if(form.elements.consent.checked!==true){status.textContent='Подтвердите согласие на обработку данных.';return}
    button.disabled=true;status.textContent='Отправляем…';
    try{
      const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        name:form.elements.name.value,contact:form.elements.contact.value,service:form.elements.service.value,message:form.elements.message.value,
        website:form.elements.website.value,consent:true,policyVersion:documents.version
      })});
      const result=await response.json();
      if(!response.ok){if(response.status===409){ready=false;form.elements.consent.checked=false}throw Error(result.error||'Не удалось отправить заявку.')}
      status.textContent=result.testMode?'Тестовая заявка сохранена. Реальные данные не отправлялись.':'Спасибо! Заявка получена. Мы свяжемся с вами.';
      if(!documents.testMode)form.reset();else form.elements.consent.checked=false;
    }catch(error){status.textContent=error.message||'Ошибка связи. Попробуйте позже.'}
    finally{button.disabled=!ready}
  });
})();
