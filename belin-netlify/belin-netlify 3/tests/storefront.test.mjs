import test from 'node:test';
import assert from 'node:assert/strict';
import {safeURL, mergeTemplates, enquiryURL, escapeHTML} from '../public/assets/storefront.mjs';

test('catalog keeps Clean available with no database rows and allows its configured price', () => {
  assert.equal(mergeTemplates([])[0].title, 'BELIN Clean');
  const rows = mergeTemplates([{id:7,title:'BELIN Clean',price:'Цена из админки',published:true}]);
  assert.equal(rows.length,1); assert.equal(rows[0].price,'Цена из админки');
  assert.equal(rows[0].details_url,'/templates/clean/');
});
test('catalog links reject script, network-path and credential URLs', () => {
  for (const url of ['javascript:alert(1)','//evil.test','/\\evil.test','https://user:password@evil.test','data:text/html,x']) assert.equal(safeURL(url),'');
  assert.equal(safeURL('/templates/clean/demo/'),'/templates/clean/demo/');
  assert.equal(safeURL('https://example.com/demo'),'https://example.com/demo');
  assert.equal(escapeHTML('<img src=x onerror="x">'),'&lt;img src=x onerror=&quot;x&quot;&gt;');
});
test('enquiry links preserve product context without injecting extra parameters or fragments', () => {
  const title='Шаблон & услуга #1';
  const url=new URL(enquiryURL('template',title),'https://belin.su');
  assert.equal(url.searchParams.get('template'),title);
  assert.equal(url.hash,'#contacts'); assert.equal([...url.searchParams].length,1);
});
