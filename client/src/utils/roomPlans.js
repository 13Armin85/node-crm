export const normalizeRoomPlan = value => {
  if (typeof value !== 'string') return value;
  const text = value.replace(/[۰-۹٠-٩]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.includes(digit) ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit) : '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/\s/g, '').replace(/＋/g, '+');
  const match = text.match(/^(\d+)\+(\d+)$/);
  return match ? match.slice(1).map(Number).sort((a, b) => b - a).join('+') : text;
};
export const isRoomPlanField = field => field.kind === 'SYSTEM_FIELD' && ['bedroom', 'unitTypes'].includes(field.name);
export const roomPlanMatches = (left, right) => normalizeRoomPlan(left) === normalizeRoomPlan(right);
