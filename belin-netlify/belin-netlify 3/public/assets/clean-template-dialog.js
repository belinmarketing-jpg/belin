import { enquiryURL, featuredTemplates } from './storefront.mjs';

const dialog = document.querySelector('#clean-template-dialog');
const grid = document.querySelector('#template-grid');
const select = dialog.querySelector('#clean-platform');
const info = dialog.querySelector('#clean-platform-info');
const cleanPricing = info.innerHTML;
const title = dialog.querySelector('#clean-modal-title');
const category = dialog.querySelector('.clean-dialog-header p');
const description = dialog.querySelector('.clean-order > p');
const cleanDescription = description.textContent;
const demo = dialog.querySelector('.clean-dialog-grid a[href="/templates/clean/demo/"]');
const templates = new Map(featuredTemplates.map(template => [template.details_url, template]));
let active;
const enquiry = dialog.querySelector('#clean-enquire');
const preview = dialog.querySelector('.clean-screen');
const image = preview.querySelector('img');
const devices = { desktop: 'на компьютере', tablet: 'на планшете', mobile: 'на телефоне' };

grid.addEventListener('click', event => {
  const card = event.target.closest('.template-card');
  const link = event.target.closest('a');
  const details = card?.querySelector('[data-template-details]');
  const template = templates.get(details?.getAttribute('href'));
  if (!template || (link && !link.hasAttribute('data-template-details')) ||
      event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  if (typeof dialog.showModal !== 'function') return;
  event.preventDefault();
  if (dialog.open) return;
  active = template;
  title.textContent = template.title;
  category.textContent = 'Шаблон сайта · ' + template.category;
  description.textContent = template.id === 'belin-clean' ? cleanDescription : template.description;
  demo.href = template.demo_url;
  dialog.querySelector('[name="clean-device"][value="desktop"]').checked = true;
  setDevice('desktop');
  select.value = 'BELIN';
  updatePlatform();
  dialog.showModal();
});
dialog.querySelector('.clean-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
function setDevice(device) {
  image.alt = active.title + ' ' + devices[device];
  image.src = active.preview_base + device + '.webp';
  preview.dataset.device = device;
}
function updatePlatform() {
  const platform = select.value;
  if (platform === 'BELIN' && active.id === 'belin-clean') info.innerHTML = cleanPricing;
  else if (platform === 'BELIN') info.textContent = 'Сайт на собственной админке BELIN. Подключение редактора и приёма заявок, стоимость и сроки согласуем отдельно.';
  else info.textContent = 'Для ' + platform + ' нужна отдельная адаптация. Объём работ, цену и сроки согласуем после заявки.';
  enquiry.href = enquiryURL('template', active.title + ' — ' + (platform === 'BELIN' ? 'собственная админка BELIN' : platform));
}
dialog.querySelector('.clean-devices').addEventListener('change', event => setDevice(event.target.value));
select.addEventListener('change', updatePlatform);
