import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

async function files(directory){const entries=await readdir(directory,{withFileTypes:true});return (await Promise.all(entries.map(entry=>entry.isDirectory()?files(directory+'/'+entry.name):directory+'/'+entry.name))).flat()}
let count=0;
for(const path of [...await files('public'),...await files('netlify/functions')]){
  const source=await readFile(path,'utf8');
  if(/\.m?js$/.test(path)){
    const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);count++;
  }
  if(path.endsWith('.html'))for(const match of source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
    if(!match[2].trim()||/application\/(?:ld\+)?json/.test(match[1]))continue;
    if(/type="module"/.test(match[1])){const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:match[2],encoding:'utf8'});if(result.status!==0)throw Error(path+': '+result.stderr)}
    else new vm.Script(match[2],{filename:path});count++;
  }
}
console.log('Syntax checked:',count,'scripts/modules');
