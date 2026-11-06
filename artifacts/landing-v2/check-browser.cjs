const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const output = __dirname;
(async () => {
 const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
 const results=[];
 for(const width of [1920,1440,1024,768,390,360]) {
  const page=await browser.newPage({viewport:{width,height:width<=720?844:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto('http://localhost:3004/',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  await page.getByRole('heading',{name:'Kerakli kabinetni tanlang'}).waitFor();
  for(const [name,url] of [['Shifoxona kabinetiga kirish','https://hospital.bloodchain.uz'],['Qon markazi kabinetiga kirish','https://center.bloodchain.uz'],['Admin kabineti','https://admin.bloodchain.uz']]) {
   assert.equal(await page.getByRole('link',{name,exact:true}).getAttribute('href'),url);
  }
  for(const [name,title] of [['Qon markazi','Har bir birlikning o‘z tarixi'],['Donor','Keyingi qadamingizni biling'],['Shifoxona','Talabnomadan qabulgacha']]) {
   const button=page.getByRole('button',{name,exact:true});
   await button.click();
   assert.equal(await button.getAttribute('aria-pressed'),'true');
   await page.getByRole('heading',{name:title,exact:true}).waitFor();
  }
  // Keyboard activation must work as well as mouse activation.
  await page.getByRole('button',{name:'Donor',exact:true}).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('heading',{name:'Keyingi qadamingizni biling',exact:true}).waitFor();
  await page.getByRole('button',{name:'Shifoxona',exact:true}).click();
  const faq=page.locator('#questions details').first();
  await faq.locator('summary').click();
  assert.equal(await faq.evaluate(e=>e.open),true);
  await faq.locator('summary').press('Enter');
  assert.equal(await faq.evaluate(e=>e.open),false);
  if(width<=720) {
   const menu=page.locator('.mobile-navigation');
   await menu.locator('summary').click();
   await page.getByRole('navigation',{name:'Mobil navigatsiya'}).getByRole('link',{name:'Imkoniyatlar',exact:true}).click();
   assert.equal(new URL(page.url()).hash,'#features');
   assert.equal(await menu.evaluate(e=>e.open),false);
  } else {
   await page.getByRole('navigation',{name:'Asosiy navigatsiya'}).getByRole('link',{name:'Imkoniyatlar',exact:true}).click();
   assert.equal(new URL(page.url()).hash,'#features');
  }
  await page.waitForFunction(()=>document.querySelector('nav[aria-label="'+(innerWidth<=720?'Mobil navigatsiya':'Asosiy navigatsiya')+'"] a[href="#features"]')?.getAttribute('aria-current')==='location');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);
  const broken=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href')).filter(h=>h.length>1&&!document.getElementById(h.slice(1))));
  assert.deepEqual(broken,[]);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.mouse.move(0,0);
  await page.waitForTimeout(200);
  await page.screenshot({path:`${output}/landing-${width}.png`,fullPage:true});
  await page.screenshot({path:`${output}/preview-${width}.png`});
  assert.deepEqual(errors,[]);
  results.push({width,status:'PASS',checks:['HTTP 200','three portal URLs','three role views','keyboard selection','FAQ','navigation anchors','active section','mobile menu dismissal','no overflow','no runtime errors']});
  await page.close();
 }
 // HTML content and portal links remain available without JavaScript.
 const nojs=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});
 await nojs.goto('http://localhost:3004/');
 assert.equal(await nojs.getByRole('link',{name:'Shifoxona kabinetiga kirish',exact:true}).isVisible(),true);
 await nojs.close();
 const fs=require('node:fs');
 fs.writeFileSync(path.join(output, 'browser-results.json'),JSON.stringify({results,noJavaScriptPortalAccess:'PASS'},null,2)+'\n');
 console.log(JSON.stringify({results,noJavaScriptPortalAccess:'PASS'},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
