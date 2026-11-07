// Start the five built apps on ports 4100..4104 before running this review check.
const path=require('node:path');
const fs=require('node:fs');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..');
const {chromium}=createRequire(path.join(root,'apps/mobile/package.json'))('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.QA_CHROMIUM||undefined});
 const results=[];
 try {
  for(const [index,app] of ['landing-web','donor-web','hospital-web','admin-web','blood-center-web'].entries()) {
   const page=await browser.newPage({viewport:{width:1440,height:950},locale:'uz-UZ'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const base=`http://localhost:${4100+index}`;
   await page.goto(base+(app==='donor-web'?'/auth':'/'),{waitUntil:'networkidle'});
   await page.locator('svg.bc-brand-logo').first().waitFor();
   await page.waitForTimeout(400);
   await page.screenshot({path:path.join(__dirname,`${app}-desktop.png`)});
   const icon=await page.request.get(base+'/icon.svg');
   const asset=await page.request.get(base+'/brand/bloodchain-logo.svg');
   const vector=await asset.text();
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   await page.screenshot({path:path.join(__dirname,`${app}-mobile.png`)});
   if(app==='landing-web') await page.locator('footer').screenshot({path:path.join(__dirname,'landing-footer.png')});
   results.push({app,logoCount:await page.locator('svg.bc-brand-logo').count(),favicon:icon.status(),download:asset.status(),outlined:vector.includes('<path')&&!vector.includes('<text')&&!vector.includes('<image'),mobileOverflow:overflow,errors});
   await page.close();
  }
 } finally {await browser.close();}
 fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
 if(results.some(r=>r.logoCount<1||r.favicon!==200||r.download!==200||!r.outlined||r.mobileOverflow||r.errors.length))process.exitCode=1;
})();
