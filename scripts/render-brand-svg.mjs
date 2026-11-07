#!/usr/bin/env node
// Canonical vector assets and Next.js favicon routes; no font or raster dependency.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const g=JSON.parse(fs.readFileSync(path.join(root,'packages/brand/geometry.json'),'utf8'));
export function svg({mark=false,dark=false,icon=false}={}) {
 const navy=dark?g.colors.darkNavy:g.colors.navy,red=dark?g.colors.darkRed:g.colors.red;
 const shapes=[...g.markNavy.map(d=>`<path d="${d}" fill="${navy}" fill-rule="evenodd"/>`),...g.drop.map((p,i)=>`<path d="${p.d}" fill="${dark&&i===0?red:p.fill}"/>`),...(mark||icon?[]:[...g.wordNavy.map(d=>`<path d="${d}" fill="${navy}" fill-rule="evenodd"/>`),...g.wordRed.map(d=>`<path d="${d}" fill="${red}" fill-rule="evenodd"/>`)])].join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon?'0 0 256 256':mark?g.markViewBox:g.viewBox}" role="img" aria-label="Bloodchain">${icon?'<rect width="256" height="256" rx="48" fill="white"/><g transform="translate(25 32) scale(.94)">':''}${shapes}${icon?'</g>':''}</svg>\n`;
}
const out=path.join(root,'packages/brand/assets');fs.mkdirSync(out,{recursive:true});
for(const [name,options] of Object.entries({'bloodchain-logo.svg':{},'bloodchain-logo-dark.svg':{dark:true},'bloodchain-mark.svg':{mark:true},'bloodchain-mark-dark.svg':{mark:true,dark:true},'bloodchain-icon.svg':{icon:true}}))fs.writeFileSync(path.join(out,name),svg(options));
for(const app of ['admin-web','hospital-web','blood-center-web','donor-web','landing-web']) {
 fs.writeFileSync(path.join(root,`apps/${app}/app/icon.svg`),svg({icon:true}));
 const publicDir=path.join(root,`apps/${app}/public/brand`);fs.mkdirSync(publicDir,{recursive:true});
 for(const name of ['bloodchain-logo.svg','bloodchain-logo-dark.svg','bloodchain-mark.svg'])fs.copyFileSync(path.join(out,name),path.join(publicDir,name));
}
console.log('Generated canonical SVGs, web downloads and five app favicons.');
