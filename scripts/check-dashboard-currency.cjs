const assert=require('node:assert/strict'),path=require('node:path');
exports.seed=require('./check-commission-tables.cjs').seed;
exports.check=async({page,origin,artifacts})=>{
  const go=()=>page.goto(origin+'/default',{waitUntil:'networkidle2'});
  const query=()=>page.evaluate(()=>{const selects=[...document.querySelectorAll('.crm-sales-performance select')];return{period:selects[0].value,currency:selects[1].value,teamMonths:selects[2].value};});
  const select=async(index,value)=>{const elements=await page.$$('.crm-sales-performance select');if(await elements[index].evaluate(el=>el.value)===value)return;const done=page.waitForResponse(response=>response.url().includes('/api/estate/dashboard/sales-summary?')&&response.status()===200);await elements[index].select(value);await done;await page.waitForSelector('[data-finance-bucket="sold"] .crm-currency__usd');};
  const verify=async(language)=>{
    const state=await query();
    const data=await page.evaluate(async state=>{const response=await fetch('/api/estate/dashboard/sales-summary?'+new URLSearchParams(state),{headers:{Authorization:localStorage.getItem('token')}});if(response.status!==200)throw new Error('Summary unavailable');return response.json();},state);
    const locale=({fa:'fa-IR',tr:'tr-TR'})[language]||'en-US';
    const money=(amount,currency)=>new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(amount);
    const expected=values=>{const amount=values?.[0]?.amount||0,currency=values?.[0]?.currency||'TRY',lira=amount*(currency==='USD'?34:currency==='EUR'?37:1);return{lira:money(lira,'TRY'),dollar:money(lira/34,'USD')};};
    for(const key of ['sold','available','lost','total']){
      const value=expected(data[key].values);
      await page.waitForFunction((key,value)=>{const root=document.querySelector('[data-finance-bucket="'+key+'"]');return root?.querySelector('.crm-currency__primary')?.textContent===value.lira&&root.querySelector('.crm-currency__usd')?.textContent.includes(value.dollar);},{timeout:5000},key,value);
    }
    if(data.bySeller.length){
      const row=await page.$('.crm-team-sales-table tbody tr');assert(row,'Sales ranking row missing');
      for(const[index,values]of[[4,data.bySeller[0].salesValues],[5,data.bySeller[0].values]]){
        const value=expected(values);assert.equal(await row.$eval('td:nth-child('+index+') .crm-currency__primary',el=>el.textContent),value.lira);
        assert((await row.$eval('td:nth-child('+index+') .crm-currency__usd',el=>el.textContent)).includes(value.dollar));
      }
    }
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+2,{timeout:4000});
    console.log('PASS: dashboard TRY/USD conversion, all four totals and seller amounts',language,state.period,state.currency);
  };
  for(const[language,width,mode]of[['en',1440,'light'],['fa',375,'light'],['tr',320,'dark']]){
    await go();await page.select('.crm-language-select select',language);await page.setViewport({width,height:950});
    await page.evaluate(mode=>localStorage.setItem('chakra-ui-color-mode',mode),mode);await go();
    await page.waitForSelector('[data-finance-bucket="sold"] .crm-currency__usd');
    for(const currency of['TRY','USD','EUR']){await select(1,currency);await verify(language);}
    await select(1,'TRY');
    for(const period of language==='en'?['week','month','half','year']:['week']){await select(0,period);await verify(language);}
    await page.screenshot({path:path.join(artifacts,'dashboard-conversion-'+language+'.png'),fullPage:true});
  }
};
