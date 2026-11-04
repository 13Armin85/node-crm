const assert=require('node:assert/strict'),path=require('node:path');
let opportunityId;
exports.seed=async({actor,contacts,User})=>{
  const FormDefinition=require('../server/model/schema/formDefinition'),{defaults}=require('../server/services/formDefinitions');
  const extra={name:'budgetReview',kind:'CUSTOM_FIELD',type:'number',enabled:true,label:{en:'Budget review',fa:'بررسی بودجه',tr:'Bütçe kontrolü'},order:defaults.Contacts.length};
  await FormDefinition.create({moduleName:'Contacts',fields:[...defaults.Contacts,...[extra]]});
  await require('../server/model/schema/contact').Contact.updateMany({},{$set:{'customFields.budgetReview':0,'customFields.lateReference':'New column value'}});
  const Opportunity=require('../server/model/schema/opprtunity'),now=new Date(),ago=days=>new Date(now.getTime()-days*86400000);
  const other=await User.create({username:'rank-second',firstName:'Second',lastName:'Seller',role:'user',password:'unused-test-only'});
  const record=await Opportunity.create({opportunityName:'Commission browser opportunity',contact:contacts[0]._id,createBy:actor._id,assignUser:actor._id,opportunityAmount:100000,amount:90000,commission:1200.25,currency:'TRY',salesStage:'Qualification',leadStage:'Booked'});
  opportunityId=String(record._id);
  await Opportunity.create({opportunityName:'Won recently',createBy:actor._id,assignUser:actor._id,amount:100000,commission:700,currency:'TRY',salesStage:'Closed/Won',createdDate:ago(2),closedAt:ago(2)});
  await Opportunity.create({opportunityName:'Won five months ago',createBy:other._id,assignUser:other._id,amount:300000,commission:2000,currency:'TRY',salesStage:'Closed/Won',createdDate:ago(150),closedAt:ago(150)});
  await Opportunity.create({opportunityName:'Lost recently',createBy:actor._id,commission:300,currency:'TRY',salesStage:'Closed/Lost',createdDate:ago(2),closedAt:ago(2)});
  await Opportunity.create({opportunityName:'Won USD',createBy:actor._id,assignUser:actor._id,commission:25,currency:'USD',salesStage:'Closed/Won',createdDate:ago(2),closedAt:ago(2)});
};
exports.check=async({page,origin,artifacts,contacts})=>{
  const go=async route=>{console.log('Commission/table browser:',route);await page.goto(origin+route,{waitUntil:'networkidle2'});};
  const clickText=async(selector,text)=>page.$$eval(selector,(elements,text)=>{const element=elements.find(item=>item.textContent.trim()===text);if(!element)throw new Error('Missing button '+text);element.click();},text);
  const fill=async(selector,value)=>{await page.focus(selector);await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await page.type(selector,String(value));};
  await go('/contacts');await page.waitForSelector('.crm-record-row');
  await page.waitForFunction(()=>[...document.querySelectorAll('th')].some(item=>item.textContent.includes('Budget review')));
  const zero=await page.$eval('.crm-record-row td[data-label="Budget review"]',item=>item.textContent.trim());assert.equal(zero,'0');
  const added=await page.evaluate(async()=>{
    const headers={'Content-Type':'application/json',Authorization:localStorage.getItem('token')};
    const definition=await(await fetch('/api/estate/definitions/Contacts',{headers})).json();
    definition.fields.push({name:'lateReference',type:'text',kind:'CUSTOM_FIELD',enabled:true,label:{en:'Late reference',fa:'مرجع جدید',tr:'Yeni referans'},order:definition.fields.length});
    const response=await fetch('/api/estate/definitions/Contacts',{method:'PUT',headers,body:JSON.stringify(definition)});const data=await response.json();
    if(response.status===200)window.dispatchEvent(new CustomEvent('crm:form-definition-changed',{detail:data}));return{status:response.status,data};
  });assert.equal(added.status,200,JSON.stringify(added));
  await page.waitForSelector('td[data-label="Late reference"]');assert.equal(await page.$eval('td[data-label="Late reference"]',item=>item.textContent.trim()),'New column value');
  await page.click('.crm-table-settings');await clickText('[role="menuitem"]','Manage Columns');await page.waitForSelector('.crm-columns-modal');
  await page.$$eval('.crm-columns-modal label',labels=>{for(const text of ['Budget review','#'])labels.find(item=>item.textContent.trim()===text).click();});
  await clickText('.crm-columns-modal button','Save');await go('/contacts');
  assert.equal(await page.$('th[data-label="Budget review"]'),null);
  assert.equal(await page.$('td[data-label="Budget review"]'),null);assert(await page.$('td[data-label="Late reference"]'));
  const firstRow=await page.$('.crm-record-row'),firstContactUrl=await firstRow.$eval('a[href^="/contactView/"]',item=>item.getAttribute('href'));
  await firstRow.$eval('button[aria-haspopup="menu"]',item=>item.click());await clickText('[role="menuitem"]','View');await page.waitForFunction(url=>location.pathname===url,{},firstContactUrl);
  await go('/contacts');
  const link=await page.$('.crm-record-row a[href^="/contactView/"]'),url=await link.evaluate(item=>item.getAttribute('href'));await link.click();await page.waitForFunction(url=>location.pathname===url,{},url);
  await go('/opportunities');await page.waitForSelector('.crm-opportunity-card');
  const card=()=>page.$$('.crm-opportunity-card').then(async cards=>{for(const item of cards)if((await item.evaluate(el=>el.textContent)).includes('Commission browser opportunity'))return item;throw new Error('Opportunity card missing');});
  let content=await(await card()).evaluate(item=>item.textContent);assert(content.includes('Booked')&&content.includes('21%')&&content.includes('Commission'));
  assert(await(await card()).$('a[href="/contactView/'+contacts[0]._id+'"]'));
  const stages=await(await card()).$('select'),saved=page.waitForResponse(r=>r.url().includes('/api/opportunity/stage/'+opportunityId)&&r.request().method()==='PUT');await stages.select('Closed/Won');assert.equal((await saved).status(),200);
  await page.waitForFunction(()=>[...document.querySelectorAll('.crm-opportunity-card')].some(item=>item.textContent.includes('Commission browser opportunity')&&item.textContent.includes('100%')));
  await clickText('button','Table');await page.waitForSelector('td[data-label="Commission"]');
  const row=await page.$$('.crm-record-row').then(async rows=>{for(const item of rows)if((await item.evaluate(el=>el.textContent)).includes('Commission browser opportunity'))return item;throw new Error('Opportunity row missing');});
  content=await row.evaluate(item=>item.textContent);assert(content.includes('Booked')&&content.includes('100%'));
  assert(await row.$('a[href="/contactView/'+contacts[0]._id+'"]'));
  await clickText('button','Add New');await page.waitForSelector('input[name="commission"]');
  for(const [name,value]of Object.entries({opportunityName:'Added three amount browser',opportunityAmount:100000,amount:93000,commission:950.75}))await fill('input[name="'+name+'"]',value);
  assert.equal(await page.$eval('input[name="probability"]',item=>item.readOnly),true);
  await page.select('select[name="salesStage"]','Negotiation/Review');await page.waitForFunction(()=>document.querySelector('input[name="probability"]').value==='90');
  const created=page.waitForResponse(r=>r.url().endsWith('/api/opportunity/add')&&r.request().method()==='POST');await clickText('.chakra-modal__content button','Save');const response=await created,result=await response.json();assert.equal(response.status(),200,JSON.stringify(result));assert.equal(result.commission,950.75);assert.equal(Number(result.amount),93000);assert.equal(Number(result.opportunityAmount),100000);
  for(const[language,width]of[['en',1440],['fa',375],['tr',320]]){
    await go('/default');await page.select('.crm-language-select select',language);await page.setViewport({width,height:950});
    await page.waitForSelector('[data-finance-bucket="sold"]');
    const labels={en:['Income period','Ranking period','Company income'],fa:['بازه درآمد','بازه رتبه‌بندی','درآمد شرکت'],tr:['Gelir dönemi','Sıralama dönemi','Şirket geliri']}[language];
    await page.select('select[aria-label="'+labels[0]+'"]','week');await page.waitForFunction(()=>!!document.querySelector('[data-finance-bucket="sold"]'));
    assert((await page.$eval('[data-finance-bucket="sold"]',item=>item.textContent)).includes(labels[2]));
    await page.select('select[aria-label="'+labels[1]+'"]','6');await page.waitForFunction(()=>document.querySelector('.crm-team-sales-table tbody tr')?.textContent.includes('Second Seller'));
    await page.select('select[aria-label="'+labels[1]+'"]','3');await page.waitForFunction(()=>document.querySelector('.crm-team-sales-table tbody tr')?.textContent.includes('Workspace Reviewer'));
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+2,{timeout:4000});
    assert(!await page.evaluate(()=>document.body.textContent.includes('finance.')),'All finance labels must be translated');
    await page.screenshot({path:path.join(artifacts,'commission-dashboard-'+language+'.png')});
  }
  await (await page.$$('.crm-sales-performance select'))[1].select('USD');
  await page.waitForFunction(()=>document.querySelector('[data-finance-bucket="sold"]')?.textContent.includes('25'));
  await page.setViewport({width:375,height:950});await go('/opportunities');await page.waitForSelector('.crm-record-row');await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+2,{timeout:4000});
  await page.screenshot({path:path.join(artifacts,'opportunity-table-mobile.png')});
  for(const route of ['/properties','/residences','/partner-customers','/lead','/task','/metting','/phone-call','/email','/invoices','/email-template','/user']){
    await go(route);await page.waitForSelector('.crm-content');await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+2,{timeout:4000});
  }
  console.log('PASS: new form input auto-adds a value column, hidden columns persist, contact links navigate, three prices save, stage probability updates, commission dashboard filters/ranking/localization work on desktop and mobile.');
};
