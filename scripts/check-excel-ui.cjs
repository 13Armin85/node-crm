// Exercise actual browser downloads against isolated fixtures; never access live records.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const puppeteer=require('../server/node_modules/puppeteer'),ExcelJS=require('../client/node_modules/exceljs');
async function main(){
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
   if(!p.startsWith('/api/')){req.continue().catch(()=>{});return;}calls.push(url.pathname+url.search);let data=[];
   if(['/api/task','/api/lead','/api/contact','/api/invoices','/api/opportunity','/api/meeting','/api/phoneCall','/api/email','/api/email-temp','/api/reporting'].includes(p))data=records;
   if(p==='/api/task/assignees')data=people;
   if(p==='/api/user')data={user:people};
   if(p==='/api/notification')data={notifications:[],unreadCount:0,hasMore:false};
   if(p==='/api/custom-field'){const name=url.searchParams.get('moduleName')==='Leads'?'leadName':'firstName';data=[{_id:'300000000000000000000001',fields:[{name,label:'Name',type:'text',isTableField:true,isView:true}]}];}
   if(p.startsWith('/api/estate/definitions/')){const moduleName=p.split('/').pop();data={moduleName,fields:[{name:moduleName==='Properties'?'title':moduleName==='Residences'?'name':'fullName',label:{en:'Name',fa:'نام',tr:'Ad'},type:'text',enabled:true},{name:'price.amount',label:{en:'Amount',fa:'مبلغ',tr:'Tutar'},type:'currency',enabled:true}]};}
   if(['/api/estate/Properties','/api/estate/Partner Customers','/api/estate/Residences'].includes(p)){
    const all=url.searchParams.get('q')?properties.filter(r=>(r.title+' '+r.name+' '+r.fullName).includes(url.searchParams.get('q'))):properties;
    const limit=Number(url.searchParams.get('limit')||20),start=(Number(url.searchParams.get('page')||1)-1)*limit;data={items:all.slice(start,start+limit),total:all.length};
   }
   if(p==='/api/document')data=[{_id:'400000000000000000000001',isRoot:true,files:[{_id:'400000000000000000000002',fileName:'قرارداد İpek.pdf',mimeType:'application/pdf',size:2048,category:'GENERAL',createdAt:'2026-10-01T12:00:00.000Z'}]}];
   if(p==='/api/calendar')data=[{id:'calendar1',title:'جلسه İpek',start:'2026-10-09T10:00:00',end:'2026-10-09T11:00:00',groupId:'meeting',allDay:false}];
   if(p==='/api/reporting/line-chart')data=[{name:'Tasks',length:2},{name:'Leads',length:2},{name:'Properties',length:205}];
   if(p==='/api/reporting/index')data={Email:[{Emails:[{date:'2026-10-01',Emailcount:2}]}],Call:[{Calls:[{date:'2026-10-01',Callcount:1}]}]};
   if(p==='/api/status')data={data:{leadData:records,taskData:records}};
   if(p==='/api/estate/dashboard/sales-summary')data={sold:{count:2,values:[{currency:'TRY',amount:5000}]},available:{count:3,values:[{currency:'USD',amount:2000}]},bySeller:[{_id:people[0]._id,name:'علی کریمی',soldCount:2,values:[{currency:'TRY',amount:5000}]}]};
   req.respond({status:200,contentType:'application/json',body:JSON.stringify(data)}).catch(()=>{});
  });
  const origin='http://127.0.0.1:'+server.address().port;await page.setViewport({width:1440,height:1000});
  await page.goto(origin+'/auth',{waitUntil:'networkidle0'});
  const token=Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
  await page.evaluate((user,token)=>{localStorage.setItem('user',JSON.stringify(user));localStorage.setItem('token',token);localStorage.setItem('crm-language','en');},user,token);
  const download=async(index=0)=>{
   const before=new Set(fs.readdirSync(downloads));
   if(await page.$('.crm-excel-export')) {
    await page.waitForFunction(i=>{const b=document.querySelectorAll('.crm-excel-export')[i];return b&&!b.disabled;},{timeout:15000},index);
    await page.$$eval('.crm-excel-export',(buttons,i)=>buttons[i].click(),index);
   }else{
    await page.click('.crm-table-settings');await page.waitForSelector('[role="menuitem"]');
    await page.$$eval('[role="menuitem"]',nodes=>{const item=nodes.find(node=>/Excel|اکسل/i.test(node.textContent));if(!item)throw Error('Excel menu option missing');item.click();});
   }
   let file;for(let n=0;n<200;n++){file=fs.readdirSync(downloads).find(f=>!before.has(f)&&!f.endsWith('.crdownload'));if(file)break;await new Promise(r=>setTimeout(r,100));}
   assert(file,'Excel download missing');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(fs.readFileSync(path.join(downloads,file)));
   assert(workbook.worksheets.length>0);assert(workbook.worksheets[0].rowCount>1,'Empty workbook');return workbook;
  };
  const goto=route=>page.goto(origin+route,{waitUntil:'networkidle0'});
  for(const route of (process.env.CRM_EXCEL_FOCUSED ? [] : ['/lead','/contacts','/invoices','/opportunities','/task','/metting','/phone-call','/email','/email-template','/user','/documents','/calender','/reporting-analytics','/properties','/partner-customers','/residences'])){
   await goto(route);const workbook=await download();
   if(['/properties','/partner-customers','/residences'].includes(route))assert.equal(workbook.worksheets[0].rowCount,206,'Export must include all 205 records: '+route);
   
   console.log('PASS: '+route+' / '+workbook.worksheets.length+' sheet(s), '+workbook.worksheets[0].rowCount+' rows');
  }
  if(!process.env.CRM_EXCEL_FOCUSED){
  await goto('/properties');const input=await page.$('input');assert(input,'Property search missing');
  await input.type('Property 204');await page.waitForFunction(()=>[...document.querySelectorAll('tbody tr')].length===1);
  const filtered=await download();assert.equal(filtered.worksheets[0].rowCount,2);assert.equal(filtered.worksheets[0].getCell('A2').value,'Property 204');
  assert(calls.some(url=>url.includes('limit=100')&&url.includes('page=3')),'Paginated export did not fetch page 3');
  await goto('/reporting-analytics');assert.equal(await page.$eval('.crm-excel-export',buttons=>buttons.length),0);await download();
  await goto('/default');assert.equal(await page.$eval('.crm-excel-export',buttons=>buttons.length),0);
  }
  for(const [language,width] of [['fa',1440],['tr',390],['fa',390]]){
   await page.setViewport({width,height:1000});await page.evaluate(language=>localStorage.setItem('crm-language',language),language);await goto('/task');
   const workbook=await download();assert.equal(workbook.worksheets[0].views[0].rightToLeft,language==='fa');
   const text=workbook.worksheets[0].getSheetValues().flat(2).join(' ');assert(text.includes('علی کریمی')&&text.includes('İpek Yılmaz'),'Multilingual names changed');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Task page overflows: '+language);
   await page.screenshot({path:path.join(artifacts,'excel-task-'+language+'-'+width+'.png')});
   await page.$$eval('.crm-task-page-hero button',buttons=>buttons[1].click());
   await page.waitForSelector('tbody tr .selectOpt');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Task list overflows: '+language);
   await page.$eval('.crm-task-searchbar input',input=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'IPEK YILMAZ');input.dispatchEvent(new Event('input',{bubbles:true}));});
   await page.waitForFunction(()=>document.querySelectorAll('tbody tr:has(.selectOpt)').length===1);
   const listWorkbook=await download();assert.equal(listWorkbook.worksheets[0].rowCount,2,'List export must respect name search');
   assert(listWorkbook.worksheets[0].getSheetValues().flat(2).join(' ').includes('İpek Yılmaz'),'Wrong task list name');
   await page.screenshot({path:path.join(artifacts,'excel-list-'+language+'-'+width+'.png')});

  }
  assert.deepEqual(errors,[],'Browser runtime errors');console.log('PASS: all important pages download valid workbooks; full pagination, filters, menu export, Persian/Turkish names and mobile layout.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
