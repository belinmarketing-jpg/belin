(() => {
  const form = document.getElementById('lead-form');
  if (!form) return;
  const button = form.querySelector('[type="submit"]');
  const status = document.getElementById('form-message');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    button.disabled = true;
    status.textContent = 'Отправляем…';
    try {
      const body = new URLSearchParams(new FormData(form));
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      if (!response.ok) throw new Error('Не удалось отправить заявку. Попробуйте ещё раз или напишите на belin@belin.su.');
      form.reset();
      status.textContent = 'Заявка получена. Свяжемся с вами по указанному контакту, чтобы уточнить задачу и обсудить следующий шаг.';
    } catch (error) {
      status.textContent = error.message || 'Ошибка связи. Напишите на belin@belin.su.';
    } finally {
      button.disabled = false;
    }
  });
})();
