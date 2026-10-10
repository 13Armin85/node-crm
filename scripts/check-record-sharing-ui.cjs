// Exercise actual browser downloads against isolated fixtures; never access live records.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const puppeteer=require('../server/node_modules/puppeteer'),ExcelJS=require('../client/node_modules/exceljs');
async function main(){
 let activeRole='developer', grantedModules=['Contacts','Leads','Opportunities','Invoices','Meetings','Calls','Emails','Documents','Partner Customers','Tasks'];
 const shares=new Map(), sends=[];
 const hidden=['Leads','Contacts','Partner Customers','Tasks','Opportunities','Invoices','Meetings','Calls','Emails','Documents','Reporting and Analytics'];
 const root=path.resolve(process.env.CRM_BUILD_ROOT||path.join(__dirname,'../layout-artifacts/excel-build'));
 assert(fs.existsSync(path.join(root,'index.html')),'Build the client first');
 const artifacts=path.resolve(__dirname,'../layout-artifacts'),downloads=path.join(artifacts,'excel-downloads-'+Date.now());fs.mkdirSync(downloads,{recursive:true});
 const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'');
  let file=path.resolve(root,relative||'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
  res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,pipe:true});
  const page=await browser.newPage(),errors=[],calls=[];page.on('pageerror',error=>errors.push(error.message));
  const cdp=await browser.target().createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloads});
  const user={_id:'000000000000000000000001',role:'developer',firstName:'UI',lastName:'Tester',username:'ui@example.test'};
  const people=[{_id:'000000000000000000000002',firstName:'علی',lastName:'کریمی',username:'ali@example.test',role:'user'},{_id:'000000000000000000000003',firstName:'İpek',lastName:'Yılmaz',username:'ipek@example.test',role:'user'}];
  const records=people.map((p,i)=>({...p,_id:'10000000000000000000000'+i,leadName:p.firstName+' '+p.lastName,title:'Task '+i,name:p.firstName,fullName:p.firstName+' '+p.lastName,subject:'Subject '+i,agenda:'Agenda '+i,opportunityName:'Opportunity '+i,invoiceNumber:'INV-'+i,senderName:p.firstName,createBy:user._id,assignedToUser:p._id,assignedToUserName:p.firstName+' '+p.lastName,status:'todo',priority:'normal',category:'None',leadStatus:'active',emailsent:2,outboundcall:1,textsent:0,tasks:2,completedTasks:1,createdDate:'2026-10-01T12:00:00.000Z'}));
  const properties=Array.from({length:205},(_,i)=>({_id:(i+100).toString(16).padStart(24,'0'),title:'Property '+i,fullName:'Customer '+i,name:'Residence '+i,price:{amount:1234+i,currency:'TRY'},createdDate:'2026-10-01T12:00:00.000Z'}));
  await page.setRequestInterception(true);page.on('request',req=>{
   const url=new URL(req.url()),p=decodeURIComponent(url.pathname).replace(/\/$/,'');
   if(!p.startsWith('/api/')){req.continue().catch(()=>{});return;}calls.push(url.pathname+url.search);let data=[], status=200;
   if(p==='/api/visibility/me')data={visibility:Object.fromEntries(hidden.map(name=>[name,false])),accessibleModules:activeRole==='user'?grantedModules:[]};
   if(p==='/api/visibility')data={users:people.map(person=>({...person,moduleVisibility:Object.fromEntries(hidden.map(name=>[name,false]))})),modules:[...hidden,'Dashboard','Properties']};
   if(p==='/api/record-sharing/users')data=people;
   if(p.startsWith('/api/record-sharing/')&&!p.endsWith('/users'))data=shares.get(p)||[];
   if(p==='/api/record-sharing'&&req.method()==='POST'){
    const body=JSON.parse(req.postData());sends.push(body);const key='/api/record-sharing/'+body.module+'/'+body.recordId;
    shares.set(key,[{user:people.find(person=>person._id===body.recipientId)}]);status=201;data={shared:true,created:true};
   }
   if(['/api/task','/api/lead','/api/contact','/api/invoices','/api/opportunity','/api/meeting','/api/phoneCall','/api/email','/api/email-temp','/api/reporting'].includes(p))data=records.map((record,index)=>({...record,_receivedFromAdmin:activeRole==='user'&&index===1}));
   if(p==='/api/task/assignees')data=people;
   if(p==='/api/task')data=records.map((record,index)=>({...record,createBy:user._id,assignedToUser:index===0?user._id:record.assignedToUser}));
   if(p.startsWith('/api/task/view/'))data={...records[0],createBy:user._id,assignedToUser:user._id};
   if(p==='/api/user')data={user:people};
   if(p==='/api/notification')data={notifications:[],unreadCount:0,hasMore:false};
   if(p==='/api/custom-field'){const name=url.searchParams.get('moduleName')==='Leads'?'leadName':'firstName';data=[{_id:'300000000000000000000001',fields:[{name,label:'Name',type:'text',isTableField:true,isView:true}]}];}
   if(p.startsWith('/api/estate/definitions/')){const moduleName=p.split('/').pop();data={moduleName,fields:[{name:moduleName==='Properties'?'title':moduleName==='Residences'?'name':'fullName',label:{en:'Name',fa:'نام',tr:'Ad'},type:'text',enabled:true},{name:'price.amount',label:{en:'Amount',fa:'مبلغ',tr:'Tutar'},type:'currency',enabled:true}]};}
   if(['/api/estate/Properties','/api/estate/Partner Customers','/api/estate/Residences'].includes(p)){
    const source=activeRole==='user'&&p==='/api/estate/Partner Customers'?properties.slice(0,2).map((record,index)=>({...record,_receivedFromAdmin:index===1})):properties;
    const all=url.searchParams.get('q')?source.filter(r=>(r.title+' '+r.name+' '+r.fullName).includes(url.searchParams.get('q'))):source;
    const limit=Number(url.searchParams.get('limit')||20),start=(Number(url.searchParams.get('page')||1)-1)*limit;data={items:all.slice(start,start+limit),total:all.length};
   }
   if(p==='/api/document')data=[{_id:'400000000000000000000001',isRoot:true,files:[{_id:'400000000000000000000002',fileName:'قرارداد İpek.pdf',_receivedFromAdmin:activeRole==='user',mimeType:'application/pdf',size:2048,category:'GENERAL',createdAt:'2026-10-01T12:00:00.000Z'}]}];
   if(p==='/api/calendar')data=[{id:'calendar1',title:'جلسه İpek',start:'2026-10-09T10:00:00',end:'2026-10-09T11:00:00',groupId:'meeting',allDay:false}];
   if(p==='/api/reporting/line-chart')data=[{name:'Tasks',length:2},{name:'Leads',length:2},{name:'Properties',length:205}];
   if(p==='/api/reporting/index')data={Email:[{Emails:[{date:'2026-10-01',Emailcount:2}]}],Call:[{Calls:[{date:'2026-10-01',Callcount:1}]}]};
   if(p==='/api/status')data={data:{leadData:records,taskData:records}};
   if(p==='/api/estate/dashboard/sales-summary')data={sold:{count:2,values:[{currency:'TRY',amount:5000}]},available:{count:3,values:[{currency:'USD',amount:2000}]},bySeller:[{_id:people[0]._id,name:'علی کریمی',soldCount:2,values:[{currency:'TRY',amount:5000}]}]};
   req.respond({status,contentType:'application/json',body:JSON.stringify(data)}).catch(()=>{});
  });
  const origin='http://127.0.0.1:'+server.address().port;await page.setViewport({width:1440,height:1000});
  await page.goto(origin+'/auth',{waitUntil:'networkidle0'});
  const token=Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
  await page.evaluate((user,token)=>{localStorage.setItem('user',JSON.stringify(user));localStorage.setItem('token',token);localStorage.setItem('crm-language','en');},user,token);
  const download=async(index=0)=>{
   await page.waitForFunction(i=>{const b=document.querySelectorAll('.crm-excel-export')[i];return b&&!b.disabled;},{timeout:15000},index);
   const before=new Set(fs.readdirSync(downloads));await page.$$eval('.crm-excel-export',(buttons,i)=>buttons[i].click(),index);
   let file;for(let n=0;n<200;n++){file=fs.readdirSync(downloads).find(f=>!before.has(f)&&!f.endsWith('.crdownload'));if(file)break;await new Promise(r=>setTimeout(r,100));}
   assert(file,'Excel download missing');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(fs.readFileSync(path.join(downloads,file)));
   assert(workbook.worksheets.length>0);assert(workbook.worksheets[0].rowCount>1,'Empty workbook');return workbook;
  };
  const goto=route=>page.goto(origin+route,{waitUntil:'networkidle0'});

  const matrix=[['/contacts','Contacts'],['/lead','Leads'],['/opportunities','Opportunities'],['/invoices','Invoices'],['/metting','Meetings'],['/phone-call','Calls'],['/email','Emails'],['/documents','Documents'],['/partner-customers','Partner Customers']];
  const setSession=async(role,language='en')=>{
   activeRole=role;
   await page.evaluate((user,role,language)=>{localStorage.setItem('user',JSON.stringify({...user,role}));localStorage.setItem('crm-language',language);},user,role,language);
  };
  const clickText=async(selector,text)=>page.$$eval(selector,(nodes,text)=>{const node=nodes.find(item=>item.textContent.trim()===text);if(!node)throw Error('Missing '+text);node.click();},text);

  if(process.env.CRM_TASK_READONLY_FOCUSED==='1'){
   for(const [role,language] of [['user','en'],['user','fa'],['user','tr'],['admin','en'],['developer','en']]){
    await setSession(role,language);await goto('/task');await page.waitForSelector('.crm-kanban-card');
    const newLabel=({en:'New Task',fa:'وظیفه جدید',tr:'Yeni Görev'})[language];
    const hasCreate=await page.$$eval('button',(nodes,label)=>nodes.some(node=>node.textContent.trim()===label),newLabel);
    assert.equal(hasCreate,role!=='user',role+' new task: '+language);
    const handles=await page.$$eval('.crm-kanban-card',nodes=>nodes.filter(node=>node.hasAttribute('data-rbd-drag-handle-draggable-id')).length);
    assert.equal(handles>0,role!=='user',role+' dragging: '+language);
    if(role==='user'){
     assert(await page.$('.crm-task-searchbar input'),'Task search remains available');
     if(language==='en') await download();
     await clickText('button',({en:'List',fa:'لیست',tr:'Liste'})[language]);await page.waitForSelector('[data-task-select="status"]');
     assert(await page.$$eval('[data-task-select="status"]',nodes=>nodes.every(node=>node.disabled)),language+' status editing');
     await page.$eval('tbody button[aria-haspopup="menu"]',node=>node.click());await page.waitForSelector('[role="menuitem"]');
     const actions=await page.$$eval('[role="menuitem"]',nodes=>nodes.map(node=>node.textContent.trim()));
     assert.deepEqual(actions,[({en:'View',fa:'نمایش',tr:'Görüntüle'})[language]],language+' task row actions');
     await page.keyboard.press('Escape');
     await goto('/view/'+records[0]._id);await page.waitForFunction(()=>document.body.innerText.includes('Task 0'));
     await page.screenshot({path:path.join(artifacts,'task-readonly-'+language+'.png')});
    }else{
     await clickText('button',newLabel);await page.waitForSelector('[role="dialog"]');await page.keyboard.press('Escape');
    }
    console.log('PASS '+role+' task permissions: '+language);
   }
   await setSession('user','en');await goto('/calender');await page.waitForSelector('.fc-daygrid-day');await page.$eval('.fc-daygrid-day',node=>node.click());
   assert.equal(await page.$$eval('[role="dialog"]',nodes=>nodes.length),0,'Ordinary calendar must not open task creation');
   await goto('/lead');assert(await page.$$eval('button',nodes=>nodes.some(node=>node.textContent.trim()==='Add New')),'Other modules retain data entry');
   assert.deepEqual(errors,[],'Browser runtime errors');
   console.log('PASS task read-only UI, disabled drag/status changes, retained view/search/export and administrative creation');
   return;
  }
  for(const [route,module] of matrix){
   console.log('CHECK '+route);await goto(route);await page.waitForSelector('.crm-share-record-button');
   if(!['Documents','Partner Customers'].includes(module)){
    assert.equal(await page.$$eval('.crm-excel-export',nodes=>nodes.length),0,route+' standalone Excel');
    await page.click('.crm-table-settings');await page.waitForSelector('[role="menuitem"]');
    assert(await page.$$eval('[role="menuitem"]',nodes=>nodes.some(node=>node.textContent.includes('Excel'))),route+' Excel menu missing');
    await page.keyboard.press('Escape');
   }
   await page.$eval('.crm-share-record-button',node=>node.click());
   try{await page.waitForSelector('.crm-share-record-modal select');}catch(error){await page.screenshot({path:path.join(artifacts,'sharing-modal-failure.png')});console.error(await page.evaluate(()=>document.body.innerText.slice(-1500)));throw error;}
   await page.select('.crm-share-record-modal select',people[1]._id);await clickText('.crm-share-record-modal button','Send');
   await page.waitForFunction(()=>document.querySelector('.crm-share-record-modal')?.textContent.includes('This item has already been sent'));
   assert.equal(sends.at(-1).module,module);assert.equal(sends.at(-1).recipientId,people[1]._id);
   assert.equal(sends.at(-1).recordId,module==='Documents'?'400000000000000000000002':module==='Partner Customers'?properties[0]._id:records[0]._id);
   await clickText('.crm-share-record-modal button','Close');console.log('PASS admin sends single '+module);
  }
  for(const route of ['/default','/reporting-analytics','/email-template','/user']){
   await goto(route);assert.equal(await page.$$eval('.crm-excel-export',nodes=>nodes.length),0,route+' standalone Excel remains');
   if(route!=='/default'){await page.click('.crm-table-settings');await page.waitForSelector('[role="menuitem"]');assert(await page.$$eval('[role="menuitem"]',nodes=>nodes.some(node=>node.textContent.includes('Excel'))));await page.keyboard.press('Escape');}
  }
  await goto('/lead');await page.click('.crm-table-settings');const before=new Set(fs.readdirSync(downloads));
  await clickText('[role="menuitem"]','Export as Excel');
  let excel;for(let n=0;n<150;n++){excel=fs.readdirSync(downloads).find(file=>!before.has(file)&&!file.endsWith('.crdownload'));if(excel)break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert(excel,'Menu Excel download missing');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(fs.readFileSync(path.join(downloads,excel)));assert.equal(workbook.worksheets[0].rowCount,3);
  console.log('PASS Excel remains functional inside the column menu');
  await goto('/data-visibility');await page.waitForSelector('#visibility-user');await page.select('#visibility-user',people[0]._id);
  const controls=await page.$$eval('.crm-data-visibility input[type="checkbox"]',nodes=>nodes.map(node=>({label:node.getAttribute('aria-label'),checked:node.checked})));
  assert.equal(controls.filter(item=>!item.checked).length,11);assert.equal(controls.filter(item=>item.checked).length,2);
  console.log('PASS eleven user sections are switched off by default');
  for(const language of ['en','fa','tr']){
   await setSession('user',language);
   for(const [route,module] of matrix){
    await goto(route);await page.waitForSelector('.crm-received-record-label');
    assert.equal(await page.$$eval('.crm-share-record-button',nodes=>nodes.length),0,route+' ordinary send action');
    const labels=await page.$$eval('.crm-received-record-label',nodes=>nodes.map(node=>({text:node.textContent,size:getComputedStyle(node).fontSize})));
    assert(labels.every(item=>item.text===({en:'Received from admin',fa:'دریافت شده توسط ادمین',tr:'Yöneticiden alındı'})[language]));
    assert(labels.every(item=>(process.env.CRM_BADGE_PREFLIGHT ? parseFloat(item.size)<=12 : item.size==='10px')),route+' badge too large');
    const addLabel=module==='Documents'?({en:'Upload document',fa:'بارگذاری سند',tr:'Belge yükle'})[language]:({en:'Add New',fa:'افزودن جدید',tr:'Yeni Ekle'})[language];
    assert(await page.$$eval('button',(nodes,label)=>nodes.some(node=>node.textContent.trim()===label&&!node.disabled),addLabel),route+' creation unavailable: '+language);
   }
   await goto('/lead');await page.screenshot({path:path.join(artifacts,'received-leads-'+language+'.png')});
   console.log('PASS ordinary own/sent page labels and no send actions: '+language);
  }
  grantedModules=[];await goto('/default');
  const paths=await page.$$eval('#crm-sidebar nav a',nodes=>nodes.map(node=>node.getAttribute('href')));
  for(const [route] of matrix)assert(paths.includes(route),'Missing tab with no own/sent items: '+route);
  assert(paths.includes('/task'));assert(paths.includes('/reporting-analytics'));
  grantedModules=['Leads'];await goto('/lead');await page.waitForSelector('.crm-received-record-label');
  assert(await page.$('#crm-sidebar nav a[href="/lead"]'));assert(await page.$('#crm-sidebar nav a[href="/contacts"]'));
  await setSession('user','en');await goto('/task');assert(!await page.$eval('button',nodes=>nodes.some(node=>node.textContent.trim()==='New Task')),'Ordinary tasks must stay read-only');
  await goto('/documents');await clickText('button','Upload document');await page.waitForSelector('[role="dialog"]');await page.keyboard.press('Escape');
  console.log('PASS all tabs and data-entry actions remain available with general data disabled');
  const logo=await page.$eval('.crm-sidebar-brand__mark',node=>({background:getComputedStyle(node).backgroundColor,border:getComputedStyle(node).borderWidth,shadow:getComputedStyle(node).boxShadow,src:node.querySelector('img').getAttribute('src')}));
  assert.equal(logo.background,'rgba(0, 0, 0, 0)');assert.equal(logo.border,'0px');assert.equal(logo.shadow,'none');assert(logo.src.includes('brand-logo-transparent.png'));
  assert.deepEqual(errors,[],'Browser runtime errors');
  console.log('PASS always-available tabs, data-entry actions, transparent logo, sharing, badges and Excel rules in the production build');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
