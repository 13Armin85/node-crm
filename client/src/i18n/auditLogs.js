const labels = {
  Logs: ["Logs", "لاگ‌ها", "İşlem günlükleri"],
  "audit.allHint": [
    "View activity by all users and inspect the values before and after each change.",
    "فعالیت تمام کاربران و مقدار قبل و بعد هر تغییر را مشاهده کنید.",
    "Tüm kullanıcıların işlemlerini ve her değişikliğin önceki ve sonraki değerlerini görüntüleyin.",
  ],
  "audit.ownHint": [
    "Only your own activity appears here.",
    "در این بخش فقط فعالیت‌ها و تغییرات انجام‌شده توسط خودتان نمایش داده می‌شود.",
    "Burada yalnızca kendi işlemleriniz görüntülenir.",
  ],
  "audit.startHint": [
    "Activity is recorded from the time this feature is enabled; earlier history is unavailable.",
    "ثبت لاگ از زمان فعال شدن این قابلیت آغاز می‌شود؛ سوابق قبل از آن در دسترس نیست.",
    "İşlemler bu özellik etkinleştirildiği andan itibaren kaydedilir; önceki geçmiş mevcut değildir.",
  ],
  "audit.search": [
    "Search user, record or field",
    "جست‌وجوی کاربر، رکورد یا فیلد",
    "Kullanıcı, kayıt veya alan ara",
  ],
  "audit.actor": ["Performed by", "انجام‌دهنده", "İşlemi yapan"],
  "audit.allActors": ["All users", "تمام کاربران", "Tüm kullanıcılar"],
  "audit.collection": ["Section", "بخش سامانه", "Bölüm"],
  "audit.allCollections": ["All sections", "تمام بخش‌ها", "Tüm bölümler"],
  "audit.action": ["Activity", "نوع فعالیت", "İşlem"],
  "audit.allActions": ["All activities", "تمام فعالیت‌ها", "Tüm işlemler"],
  "audit.create": ["Created", "ایجاد", "Oluşturuldu"],
  "audit.update": ["Changed", "ویرایش", "Değiştirildi"],
  "audit.delete": ["Deleted", "حذف", "Silindi"],
  "audit.rename": [
    "Renamed section",
    "تغییر نام بخش",
    "Bölüm yeniden adlandırıldı",
  ],
  "audit.login": ["Signed in", "ورود به سامانه", "Oturum açıldı"],
  "audit.logout": ["Signed out", "خروج از سامانه", "Oturum kapatıldı"],
  "audit.from": ["From date", "از تاریخ", "Başlangıç tarihi"],
  "audit.to": ["To date", "تا تاریخ", "Bitiş tarihi"],
  "audit.apply": ["Apply filters", "اعمال فیلترها", "Filtreleri uygula"],
  "audit.reset": ["Clear filters", "پاک کردن فیلترها", "Filtreleri temizle"],
  "audit.time": ["Date and time", "تاریخ و ساعت", "Tarih ve saat"],
  "audit.record": ["Record", "رکورد", "Kayıt"],
  "audit.details": [
    "Change details",
    "جزئیات تغییرات",
    "Değişiklik ayrıntıları",
  ],
  "audit.field": ["Field", "فیلد", "Alan"],
  "audit.before": ["Previous value", "مقدار قبلی", "Önceki değer"],
  "audit.after": ["New value", "مقدار جدید", "Yeni değer"],
  "audit.redacted": [
    "Hidden for security",
    "پنهان برای حفظ امنیت",
    "Güvenlik için gizlendi",
  ],
  "audit.emptyValue": ["No value", "بدون مقدار", "Değer yok"],
  "audit.empty": [
    "No activity matches these filters.",
    "فعالیتی مطابق این فیلترها ثبت نشده است.",
    "Bu filtrelere uygun işlem bulunamadı.",
  ],
  "audit.error": [
    "Could not load activity. Try again.",
    "دریافت لاگ‌ها ناموفق بود. دوباره تلاش کنید.",
    "İşlemler yüklenemedi. Tekrar deneyin.",
  ],
  "audit.previous": ["Previous page", "صفحه قبل", "Önceki sayfa"],
  "audit.next": ["Next page", "صفحه بعد", "Sonraki sayfa"],
  "audit.page": ["Page", "صفحه", "Sayfa"],
  "audit.total": ["Total activities", "تعداد فعالیت‌ها", "Toplam işlem"],
  "audit.noChanges": [
    "This event has no field changes.",
    "این رویداد تغییر فیلد ندارد.",
    "Bu olayda alan değişikliği yok.",
  ],
  "audit.true": ["Yes", "بله", "Evet"],
  "audit.false": ["No", "خیر", "Hayır"],
};
Object.assign(labels, {
  "audit.history": [
    "SYSTEM ACTIVITY",
    "تاریخچه فعالیت سامانه",
    "SİSTEM ETKİNLİĞİ",
  ],
  "audit.adminScope": [
    "All users · Administrator access",
    "تمام کاربران · دسترسی مدیریت",
    "Tüm kullanıcılar · Yönetici erişimi",
  ],
  "audit.personalScope": [
    "Your activity · Private history",
    "فعالیت‌های شما · سوابق شخصی",
    "İşlemleriniz · Kişisel geçmiş",
  ],
  "audit.created": [
    "Records created",
    "موارد ایجادشده",
    "Oluşturulan kayıtlar",
  ],
  "audit.updated": [
    "Changes saved",
    "ویرایش‌های ثبت‌شده",
    "Kaydedilen değişiklikler",
  ],
  "audit.removed": ["Records deleted", "موارد حذف‌شده", "Silinen kayıtlar"],
  "audit.filters": [
    "Search and filters",
    "جست‌وجو و فیلترها",
    "Arama ve filtreler",
  ],
  "audit.securityHint": [
    "Passwords and tokens are always hidden.",
    "رمزها و توکن‌ها همیشه پنهان هستند.",
    "Parolalar ve belirteçler her zaman gizlenir.",
  ],
  "audit.activityList": [
    "Activity history",
    "فهرست فعالیت‌ها",
    "İşlem geçmişi",
  ],
  "audit.filteredResults": [
    "Results matching your filters",
    "نتایج مطابق فیلترهای انتخابی",
    "Filtrelerinize uyan sonuçlar",
  ],
  "audit.latestFirst": [
    "Most recent first",
    "جدیدترین فعالیت‌ها در ابتدا",
    "En yeni işlemler önce",
  ],
  "audit.loadFailed": [
    "Activity could not be loaded",
    "دریافت لاگ‌ها ناموفق بود",
    "İşlemler yüklenemedi",
  ],
  "audit.emptyFilteredHint": [
    "Try a different search or clear your filters.",
    "فیلترها را تغییر دهید یا جست‌وجو را پاک کنید.",
    "Başka bir arama deneyin veya filtreleri temizleyin.",
  ],
});
Object.assign(labels, {
  "audit.refresh": ["Refresh", "به‌روزرسانی", "Yenile"],
});
export default Object.fromEntries(
  ["en", "fa", "tr"].map((language, index) => [
    language,
    Object.fromEntries(
      Object.entries(labels).map(([key, values]) => [key, values[index]]),
    ),
  ]),
);
