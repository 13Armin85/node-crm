const constructionStatuses = {
  PLANNED: ['Planned', 'در مرحله طراحی', 'Planlandı'],
  UNDER_CONSTRUCTION: ['Under Construction', 'در حال ساخت', 'İnşaat halinde'],
  READY: ['Ready', 'آماده بهره‌برداری', 'Kullanıma hazır'],
};
const amenities = {
  ELEVATOR: ['Elevator', 'آسانسور', 'Asansör'],
  PARKING: ['Parking', 'پارکینگ', 'Otopark'],
  COVERED_PARKING: ['Covered Parking', 'پارکینگ سرپوشیده', 'Kapalı otopark'],
  SECURITY: ['24-hour Security', 'نگهبانی ۲۴ ساعته', '24 saat güvenlik'],
  RECEPTION: ['Reception', 'پذیرش', 'Resepsiyon'],
  POOL: ['Swimming Pool', 'استخر', 'Yüzme havuzu'],
  GYM: ['Gym', 'باشگاه ورزشی', 'Spor salonu'],
  SAUNA: ['Sauna', 'سونا', 'Sauna'],
  PLAYGROUND: ['Playground', 'زمین بازی کودکان', 'Çocuk oyun alanı'],
  GARDEN: ['Garden', 'فضای سبز', 'Bahçe'],
  SPORTS_COURT: ['Sports Court', 'زمین ورزشی', 'Spor sahası'],
  GENERATOR: ['Backup Generator', 'ژنراتور برق اضطراری', 'Yedek jeneratör'],
  FIRE_SYSTEM: ['Fire Safety System', 'سیستم ایمنی حریق', 'Yangın güvenlik sistemi'],
};
module.exports = { constructionStatuses, amenities };
