#!/usr/bin/env node
// Raster formats required by Expo are generated from the canonical outlined SVGs.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.join(root,'apps/mobile/assets/brand');fs.mkdirSync(out,{recursive:true});
const mark=fs.readFileSync(path.join(root,'packages/brand/assets/bloodchain-mark.svg'),'utf8');
const logo=fs.readFileSync(path.join(root,'packages/brand/assets/bloodchain-logo.svg'),'utf8');
const place=(svg,x,y,width,height)=>svg.replace('<svg ',`<svg x="${x}" y="${y}" width="${width}" height="${height}" `);
const white='<rect width="1024" height="1024" fill="white"/>';
const assets={
 'icon.png':{w:1024,h:1024,body:white+place(mark,188,188,648,648)},
 'adaptive-icon-foreground.png':{w:1024,h:1024,body:place(mark,300,300,424,424)},
 'adaptive-icon-background.png':{w:1024,h:1024,body:white},
 'adaptive-icon-monochrome.png':{w:1024,h:1024,body:place(mark.replace(/fill="#[0-9a-f]+"/gi,'fill="white"'),300,300,424,424)},
 'splash-icon.png':{w:1024,h:1024,body:place(mark,188,188,648,648)},
 'feature-graphic.png':{w:1024,h:500,body:'<rect width="1024" height="500" fill="white"/>'+place(logo,82,150,860,130)+'<text x="512" y="335" text-anchor="middle" font-family="sans-serif" font-size="24" letter-spacing="4" fill="#020d24">PEOPLE SAVE LIVES</text>'},
};
const browser=await chromium.launch({executablePath:process.env.QA_CHROMIUM||undefined});
try {
 const page=await browser.newPage({deviceScaleFactor:1});
 for(const[file,{w,h,body}]of Object.entries(assets)){
  await page.setViewportSize({width:w,height:h});
  await page.setContent(`<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg></body></html>`);
  await page.screenshot({path:path.join(out,file),omitBackground:true});
  console.log(`${file}: ${w}×${h}`);
 }
} finally {await browser.close();}
