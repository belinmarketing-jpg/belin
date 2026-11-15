(() => {
  const form = document.getElementById('lead-form');
  if (!form) return;
  const params = new URLSearchParams(location.search);
  const template = params.get('template')?.slice(0,100);
  const service = params.get('service')?.slice(0,100);
  const choice = template || service;
  if (choice) {
    const value = (template ? 'Шаблон: ' : 'Услуга: ') + choice;
    const option = document.createElement('option');
    option.value = value.slice(0,100); option.textContent = value;
    form.elements.service.append(option); form.elements.service.value = option.value;
    if (!form.elements.message.value) form.elements.message.value = 'Интересует ' + (template ? 'шаблон ' : 'услуга ') + choice + '.';
  }
  const mail = document.getElementById('enquiry-email');
  if (mail) mail.href = 'mailto:belin@belin.su?subject=' + encodeURIComponent(choice ? 'BELIN — ' + choice : 'Обсудить проект с BELIN');
})();
