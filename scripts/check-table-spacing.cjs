const assert=require('node:assert/strict'),path=require('node:path');
exports.seed=async({actor,contacts,property})=>{
  const {defaults}=require('../server/services/formDefinitions'),Definition=require('../server/model/schema/formDefinition');
  const extras=Array.from({length:18},(_,index)=>({name:'denseText'+index,kind:'CUSTOM_FIELD',type:'text',enabled:true,order:100+index,label:{en:`Field ${index} · Detailed customer requirements and property preferences`,fa:`فیلد ${index} · جزئیات کامل درخواست مشتری و مشخصات ملک`,tr:`Alan ${index} · Müşterinin ayrıntılı talebi ve gayrimenkul tercihleri`}}));
  const values=Object.fromEntries(extras.map((field,index)=>[field.name,index===0?'https://example.test/'+('UnbrokenPropertyReference'.repeat(8)):index===1?'Complete first line\nComplete second line\nComplete third line\nComplete fourth line':index===2?'Adjacent field must stay separate':('Complete property requirements and follow-up details. ').repeat(3)]));
  for(const name of ['Contacts','Properties','Residences','Opportunities'])await Definition.create({moduleName:name,fields:[...defaults[name],...extras]});
  const Contact=require('../server/model/schema/contact').Contact;
  await Contact.updateMany({},{$set:{customFields:values,message:('All customer requirements must remain visible. ').repeat(8)}});
  for(let index=15;index<=28;index++)await Contact.create({fullName:'Customer '+index+' '+('LongUnbrokenCustomerName'.repeat(6)),email:'customer'+index+'@example.test',phoneNumber:'905551000'+index,customFields:values,createBy:actor._id,createdDate:new Date()});
  const {Property}=require('../server/model/schema/property');await Property.updateOne({_id:property._id},{$set:{customFields:values,description:('Detailed property description. ').repeat(10),price:{amount:1234567890123.45,currency:'TRY'}}});
  const Residence=require('../server/model/schema/residence'),Opportunity=require('../server/model/schema/opprtunity');
  for(let index=0;index<24;index++){
    await Residence.create({name:'Residence '+index+' '+('LongUnbrokenResidenceName'.repeat(5)),description:('Residence details. ').repeat(10),city:'Istanbul',customFields:values,createBy:actor._id});
    await Opportunity.create({opportunityName:'Opportunity '+index+' '+('LongUnbrokenOpportunityName'.repeat(5)),description:('Opportunity requirements. ').repeat(8),contact:contacts[0]._id,commission:1234567890123.45,amount:'19999999999999.99',opportunityAmount:'29999999999999.99',currency:'TRY',leadStage:'Booked',salesStage:'Qualification',customFields:values,createBy:actor._id});
  }
};
exports.check=async({page,origin,artifacts})=>{
  const fs=require('node:fs'),preview=process.env.CRM_CHECK_DENSITY_CSS_PREVIEW==='1';
  const measurements=[];
  const go=async route=>{console.log('Dense table browser:',route);await page.goto(origin+route,{waitUntil:'networkidle2'});if(preview)await page.addStyleTag({path:path.resolve(__dirname,'../client/src/assets/css/CompactWorkspace.css')});};
  const inspect=async(route,width)=>{
    await page.waitForSelector('td[data-label*="17"]');
    const measurement=await page.evaluate(()=>{
      const table=document.querySelector('table.crm-mobile-records'),scroll=table.closest('.crm-records-scroll'),mobile=innerWidth<768;
      const errors=[];
      const cells=[...table.querySelectorAll(mobile?'tbody td:not([hidden])':'thead th:not([hidden]), tbody td:not([hidden])')].filter(cell=>cell.getAttribute('data-mobile-role')!=='index');
      for(const cell of cells){
        const bounds=cell.getBoundingClientRect();
        const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()){
          const node=walker.currentNode;if(!node.textContent.trim()||node.parentElement.closest('script,style,[aria-hidden="true"]'))continue;
          const range=document.createRange();range.selectNodeContents(node);
          for(const rect of range.getClientRects())if(rect.width&&rect.height&&(rect.left<bounds.left-2||rect.right>bounds.right+2||rect.top<bounds.top-2||rect.bottom>bounds.bottom+2))errors.push({label:cell.dataset.label,text:node.textContent.slice(0,45),cell:{left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom},textRect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom}});
        }
      }
      const firstRow=table.querySelector('.crm-record-row'),rowHeight=firstRow.getBoundingClientRect().height;
      const headerRects=[...table.querySelectorAll('thead th:not([hidden])')].map(el=>({label:el.textContent.trim(),width:el.getBoundingClientRect().width}));
      return{mobile,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,scrollWidth:scroll.scrollWidth,clientWidth:scroll.clientWidth,overflowX:getComputedStyle(scroll).overflowX,rowHeight,headerRects,errors:errors.slice(0,12),rows:table.querySelectorAll('.crm-record-row').length};
    });
    assert.deepEqual(measurement.errors,[],JSON.stringify({route,width,measurement}));
    assert(measurement.pageWidth<=width+2,'Whole-page horizontal overflow: '+route);
    if(width>=768){assert(measurement.scrollWidth>measurement.clientWidth,'Dense tables need an inner horizontal scrollbar');assert(['auto','scroll'].includes(measurement.overflowX));assert(measurement.rowHeight>50,'Rows must grow to fit multiline content');await page.$eval('.crm-records-scroll',el=>{el.scrollLeft=el.scrollWidth/2;});}
    measurements.push({route,width,...measurement});
  };
  const scenarios=process.env.CRM_CHECK_TABLE_SPACING_FOCUSED==='1'?[['en',1440,'light'],['fa',375,'light']]:[['en',1440,'light'],['fa',1024,'light'],['tr',768,'dark'],['fa',375,'light'],['tr',320,'dark']];
  for(const[language,width,mode]of scenarios){
    await page.setViewport({width,height:950});await go('/contacts');await page.select('.crm-language-select select',language);await page.evaluate(mode=>localStorage.setItem('chakra-ui-color-mode',mode),mode);
    for(const route of ['/contacts','/properties','/residences','/opportunities']){
      await page.evaluate(()=>localStorage.setItem('crm-opportunities-view','table'));await go(route);await inspect(route,width);
      if(route==='/contacts'||route==='/properties')await page.screenshot({path:path.join(artifacts,'dense-'+route.slice(1)+'-'+width+'.png')});
    }
  }
  fs.writeFileSync(path.join(artifacts,'table-spacing-measurements.json'),JSON.stringify(measurements,null,2));
  console.log(`PASS: long text, unbroken references, multiline values and large amounts stay inside their cells across ${measurements.length} crowded table scenarios; desktop scroll stays inside the panel and mobile cards fit.`);
};
