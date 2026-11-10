export const normalizeRoomPlan = value => {
  if (typeof value !== 'string') return value;
  const text = value.replace(/[۰-۹٠-٩]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.includes(digit) ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit) : '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/\s/g, '').replace(/＋/g, '+');
  const match = text.match(/^(\d+)\+(\d+)$/);
  return match ? match.slice(1).map(Number).sort((a, b) => b - a).join('+') : text;
};
export const isRoomPlanField = field => field.kind === 'SYSTEM_FIELD' && ['bedroom', 'unitTypes'].includes(field.name);
export const isBedroomField = field => field?.kind === 'SYSTEM_FIELD' && field.name === 'bedroom';
export const normalizeBedroom = value => value == null ? value : String(value).trim()
  .replace(/[\u06f0-\u06f9\u0660-\u0669]/g, digit => String(digit.charCodeAt(0) - (digit.charCodeAt(0) >= 0x6f0 ? 0x6f0 : 0x660)))
  .replace(/\s*([+\uff0b])\s*/g, '+');
export const roomPlanMatches = (left, right, field) => isBedroomField(field)
  ? normalizeBedroom(left) === normalizeBedroom(right) : normalizeRoomPlan(left) === normalizeRoomPlan(right);
