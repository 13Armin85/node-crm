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
Object.assign(labels, {
  "audit.allHint": [
    "Read a simple summary of saved actions. Choose a person to view their history.",
    "خلاصهٔ سادهٔ عملیات ثبت‌شده را ببینید. برای مشاهدهٔ سوابق هر فرد، او را انتخاب کنید.",
    "Kaydedilen işlemlerin sade özetini okuyun. Geçmişini görmek için bir kişi seçin.",
  ],
  "audit.ownHint": [
    "Only actions you completed and saved appear here.",
    "در این بخش فقط عملیات نهایی و ذخیره‌شدهٔ خودتان را می‌بینید.",
    "Burada yalnızca tamamlayıp kaydettiğiniz işlemler görünür.",
  ],
  "audit.search": [
    "Search a person or item name",
    "جست‌وجوی نام کاربر یا عنوان مورد",
    "Kişi veya kayıt adı ara",
  ],
  "audit.securityHint": [
    "One summary for each successful save or confirmation.",
    "هر ذخیره یا تأیید موفق، یک گزارش خلاصه.",
    "Her başarılı kayıt veya onay için tek bir özet.",
  ],
  "audit.activity": ["What happened", "فعالیت انجام‌شده", "Yapılan işlem"],
  "audit.chooseUser": [
    "View one person’s history",
    "مشاهدهٔ سوابق یک کاربر",
    "Bir kişinin geçmişini görüntüle",
  ],
  "audit.chooseUserHint": [
    "Choosing a user immediately shows only their completed actions.",
    "با انتخاب کاربر، فقط عملیات ثبت‌شدهٔ همان فرد نمایش داده می‌شود.",
    "Bir kullanıcı seçtiğinizde yalnızca onun tamamladığı işlemler gösterilir.",
  ],
  "audit.userHistory": ["User history", "سوابق این کاربر", "Kullanıcı geçmişi"],
  "audit.everyoneHistory": [
    "History of all users",
    "سوابق تمام کاربران",
    "Tüm kullanıcıların geçmişi",
  ],
  "audit.formerUser": ["Former account", "حساب غیرفعال", "Eski hesap"],
  "audit.total": ["Completed actions", "عملیات ثبت‌شده", "Tamamlanan işlemler"],
  "audit.created": ["Creation actions", "عملیات ایجاد", "Oluşturma işlemleri"],
  "audit.updated": [
    "Saved edits",
    "ویرایش‌های ذخیره‌شده",
    "Kaydedilen düzenlemeler",
  ],
  "audit.removed": ["Deletion actions", "عملیات حذف", "Silme işlemleri"],
  "audit.sharing": ["Sharing", "اشتراک‌گذاری", "Paylaşım"],
  "audit.generalSection": ["System", "سامانه", "Sistem"],
  "audit.namedTarget": [
    "{kind} “{name}”",
    "{kind} «{name}»",
    "“{name}” adlı {kind}",
  ],
  "audit.unnamedTarget": ["a {kind}", "یک {kind}", "bir {kind}"],
  "audit.sentence.create": [
    "{actor} created {target}.",
    "{actor} {target} را ایجاد کرد.",
    "{actor}, {target} oluşturdu.",
  ],
  "audit.sentence.update": [
    "{actor} edited and saved {target}.",
    "{actor} {target} را ویرایش و ذخیره کرد.",
    "{actor}, {target} düzenleyip kaydetti.",
  ],
  "audit.sentence.delete": [
    "{actor} deleted {target}.",
    "{actor} {target} را حذف کرد.",
    "{actor}, {target} sildi.",
  ],
  "audit.sentence.rename": [
    "{actor} renamed {target}.",
    "{actor} نام {target} را تغییر داد.",
    "{actor}, {target} adını değiştirdi.",
  ],
  "audit.sentence.login": [
    "{actor} signed in.",
    "{actor} وارد سامانه شد.",
    "{actor} oturum açtı.",
  ],
  "audit.sentence.logout": [
    "{actor} signed out.",
    "{actor} از سامانه خارج شد.",
    "{actor} oturumu kapattı.",
  ],
  "audit.sentence.password": [
    "{actor} changed their password.",
    "{actor} رمز عبور خود را تغییر داد.",
    "{actor} parolasını değiştirdi.",
  ],
  "audit.sentence.access": [
    "{actor} updated access permissions for {target}.",
    "{actor} دسترسی‌های {target} را تغییر داد.",
    "{actor}, {target} için erişim izinlerini değiştirdi.",
  ],
  "audit.sentence.settings": [
    "{actor} saved the settings for {target}.",
    "{actor} تنظیمات {target} را ذخیره کرد.",
    "{actor}, {target} ayarlarını kaydetti.",
  ],
  "audit.sentence.share": [
    "{actor} shared an item with another user.",
    "{actor} یک مورد را با کاربر دیگری به اشتراک گذاشت.",
    "{actor} bir kaydı başka bir kullanıcıyla paylaştı.",
  ],
  "audit.sentence.unshare": [
    "{actor} revoked sharing for an item.",
    "{actor} اشتراک‌گذاری یک مورد را لغو کرد.",
    "{actor} bir kaydın paylaşımını kaldırdı.",
  ],
  "audit.sentence.move": [
    "{actor} moved {target}.",
    "{actor} {target} را جابه‌جا کرد.",
    "{actor}, {target} taşıdı.",
  ],
  "audit.sentence.import": [
    "{actor} imported {count} items into {section}.",
    "{actor} {count} مورد را به بخش {section} وارد کرد.",
    "{actor}, {section} bölümüne {count} kayıt aktardı.",
  ],
  "audit.sentence.createMany": [
    "{actor} created {count} items in {section}.",
    "{actor} {count} مورد در بخش {section} ایجاد کرد.",
    "{actor}, {section} bölümünde {count} kayıt oluşturdu.",
  ],
  "audit.sentence.updateMany": [
    "{actor} edited and saved {count} items in {section}.",
    "{actor} {count} مورد در بخش {section} را ویرایش و ذخیره کرد.",
    "{actor}, {section} bölümünde {count} kaydı düzenleyip kaydetti.",
  ],
  "audit.sentence.deleteMany": [
    "{actor} deleted {count} items from {section}.",
    "{actor} {count} مورد از بخش {section} را حذف کرد.",
    "{actor}, {section} bölümünden {count} kayıt sildi.",
  ],
  "audit.kind.user": ["user", "کاربر", "kullanıcı"],
  "audit.kind.contact": ["contact", "مخاطب", "kişi"],
  "audit.kind.lead": ["lead", "لید", "potansiyel müşteri"],
  "audit.kind.task": ["task", "وظیفه", "görev"],
  "audit.kind.property": ["property", "ملک", "emlak"],
  "audit.kind.customer": ["customer", "مشتری", "müşteri"],
  "audit.kind.residence": ["residence", "رزیدانس", "konut"],
  "audit.kind.document": [
    "file or folder",
    "فایل یا پوشه",
    "dosya veya klasör",
  ],
  "audit.kind.form": ["form", "فرم", "form"],
  "audit.kind.template": ["email template", "قالب ایمیل", "e-posta şablonu"],
  "audit.kind.email": ["email", "ایمیل", "e-posta"],
  "audit.kind.call": ["call record", "گزارش تماس", "arama kaydı"],
  "audit.kind.meeting": ["meeting", "جلسه", "toplantı"],
  "audit.kind.invoice": ["invoice", "فاکتور", "fatura"],
  "audit.kind.quote": ["quote", "پیش‌فاکتور", "teklif"],
  "audit.kind.opportunity": ["opportunity", "فرصت", "fırsat"],
  "audit.kind.record": ["item", "مورد", "kayıt"],
});
Object.assign(labels, {
  "audit.exportExcel": [
    "Export as Excel",
    "خروجی اکسل",
    "Excel olarak dışa aktar",
  ],
  "audit.exportHint": [
    "Download all activity matching the applied filters and selected user",
    "دریافت همهٔ لاگ‌ها مطابق فیلترهای اعمال‌شده و کاربر انتخاب‌شده",
    "Uygulanan filtrelere ve seçilen kullanıcıya uyan tüm etkinlikleri indir",
  ],
  "audit.username": ["Username", "نام کاربری", "Kullanıcı adı"],
});
export default Object.fromEntries(
  ["en", "fa", "tr"].map((language, index) => [
    language,
    Object.fromEntries(
      Object.entries(labels).map(([key, values]) => [key, values[index]]),
    ),
  ]),
);
