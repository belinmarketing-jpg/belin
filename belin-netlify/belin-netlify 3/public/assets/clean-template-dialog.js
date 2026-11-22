import { enquiryURL } from './storefront.mjs';

const dialog = document.querySelector('#clean-template-dialog');
const grid = document.querySelector('#template-grid');
const select = dialog.querySelector('#clean-platform');
const info = dialog.querySelector('#clean-platform-info');
const ready = info.innerHTML;
const enquiry = dialog.querySelector('#clean-enquire');
const preview = dialog.querySelector('.clean-screen');
const image = preview.querySelector('img');
const devices = { desktop: 'на компьютере', tablet: 'на планшете', mobile: 'на телефоне' };

grid.addEventListener('click', event => {
  const card = event.target.closest('.template-card');
  const link = event.target.closest('a');
  const details = card?.querySelector('a[href="/templates/clean/"]');
  if (!details || (link && link.getAttribute('href') !== '/templates/clean/') ||
      event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  if (typeof dialog.showModal !== 'function') return;
  event.preventDefault();
  if (!dialog.open) dialog.showModal();
});
dialog.querySelector('.clean-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
dialog.querySelector('.clean-devices').addEventListener('change', event => {
  const device = event.target.value;
  image.alt = 'BELIN Clean ' + devices[device];
  image.src = '/assets/clean-preview-' + device + '.webp';
  preview.dataset.device = device;
});
select.addEventListener('change', () => {
  const platform = select.value;
  if (platform === 'BELIN') info.innerHTML = ready;
  else info.textContent = 'Для ' + platform + ' нужна отдельная адаптация. Объём работ, цену и сроки согласуем после заявки.';
  enquiry.href = enquiryURL('template', 'BELIN Clean — ' + (platform === 'BELIN' ? 'собственная админка BELIN' : platform));
});
