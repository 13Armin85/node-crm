const messages = {
  'leadConversion.contact': ['Transfer to contacts', 'انتقال فقط به مخاطبان', 'Kişilere aktar'],
  'leadConversion.both': ['Transfer to contacts and opportunities', 'انتقال به مخاطبان و فرصت‌ها', 'Kişilere ve fırsatlara aktar'],
  'leadConversion.success': ['Lead transferred successfully', 'لید با موفقیت منتقل و از فهرست لیدها حذف شد', 'Müşteri adayı başarıyla aktarıldı'],
  'leadConversion.failed': ['Transfer failed. The lead is retained; retry to complete the transfer.', 'انتقال کامل نشد. لید حفظ شده است؛ برای تکمیل انتقال دوباره تلاش کنید.', 'Aktarım tamamlanamadı. Müşteri adayı korundu; tekrar deneyin.'],
  'leadConversion.busy': ['This lead is being transferred. Please wait.', 'این لید در حال انتقال است. لطفاً صبر کنید.', 'Bu müşteri adayı aktarılıyor. Lütfen bekleyin.'],
  'leadConversion.modeMismatch': ['Retry the same transfer option to finish the previous transfer.', 'برای تکمیل انتقال قبلی، همان دکمه انتقال را دوباره بزنید.', 'Önceki aktarımı tamamlamak için aynı aktarım seçeneğini kullanın.'],
  'leadConversion.original': ['Original lead information', 'اطلاعات اولیه لید', 'İlk müşteri adayı bilgileri'],
};
export default Object.fromEntries(['en', 'fa', 'tr'].map((language, index) => [language,
  Object.fromEntries(Object.entries(messages).map(([key, values]) => [key, values[index]]))]));
