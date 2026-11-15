import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { defaults, normalizeContent, renderClean, validatePublication } from '../public/assets/clean.mjs';

export const validContent=()=>({...structuredClone(defaults),company:'Уборка & дом',phone:'+7 999 123-45-67',email:'owner@clean.test',operatorName:'ИП Тест',privacyText:'Согласованная политика оператора. '.repeat(10)});
const slug='clean-11111111-1111-4111-8111-111111111111';
test('malformed imports are rejected rather than crashing editor fields',()=>{
  for(const services of [[null,null,null],{},[{title:'a'},null,{}]])assert.throws(()=>normalizeContent({services}));
  assert.throws(()=>normalizeContent({primary:'red; background:url(https://bad.test)'}));
  assert.throws(()=>normalizeContent({heroImage:'javascript:alert(1)'}));
  assert.throws(()=>normalizeContent({basePrice:Infinity}));
  assert.throws(()=>normalizeContent({headline:22}));
  assert.equal(normalizeContent({owner_id:'hijack'}).owner_id,undefined);
});
test('publication requires actual contacts and operator policy',()=>{
  assert.throws(()=>validatePublication(defaults));
  assert.equal(validatePublication(validContent()).operatorName,'ИП Тест');
});
test('HTML renders saved values, escapes injections, and removes demonstration claims',()=>{
  const input=validContent();input.headline='</h1><script>alert(1)</script>';input.services[0].title='<img src=x onerror=alert(1)>';
  const html=renderClean(input,{slug,policyVersion:'abc'}),{document}=parseHTML(html);
  assert.equal(document.querySelector('h1').textContent,input.headline+input.highlight);
  assert.equal(document.querySelector('.service h3').textContent,input.services[0].title);
  assert.equal(document.querySelector('.footer-top b').textContent,input.phone);
  assert.equal(document.querySelector('.logo').textContent,input.company);
  assert.equal(document.querySelectorAll('script').length,2);
  assert.ok(!html.includes('2 400+')&&!html.includes('Пример отзыва')&&!html.includes('hello@example.ru'));
  assert.ok(!/\{\{[a-zA-Z]/.test(html));
  assert.equal(document.querySelector('[name="consent"]').getAttribute('required'),'');
  assert.equal(JSON.parse(document.getElementById('clean-config').textContent).preview,false);
});
test('preview remains a preview and calculator responds to the saved base price',()=>{
  const input=validContent();input.basePrice=4000;
  const {window,document}=parseHTML(renderClean(input,{preview:true}));
  // linkedom has no layout or browser select implementation; provide selected values.
  for(const [id,value] of [['type','regular'],['rooms','1']])Object.defineProperty(document.getElementById(id),'value',{value,configurable:true});
  const context=vm.createContext({document,window,URL,console,fetch:()=>{throw Error('Preview must not submit')}});
  vm.runInContext(readFileSync(new URL('../public/assets/clean-runtime.js',import.meta.url),'utf8'),context);
  assert.equal(document.getElementById('price').textContent,'4 000 ₽');
  document.getElementById('orderForm').dispatchEvent(new window.Event('submit',{cancelable:true}));
  assert.match(document.getElementById('formStatus').textContent,/Предпросмотр/);
});
