// One request shared by the page, common navigation and catalogs.
window.BELIN_PUBLIC_DATA = fetch('/api/public', {cache:'no-store'}).then(response => {
  if (!response.ok) throw Error('Не удалось загрузить данные сайта');
  return response.json();
});
// Consumers show their own fallback. Avoid an unhandled rejection before modules load.
window.BELIN_PUBLIC_DATA.catch(() => {});
