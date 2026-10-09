import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { extractFile } from '@electron/asar';

const archive='release/win-unpacked/resources/app.asar';
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
let matchedFiles=0;
function compare(directory){
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isDirectory()){compare(file);continue;}
  assert.equal(sha(extractFile(archive,file)),sha(fs.readFileSync(file)),`Stale packaged file: ${file}`);
  matchedFiles++;
 }
}
compare('apps/desktop');compare('apps/web/dist');
const executable=path.resolve(`release/IdleCorp-${JSON.parse(fs.readFileSync('package.json','utf8')).version}-Windows-x64.exe`);
const report={date:new Date().toISOString(),matchedFiles,sourceMatched:true,portableExecutable:executable,bytes:fs.statSync(executable).size,sha256:sha(fs.readFileSync(executable))};
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/package-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
