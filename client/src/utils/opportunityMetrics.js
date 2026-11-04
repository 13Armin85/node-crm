export const defaultStages = ['Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition', 'Identifying Decision Makers', 'Perception Analysis', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed/Won', 'Closed/Lost'];
const outcome = value => /(^|[/\s_-])(won|win|sold)$/i.test(String(value || '')) ? 'won' : /(^|[/\s_-])(lost|loss)$/i.test(String(value || '')) ? 'lost' : 'open';
export const stageProbability = (stage, stages = defaultStages) => {
  if (outcome(stage) === 'won') return 100;
  if (outcome(stage) === 'lost') return 0;
  const open = stages.map(item => typeof item === 'string' ? item : item.value).filter(value => outcome(value) === 'open'), index = open.indexOf(stage);
  return index < 0 ? 0 : open.length < 2 ? 10 : Math.round(10 + index * 80 / (open.length - 1));
};
