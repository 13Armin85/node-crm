const messages = {
  'pipeline.salesPipeline': ['Sales pipeline', 'مسیر فروش فرصت‌ها', 'Satış süreci'],
  'pipeline.boardHint': ['Track each opportunity through your sales stages.', 'فرصت‌ها را در مراحل فروش دنبال و جابه‌جا کنید.', 'Fırsatları satış aşamalarında takip edin.'],
  'pipeline.stages': ['stages', 'مرحله فروش', 'aşama'],
  'pipeline.dealValue': ['Opportunity value', 'مبلغ فرصت', 'Fırsat tutarı'],
  'pipeline.emptyStage': ['No opportunities yet', 'هنوز فرصتی در این مرحله نیست', 'Henüz fırsat yok'],
  'pipeline.emptyHint': ['Move an opportunity here to continue its sales journey.', 'با انتقال یک فرصت به این بخش، پیگیری فروش را ادامه دهید.', 'Satış sürecini sürdürmek için buraya bir fırsat taşıyın.'],
  'pipeline.kanban': ['Kanban', 'کانبان', 'Kanban'],
  'pipeline.table': ['Table', 'جدول', 'Tablo'],
  'pipeline.owner': ['Lead owner', 'صاحب لید', 'Müşteri adayı sahibi'],
  'pipeline.noStage': ['Sales stage not selected', 'مرحله فروش انتخاب نشده', 'Satış aşaması seçilmedi'],
  'pipeline.stageSaved': ['Sales stage updated', 'مرحله فروش تغییر کرد', 'Satış aşaması güncellendi'],
  'pipeline.stageFailed': ['Could not update the sales stage', 'تغییر مرحله فروش انجام نشد', 'Satış aşaması güncellenemedi'],
  'pipeline.transfer': ['The lead and its call task move to this user and leave the previous assignee.', 'لید و وظیفه تماس به این شخص منتقل می‌شوند و از فهرست شخص قبلی حذف می‌شوند.', 'Müşteri adayı ve arama görevi bu kullanıcıya aktarılır ve önceki kullanıcıdan kaldırılır.'],
};
export default Object.fromEntries(['en', 'fa', 'tr'].map((language, index) => [language,
  Object.fromEntries(Object.entries(messages).map(([key, values]) => [key, values[index]]))]));
