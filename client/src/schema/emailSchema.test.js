import { emailSchema } from './emailSchema';
const valid = { sender: '64d33173fd7ff3fa0924a101', recipient: 'selected@example.test', subject: 'Subject', message: 'Message', type: 'message' };
test('a complete email does not require unrelated creator, sales agent or date fields', async () => {
  expect(await emailSchema.isValid(valid)).toBe(true);
});
test.each(['recipient', 'subject', 'message'])('empty %s blocks email submission', async name => {
  expect(await emailSchema.isValid({ ...valid, [name]: '' })).toBe(false);
  expect(await emailSchema.isValid({ ...valid, [name]: '   ' })).toBe(false);
});
test('template emails require HTML instead of a text message', async () => {
  expect(await emailSchema.isValid({ ...valid, type: 'template', message: '', html: '<p>Template</p>' })).toBe(true);
  expect(await emailSchema.isValid({ ...valid, type: 'template', html: '' })).toBe(false);
});
