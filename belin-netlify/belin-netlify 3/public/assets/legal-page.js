(() => {
  const text=document.getElementById('policy'),status=document.getElementById('legal-status');
  const consent=document.body.dataset.document==='consent';
  window.BELIN_PUBLIC_DATA.then(async data=>{
    const response=await fetch(data.leadConfig?.documentsURL||'/api/privacy',{cache:'no-store'});
    if(!response.ok)throw Error();const documents=await response.json();
    const content=consent?documents.consentText:documents.privacyText;
    if(!content)throw Error();text.textContent=content;
    status.textContent=documents.testMode?'Тестовый документ. Приём реальных данных отключён.':'Опубликованный документ · версия '+documents.version.slice(0,12);
  }).catch(async()=>{
    try{
      const response=await fetch(consent?'/legal/consent-draft.txt':'/legal/privacy-draft.txt',{cache:'no-store'});
      if(!response.ok)throw Error();text.textContent=await response.text();
      status.textContent='Проект для согласования. Приём реальных заявок ещё не включён.';
    }catch{text.textContent='Документ временно недоступен. Вопросы: belin@belin.su.';status.textContent='Приём заявок отключён.'}
  });
})();
