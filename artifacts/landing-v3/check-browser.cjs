const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const recipient = 'jaloliddinabduganiyev5@gmail.com';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const results=[];
 for(const width of [1920,1440,1024,768,390,360]) {
  const context=await browser.newContext({viewport:{width,height:width<700?844:1000},reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];const dataRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.method()==='POST') dataRequests.push(r.url());});
  const response=await page.goto('http://localhost:3004/',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  await page.getByRole('heading',{name:'Qon donorligini yangi bosqichga olib chiqamiz.'}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>getComputedStyle(document.body).fontFamily.toLowerCase().includes('inter')));
  for(const [name,href] of [['Shifoxona kabinetiga kirish','https://hospital.bloodchain.uz'],['Qon markazi kabinetiga kirish','https://center.bloodchain.uz']]) {
   const links=await page.getByRole('link',{name,exact:true}).all();
   assert.equal(links.length,2);
   for(const link of links) assert.equal(await link.getAttribute('href'),href);
  }
  for(const img of await page.locator('.product-preview img').all()) {
   assert.equal(await img.evaluate(e=>e.complete&&e.naturalWidth>0),true);
  }
  const faq=page.locator('#questions details').first();
  await faq.locator('summary').click();assert.equal(await faq.evaluate(e=>e.open),true);
  await faq.locator('summary').press('Enter');assert.equal(await faq.evaluate(e=>e.open),false);
  if(width<=900){
   const menu=page.locator('.mobile-menu');await menu.locator('summary').click();
   await page.getByRole('navigation',{name:'Mobil navigatsiya'}).getByRole('link',{name:'Hamkorlik',exact:true}).click();
   assert.equal(await menu.evaluate(e=>e.open),false);
  } else {
   await page.getByRole('navigation',{name:'Asosiy navigatsiya'}).getByRole('link',{name:'Hamkorlik',exact:true}).click();
  }
  assert.equal(new URL(page.url()).hash,'#partnership');
  const form=page.locator('.partnership-form');
  await form.getByRole('button',{name:'Murojaatni tayyorlash'}).click();
  assert.equal(await page.getByRole('region',{name:'Hamkorlik murojaati qoralamasi'}).count(),0);
  await page.getByRole('textbox',{name:'Muassasa nomi',exact:true}).fill('Sinov muassasasi');
  await page.getByLabel('Muassasa turi',{exact:false}).selectOption({label:'Shifoxona / klinika'});
  await page.getByLabel('Viloyat / hudud',{exact:false}).selectOption({label:'Toshkent shahri'});
  await page.getByLabel('Shahar / tuman',{exact:false}).fill('Yunusobod');
  await page.getByLabel('Mas’ul shaxs',{exact:false}).fill('Sinov vakili');
  await page.getByRole('textbox',{name:'Telefon yoki email',exact:true}).fill('-------');
  await page.getByLabel('Qiziqtirgan modul',{exact:false}).selectOption({label:'Shifoxona portali'});
  await form.getByRole('button',{name:'Murojaatni tayyorlash'}).click();
  await page.getByRole('alert').filter({hasText:'Telefon raqami yoki'}).waitFor();
  await page.getByRole('textbox',{name:'Telefon yoki email',exact:true}).fill('review@example.test');
  await form.getByRole('button',{name:'Murojaatni tayyorlash'}).click();
  const draft=page.getByRole('region',{name:'Hamkorlik murojaati qoralamasi'});
  await draft.waitFor();
  if(width===1440||width===390) await page.locator('#partnership').screenshot({path:path.join(__dirname,`partnership-${width}.png`)});
  const target=new URL(await draft.getByRole('link',{name:'Email dasturida ochish'}).getAttribute('href'));
  assert.equal(target.protocol,'mailto:');assert.equal(target.pathname,recipient);
  assert.ok(target.searchParams.get('body').includes('Sinov muassasasi'));
  assert.ok(target.searchParams.get('body').includes('review@example.test'));
  assert.equal(dataRequests.length,0,'No submitted form data may be sent by the landing');
  assert.equal(await page.evaluate(()=>JSON.stringify(localStorage).includes('review@example.test')),false);
  await page.getByRole('textbox',{name:'Muassasa nomi',exact:true}).fill('Yangilangan sinov');
  assert.equal(await draft.count(),0,'Changing fields must invalidate the old email draft');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
  const broken=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].map(a=>a.getAttribute('href')).filter(h=>h.length>1&&!document.getElementById(h.slice(1))));
  assert.deepEqual(broken,[]);
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.getByRole('textbox',{name:'Muassasa nomi',exact:true}).inputValue(),'');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.mouse.move(0,0);
  await page.screenshot({path:path.join(__dirname,`preview-${width}.png`)});
  await page.screenshot({path:path.join(__dirname,`landing-${width}.png`),fullPage:true});
  assert.deepEqual(errors,[]);
  results.push({width,status:'PASS',checks:['HTTP 200','local Inter','two real product previews','portal destinations','FAQ keyboard control','navigation and mobile dismissal','required fields','invalid contact rejection','correct email draft recipient','no automatic submission','draft invalidation','no persistent contact data','no overflow','no runtime errors']});
  await context.close();
 }
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
 const page=await context.newPage();await page.goto('http://localhost:3004/');
 assert.equal(await page.getByRole('link',{name:'Donor bo‘lish',exact:true}).isVisible(),true);
 const legal=[];
 for(const route of ['/privacy','/terms']){
  const response=await page.goto('http://localhost:3004'+route);assert.equal(response.status(),200);
  assert.equal(await page.locator('h1').count(),1);
  assert.ok((await page.locator('.legal-status').innerText()).includes('tasdiqlanish bosqichida'));
  legal.push({route,status:'PASS'});
 }
 await context.close();await browser.close();
 const result={results,legal,noJavaScriptContent:'PASS',emailSent:false};
 fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
