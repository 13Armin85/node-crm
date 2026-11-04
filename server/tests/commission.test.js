const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stageProbability, normalizeOpportunity, inferLeadStage, defaultStages } = require('../services/opportunityMetrics');
const { defaults } = require('../services/formDefinitions');
const { since } = require('../services/commissionSummary');
const definition = { moduleName: 'Opportunities', fields: defaults.Opportunities };
test('opportunity probability follows stage order and terminal outcomes', () => {
  const probabilities = defaultStages.slice(0,-2).map(stage=>stageProbability(stage));
  assert(probabilities.every((value,index)=>index===0||value>probabilities[index-1]));
  assert.equal(stageProbability('Closed/Won'),100); assert.equal(stageProbability('Closed/Lost'),0);
  assert.equal(stageProbability('Review', ['New','Review','Closed/Won','Closed/Lost']),90);
});
test('three independent financial amounts are required, nonnegative and cannot set closing dates or probability', () => {
  const input={opportunityAmount:'100000',amount:'95000',commission:'1200.25',salesStage:'Qualification',probability:99,closedAt:'2000-01-01'};
  const result=normalizeOpportunity(input,{},definition,true);
  assert.equal(result.commission,1200.25); assert.equal(result.amount,95000); assert.equal(result.opportunityAmount,100000);
  assert.equal(result.probability,stageProbability('Qualification')); assert.equal(result.closedAt,undefined);
  for(const name of ['opportunityAmount','amount','commission']) {
    assert.throws(()=>normalizeOpportunity({...input,[name]:undefined},{},definition,true),error=>error.field===name&&error.code==='required');
    for(const value of [-1,'bad',true,Infinity]) assert.throws(()=>normalizeOpportunity({...input,[name]:value},{},definition,true),error=>error.field===name);
  }
  assert.equal(normalizeOpportunity({...input,commission:0},{},definition,true).commission,0);
  assert.throws(()=>normalizeOpportunity({commission:''},{_id:'old'},definition),error=>error.code==='required');
  assert.doesNotThrow(()=>normalizeOpportunity({description:'Legacy edit'},{_id:'old',salesStage:'Old custom stage'},definition));
});
test('closing dates follow stage transitions and source lead stages survive conversion', () => {
  const won=normalizeOpportunity({salesStage:'Closed/Won'},{_id:'old',salesStage:'Prospecting'},definition);
  assert(won.closedAt instanceof Date); assert.equal(won.probability,100);
  assert.equal(normalizeOpportunity({salesStage:'Closed/Won'},{_id:'old',salesStage:'Closed/Won',closedAt:won.closedAt},definition).closedAt,undefined);
  assert.equal(normalizeOpportunity({salesStage:'Prospecting'},{_id:'old',salesStage:'Closed/Won',closedAt:won.closedAt},definition).closedAt,null);
  assert.equal(inferLeadStage({leadData:{leadStatus:'active',leadState:'Booked'}}),'Booked');
  assert.equal(inferLeadStage({contactData:{convertedLeads:[{values:{leadStatus:'active',leadState:'Waiting'}}]}}),'Waiting');
});
test('rolling month windows clamp month ends and preserve time of day',()=>{
  assert.equal(since(new Date('2026-03-31T12:30:00Z'),'month').toISOString(),'2026-02-28T12:30:00.000Z');
  assert.equal(since(new Date('2026-11-04T12:30:00Z'),'week').toISOString(),'2026-10-28T12:30:00.000Z');
});
