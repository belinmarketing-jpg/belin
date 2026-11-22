const quiz = document.querySelector('#quiz');
const fields = [...quiz.querySelectorAll('fieldset')];
const back = quiz.querySelector('#back');
const next = quiz.querySelector('#next');
let step = 0;
function showStep(index, focus = true) {
  step = index;
  fields.forEach((field, i) => { field.hidden = i !== index; field.disabled = i !== index; });
  quiz.querySelector('#progress').textContent = 'Шаг ' + (index + 1) + ' из ' + fields.length;
  next.textContent = index === fields.length - 1 ? 'Проверить заявку' : 'Дальше';
  back.hidden = index === 0;
  quiz.querySelector('output').textContent = '';
  if (focus) fields[index].querySelector('input,select,textarea').focus();
}
showStep(0, false);
back.addEventListener('click', () => showStep(step - 1));
quiz.addEventListener('submit', event => {
  event.preventDefault();
  if (step < fields.length - 1) showStep(step + 1);
  else quiz.querySelector('output').textContent = 'Демо-заявка сформирована. Отправка отключена.';
});
document.querySelectorAll('[data-furniture]').forEach(button => button.addEventListener('click', () => {
  quiz.elements.furniture.value = button.dataset.furniture;
  showStep(1);
}));
const request = document.querySelector('#request');
document.querySelectorAll('[data-request]').forEach(button => button.addEventListener('click', () => {
  request.querySelector('h2').textContent = button.dataset.request;
  request.querySelector('form').reset();
  request.querySelector('output').textContent = '';
  request.showModal();
}));
request.querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  request.querySelector('output').textContent = 'Демо-заявка сформирована. Отправка отключена.';
});
const photo = document.querySelector('#photo');
document.querySelectorAll('[data-photo]').forEach(button => button.addEventListener('click', () => {
  const source = button.querySelector('img');
  const image = photo.querySelector('img');
  image.src = source.src;
  image.alt = source.alt;
  photo.showModal();
}));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
});
