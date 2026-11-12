export const featuredTemplates = [{
  id: 'belin-clean', title: 'BELIN Clean', category: 'Клининг',
  description: 'Сайт клининговой компании: услуги, калькулятор стоимости, форма заявки и редактор. Домен и хостинг включены. Поддержка — 329 ₽/мес; адаптация и настройка — +5 000 ₽.',
  price: '7 000 ₽', image: '/assets/clean-storefront.svg',
  demo_url: '/templates/clean/demo/', details_url: '/templates/clean/', published: true
}];

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function safeURL(value) {
  if (typeof value !== 'string' || /[\s\\]/.test(value)) return '';
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}

export function enquiryURL(kind, title) {
  return '/?' + new URLSearchParams({[kind === 'template' ? 'template' : 'service']: String(title).slice(0, 100)}) + '#contacts';
}

export function mergeTemplates(rows = []) {
  const result = [...featuredTemplates];
  for (const row of rows) {
    if (row.published === false) continue;
    const index = result.findIndex(item => String(item.title).trim().toLowerCase() === String(row.title).trim().toLowerCase());
    if (index < 0) result.push(row);
    else result[index] = {...result[index], ...row, details_url: result[index].details_url};
  }
  return result;
}
