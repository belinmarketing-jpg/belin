import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
const root=new URL('../',import.meta.url);
test('public HTML has canonical URLs, unique metadata and parseable structured data before JavaScript',async()=>{
 const titles=new Set();
 for(const [path,url] of [['index.html','/'],['services.html','/services'],['templates.html','/templates'],['templates/clean/index.html','/templates/clean/']]){
  const {document}=parseHTML(await readFile(new URL('public/'+path,root),'utf8'));
  assert.equal(document.querySelectorAll('h1').length,1);
  assert.equal(document.querySelector('link[rel=canonical]').getAttribute('href'),'https://belin.su'+url);
  assert.ok(document.querySelector('meta[name=description]').getAttribute('content').length>60);
  assert.ok(!titles.has(document.title));titles.add(document.title);
  const schema=JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
  assert.equal(schema['@context'],'https://schema.org');assert.ok(schema['@graph'].some(x=>x['@type']==='Organization'));
  assert.ok(document.querySelector('header a[href="/templates"]'));
 }
});
test('catalog content and product links are present in raw HTML, with no JS or database round trip required',async()=>{
 const catalog=JSON.parse(await readFile(new URL('data/public-catalog.json',root),'utf8'));
 const {document}=parseHTML(await readFile(new URL('public/services.html',root),'utf8'));
 assert.ok(catalog.services.length>0);assert.equal(document.querySelectorAll('#catalog-grid .catalog-card').length,catalog.services.length);
 const template=parseHTML(await readFile(new URL('public/templates.html',root),'utf8')).document;
 assert.ok(template.querySelector('#template-grid a[href="/templates/clean/"]'));
});
test('hashed CSS and responsive hero assets exist; private app pages stay noindex',async()=>{
 const {document}=parseHTML(await readFile(new URL('public/index.html',root),'utf8'));
 const css=document.querySelector('link[rel=stylesheet]').getAttribute('href');assert.match(css,/\/assets\/optimized\/home-[a-f0-9]+\.css$/);
 assert.ok((await stat(new URL('public'+css,root))).size>0);
 const image=document.querySelector('.cr-glass img');assert.match(image.getAttribute('srcset'),/640w.*1200w/);assert.equal(image.getAttribute('fetchpriority'),'high');
 for(const path of ['login/index.html','login/reset/index.html','dashboard/index.html','dashboard/editor/index.html']){
  const d=parseHTML(await readFile(new URL('public/'+path,root),'utf8')).document;assert.match(d.querySelector('meta[name=robots]').getAttribute('content'),/noindex/);
 }
});
