import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const script=await readFile(new URL('../public/assets/auth.js',import.meta.url),'utf8');
async function page({reset=true,session=true,hash=''}={}){
  const file=reset?'../public/login/reset/index.html':'../public/login/index.html';const {document,window}=parseHTML(await readFile(new URL(file,import.meta.url),'utf8'));
  const redirects=[],updates=[];const location={pathname:reset?'/login/reset/':'/login/',hash,origin:'https://staging.test',replace:path=>redirects.push(path)};
  const auth={onAuthStateChange:()=>{},getSession:async()=>({data:{session:session?{access_token:'test'}:null}}),updateUser:async value=>{updates.push(value);return {error:null}},signOut:async()=>({error:null})};
  await vm.runInNewContext(script,{document,window:{belinAuthReady:Promise.resolve({auth})},location,URLSearchParams});
  return {document,window,redirects,updates};
}
test('recovery page keeps session on the password form instead of dashboard redirect',async()=>{
  const p=await page();assert.equal(p.redirects.length,0);assert.equal(p.document.getElementById('submitBtn').disabled,false);
  p.document.getElementById('password').value='new-password';p.document.getElementById('confirmPassword').value='new-password';
  await p.document.getElementById('authForm').onsubmit({preventDefault(){}});
  assert.equal(p.updates[0].password,'new-password');assert.match(p.document.getElementById('message').textContent,/Пароль обновлён/);
});
test('expired recovery cannot submit and mismatched password is not sent',async()=>{
  const expired=await page({session:false});assert.equal(expired.document.getElementById('submitBtn').disabled,true);assert.match(expired.document.getElementById('message').textContent,/истекла/);
  const p=await page();p.document.getElementById('password').value='new-password';p.document.getElementById('confirmPassword').value='other-password';await p.document.getElementById('authForm').onsubmit({preventDefault(){}});assert.equal(p.updates.length,0);
});
test('old recovery URLs go to new-password page; normal session goes to dashboard',async()=>{
  const recovery=await page({reset:false,hash:'#type=recovery&access_token=test'});assert.deepEqual(recovery.redirects,['/login/reset/']);
  const normal=await page({reset:false});assert.deepEqual(normal.redirects,['/dashboard/']);
});
