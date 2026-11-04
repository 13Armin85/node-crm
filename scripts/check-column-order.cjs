const assert=require('node:assert/strict'),path=require('node:path');
exports.seed=async context=>{
  await require('./check-commission-tables.cjs').seed(context);
  await require('../server/model/schema/residence').create({name:'Ordered residence',description:'Residence description',city:'Istanbul',createBy:context.actor._id});
};
exports.check=async({page,origin,artifacts,user})=>{
  const go=async route=>{console.log('Column order browser:',route);await page.goto(origin+route,{waitUntil:'networkidle2'});};
  const clickText=async(selector,text)=>page.$$eval(selector,(elements,text)=>{const item=elements.find(el=>el.textContent.trim()===text);if(!item)throw new Error('Missing '+text);item.click();},text);
  const rows=()=>page.$$eval('.crm-columns-modal [data-column-id]',elements=>elements.map(el=>({id:el.dataset.columnId,label:el.querySelector('label').textContent.trim(),checked:el.querySelector('input').checked})));
  const headers=()=>page.$$eval('table thead th:not([hidden])',elements=>elements.map(el=>el.textContent.trim()));
  const open=async()=>{await page.click('.crm-table-settings');await page.click('[role="menuitem"]');await page.waitForSelector('.crm-columns-modal [data-column-id]');};
  const arrow=async(id,index)=>{await page.$eval('.crm-columns-modal [data-column-id="'+id+'"]',(el,index)=>el.querySelectorAll('button')[index].click(),index);};
  const save=async()=>{const expected=(await rows()).filter(row=>row.checked).map(row=>row.label);await page.$eval('.crm-columns-modal .chakra-modal__footer button',el=>el.click());await page.waitForSelector('.crm-columns-modal',{hidden:true});assert.deepEqual(await headers(),expected);return expected;};
  const stored=moduleName=>page.evaluate((id,name)=>JSON.parse(localStorage.getItem('crm-table-columns:'+id+':'+name)),user._id,moduleName);
  await page.setViewport({width:1440,height:950});await go('/contacts');await page.waitForSelector('td[data-label="Budget review"]');
  assert((await headers()).includes('Lead stage'),'Contact rows show the lead stage');
  await open();let initial=await rows();assert(initial.some(row=>row.id==='state'&&row.checked));
  const before=initial.map(row=>row.id);
  await page.evaluate(async()=>{
    const source=document.querySelector('[data-column-id="fullName"] [draggable]'),target=document.querySelector('[data-column-id="email"]'),dataTransfer=new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer}));await new Promise(resolve=>requestAnimationFrame(resolve));
    target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer}));target.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer}));source.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer}));
  });
  let current=(await rows()).map(row=>row.id);assert(current.indexOf('email')<current.indexOf('fullName'));assert.notDeepEqual(current,before);
  await arrow('phoneNumber',0);await page.$eval('[data-column-id="customFields.budgetReview"] label',el=>el.click());
  const expected=await save();const preferences=await stored('Contacts');assert(preferences.hidden.includes('customFields.budgetReview')||preferences.hidden.includes('budgetReview'));
  await go('/contacts');await page.waitForSelector('.crm-record-row');assert.deepEqual(await headers(),expected);
  const geometry=await page.$$eval('table thead th',elements=>elements.map(el=>el.getBoundingClientRect().x));assert(geometry.every((x,index)=>index===0||x>geometry[index-1]),'Saved order must run physically from left to right');
  await open();assert(!(await rows()).find(row=>row.id==='customFields.budgetReview').checked);await clickText('.crm-columns-modal button','Cancel');await page.waitForSelector('.crm-columns-modal',{hidden:true});
  const added=await page.evaluate(async()=>{
    const headers={'Content-Type':'application/json',Authorization:localStorage.getItem('token')},definition=await(await fetch('/api/estate/definitions/Contacts',{headers})).json();
    definition.fields.push({name:'lateReference',kind:'CUSTOM_FIELD',type:'text',enabled:true,label:{en:'Late reference',fa:'مرجع جدید',tr:'Yeni referans'},order:definition.fields.length});
    const result=await fetch('/api/estate/definitions/Contacts',{method:'PUT',headers,body:JSON.stringify(definition)}),data=await result.json();if(result.status===200)window.dispatchEvent(new CustomEvent('crm:form-definition-changed',{detail:data}));return{status:result.status,data};
  });assert.equal(added.status,200,JSON.stringify(added));await page.waitForSelector('td[data-label="Late reference"]');
  assert.equal(await page.$eval('td[data-label="Late reference"]',el=>el.textContent.trim()),'New column value');assert.deepEqual((await headers()).slice(0,expected.length),expected);
  for(const[route,moduleName]of[['/properties','Properties'],['/residences','Residences'],['/partner-customers','Partner Customers']]){
    await go(route);await page.waitForSelector('.crm-entity-table th');await open();const first=(await rows())[0].id;await arrow(first,1);const expected=await save();await go(route);await page.waitForSelector('.crm-entity-table th');assert.deepEqual(await headers(),expected);assert((await stored(moduleName)).order.length);
  }
  await go('/opportunities');await page.waitForSelector('[data-opportunity-lead-stage]');assert(await page.$$eval('[data-opportunity-lead-stage]',elements=>elements.some(el=>el.textContent.includes('Booked'))));
  await clickText('button','Table');await page.waitForSelector('td[data-label="Lead stage"]');assert(await page.$$eval('td[data-label="Lead stage"]',elements=>elements.some(el=>el.textContent.includes('Booked'))));
  for(const[language,width,mode]of[['fa',375,'light'],['tr',320,'dark']]){
    await page.select('.crm-language-select select',language);await page.evaluate(mode=>localStorage.setItem('chakra-ui-color-mode',mode),mode);await page.setViewport({width,height:950});await go('/contacts');await page.waitForSelector('.crm-record-row');
    await open();initial=await rows();await arrow(initial[1].id,0);
    const modal=await page.$eval('.crm-columns-modal',el=>({width:el.scrollWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,bottom:el.querySelector('.chakra-modal__footer').getBoundingClientRect().bottom}));
    assert(modal.left>=0&&modal.right<=width+1&&modal.bottom<=950,'Column controls and save must fit on mobile');
    assert(!await page.$eval('.crm-columns-modal',el=>el.textContent.includes('columns.')),'Ordering controls must be translated');
    await page.screenshot({path:path.join(artifacts,'column-dialog-'+language+'.png')});await save();
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+2,{timeout:4000});
    await go('/opportunities');await page.waitForSelector('button[aria-pressed]');await page.$$eval('button[aria-pressed]',elements=>elements[0].click());await page.waitForSelector('[data-opportunity-lead-stage]');
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+2,{timeout:4000});
    await page.screenshot({path:path.join(artifacts,'opportunity-stages-'+language+'.png')});
  }
  await go('/default');await page.waitForSelector('.crm-finance-kpi .crm-currency__usd');
  console.log('PASS: drag and arrows reorder table columns left to right; hidden columns and order persist per module; new fields append; contacts show lead stages; opportunity cards and rows show stages; mobile controls and currency conversion remain usable.');
};
