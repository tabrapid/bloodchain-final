const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const out=__dirname;const results=[];
const org={id:'org1',name:'Demo Institution',type:'HOSPITAL',status:'ACTIVE',staffCount:3,createdAt:'2026-11-06T07:00:00Z'};
const user={id:'staff2',firstName:'Demo',lastName:'User',email:'demo@example.test',status:'ACTIVE',emailVerified:true,createdAt:'2026-11-06T07:00:00Z',roles:Array.from({length:15},(_,i)=>({membershipId:`m${i}`,role:'DONOR',organization:{id:`org${i}`,name:`Demo institution ${i+1}`,type:'HOSPITAL'}}))};
const requests=Array.from({length:3},(_,i)=>({id:`req${i+1}`,requestReference:`REQ-00${i+1}`,status:i===0?'SUBMITTED':'APPROVED',priority:i===0?'URGENT':'ROUTINE',createdAt:'2026-11-06T07:00:00Z',requestingOrganization:{id:'org1',name:'Demo Hospital'},fulfillingOrganization:{id:'org2',name:'Demo Blood Center'},items:[{id:`item${i}`,bloodType:'A',rhFactor:'POSITIVE',componentType:'RED_CELLS',unitsRequested:4,unitsApproved:i===0?0:4,unitsFulfilled:0}]}));
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
async function setup(kind,width){const context=await browser.newContext({viewport:{width,height:width<700?740:960},reducedMotion:'reduce'});const page=await context.newPage();let failRequests=false;const errors=[],fontRequests=[],posts=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/fonts\.(googleapis|gstatic)\.com/.test(r.url()))fontRequests.push(r.url());if(r.method()==='POST')posts.push(r.url());});
await page.addInitScript(kind=>{localStorage.setItem(kind==='admin'?'admin_access_token':'donor_access_token','synthetic-fixture');localStorage.setItem('bloodchain_locale','en');if(!sessionStorage.getItem('fixture-density-initialized')){localStorage.removeItem('bloodchain.clinical.compact');sessionStorage.setItem('fixture-density-initialized','true');}},kind);
await page.route('**/api/v1/**',async route=>{const url=new URL(route.request().url());const p=url.pathname;let data=[];const role=kind==='admin'?'SUPER_ADMIN':kind==='hospital'?'HOSPITAL_ADMIN':'BLOOD_CENTER_ADMIN';
if(p.endsWith('/auth/me'))data={id:'staff1',firstName:'Demo',lastName:'Admin',roles:[role],permissions:[],organizations:[{organizationId:'org1',name:'Demo Institution',type:kind==='center'?'BLOOD_CENTER':'HOSPITAL',role,status:'ACTIVE',organizationStatus:'ACTIVE'}]};
else if(p.endsWith('/unread-count'))data={count:0};
else if(p.includes('/admin/users'))data={data:[user],meta:{page:1,limit:20,total:1,totalPages:1}};
else if(p.endsWith('/admin/roles'))data=[{id:'role1',code:'DONOR',name:'Donor',permissions:[]}];
else if(p.includes('/admin/organizations'))data={data:[org],meta:{page:1,limit:20,total:1,totalPages:1}};
else if(p.includes('/directory/')){await route.fulfill({status:404,json:{message:'Not linked'}});return;}
else if(p.endsWith('/blood-requests')){if(failRequests){await route.fulfill({status:503,json:{message:'Fixture unavailable',statusCode:503}});return;}data=requests;}
else if(p.includes('/analytics/'))data=null;
await route.fulfill({json:{data}});});
return{page,context,errors,fontRequests,posts,setFailure:value=>{failRequests=value}};}
for(const width of [1440,1024,390]){
 const f=await setup('admin',width),page=f.page;await page.goto('http://localhost:3003/users',{waitUntil:'networkidle'});await page.getByText('demo@example.test',{exact:true}).first().waitFor();assert.equal(await page.locator('.bc-clinical.bc-compact').count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(out,`admin-users-${width}.png`),fullPage:true});
 await page.locator('table tbody tr').first().getByRole('button',{name:/view/i}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
 const footer=dialog.locator('.bc-dialog-footer');const bounds=await footer.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=page.viewportSize().height,'Modal actions must remain in viewport');
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await page.screenshot({path:path.join(out,`admin-dialog-${width}.png`)});
 await footer.getByRole('button',{name:/suspend/i}).click();await page.waitForFunction(()=>document.querySelectorAll('[role="dialog"]').length===2);await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);assert.equal(f.posts.length,0);
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 const compact=page.locator('.bc-workspace-tools button[aria-pressed]');await compact.click();assert.equal(await compact.getAttribute('aria-pressed'),'false');await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.bc-workspace-tools button[aria-pressed]').getAttribute('aria-pressed'),'false');await page.locator('.bc-workspace-tools button[aria-pressed]').click();
 await page.goto('http://localhost:3003/organizations',{waitUntil:'networkidle'});await page.getByText('Demo Institution',{exact:true}).first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,`admin-organizations-${width}.png`),fullPage:true});
 assert.deepEqual(f.errors,[]);assert.deepEqual(f.fontRequests,[]);results.push({app:'admin',width,status:'PASS',checks:['compact style','native tables','responsive filters','bounded modal actions','nested Escape','scroll restore','density persistence','no external fonts','no runtime errors']});await f.context.close();
}
for(const kind of ['hospital','center'])for(const width of [1440,390]){
 const f=await setup(kind,width),page=f.page;const port=kind==='hospital'?3000:3002;await page.goto(`http://localhost:${port}/requests`,{waitUntil:'networkidle'});await page.getByRole('link',{name:'REQ-001',exact:true}).waitFor();assert.equal(await page.locator('.bc-data-table tbody tr').count(),3);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,`${kind}-requests-${width}.png`),fullPage:true});
 f.setFailure(true);await page.reload({waitUntil:'networkidle'});const alert=page.locator('.bc-main [role="alert"]');await alert.waitFor();f.setFailure(false);await alert.getByRole('button',{name:'Try again'}).click();await page.getByRole('link',{name:'REQ-001',exact:true}).waitFor();assert.deepEqual(f.errors,[]);assert.deepEqual(f.fontRequests,[]);results.push({app:kind,width,status:'PASS',checks:['three-row request worklist','no page overflow','error distinct from empty','retry recovery','no external fonts','no runtime errors']});await f.context.close();
}
// Route smoke: exercise every staff route signed out, distinct from authenticated workflow tests above.
const root=path.resolve(__dirname,'../..');const smoke=[];
function pages(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?pages(path.join(dir,e.name)):e.name==='page.tsx'?[path.join(dir,e.name)]:[]);}
for(const [app,port]of[['admin-web',3003],['hospital-web',3000],['blood-center-web',3002]]){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();let error=[];page.on('pageerror',e=>error.push(e.message));await page.route('**/api/v1/**',route=>route.fulfill({json:{data:{count:0,data:[]}}}));
 const appdir=path.join(root,'apps',app,'app');for(const file of pages(appdir)){const route='/'+path.relative(appdir,path.dirname(file)).split(path.sep).map(part=>part.startsWith('[')?'demo-id':part).join('/');error=[];const response=await page.goto(`http://localhost:${port}${route}`,{waitUntil:'load'});await page.waitForTimeout(100);assert.equal(response.status(),200,`${app}${route}`);assert.deepEqual(error,[],`${app}${route}`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${app}${route} overflow`);smoke.push({app,route,status:'PASS',state:'signed-out'});}await context.close();
}
await browser.close();fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,smoke,mode:'Synthetic API fixtures for workflows; signed-out route smoke for route coverage. No live backend or email submission.'},null,2)+'\n');console.log(JSON.stringify({authenticatedCases:results.length,signedOutRoutes:smoke.length,status:'PASS'},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
