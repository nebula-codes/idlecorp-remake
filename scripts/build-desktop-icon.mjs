import { chromium } from 'playwright';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:256,height:256},deviceScaleFactor:1});await page.setContent('<body style="margin:0;background:transparent">'+fs.readFileSync('apps/desktop/icon.svg','utf8')+'</body>');const png=await page.screenshot({omitBackground:true});
 const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);fs.writeFileSync('apps/desktop/icon.ico',Buffer.concat([header,png]));
}finally{await browser.close();}
