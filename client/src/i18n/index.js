import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const LANGUAGES = {
  en: { code: "en", label: "English", nativeLabel: "English", dir: "ltr" },
  fa: { code: "fa", label: "Persian", nativeLabel: "فارسی", dir: "ltr" },
  tr: { code: "tr", label: "Turkish", nativeLabel: "Türkçe", dir: "ltr" },
};

const fa = {
  "#": "#",
  "Account": "حساب",
  "Accounts": "حساب‌ها",
  "Action": "عملیات",
  "Actions": "عملیات",
  "Access": "دسترسی",
  "Active Deactive Module": "فعال/غیرفعال کردن ماژول",
  "Active": "فعال",
  "Activity": "فعالیت",
  "Add": "افزودن",
  "Add Email Template": "افزودن قالب ایمیل",
  "Add New": "افزودن جدید",
  "Address": "آدرس",
  "Admin Setting": "تنظیمات مدیریت",
  "Admin Settings": "تنظیمات مدیریت",
  "Advance Search": "جستجوی پیشرفته",
  "All": "همه",
  "Amount": "مبلغ",
  "Analytics": "تحلیل‌ها",
  "Back": "بازگشت",
  "Billing Address": "آدرس صورتحساب",
  "Cancel": "لغو",
  "Call": "تماس",
  "Calender": "تقویم",
  "Calendar": "تقویم",
  "Calls": "تماس‌ها",
  "Change Images": "تغییر تصاویر",
  "City": "شهر",
  "Clear": "پاک کردن",
  "Close": "بستن",
  "Cold Lead": "لید سرد",
  "Contact": "مخاطب",
  "Company": "شرکت",
  "Completed": "تکمیل‌شده",
  "Contact Import": "درون‌ریزی مخاطبان",
  "Contacts": "مخاطبان",
  "Country": "کشور",
  "Created Date": "تاریخ ایجاد",
  "Customer": "مشتری",
  "Custom Fields": "فیلدهای سفارشی",
  "Data": "داده‌ها",
  "Dashboard": "داشبورد",
  "Dark mode": "حالت تیره",
  "Date": "تاریخ",
  "Deal": "معامله",
  "Deal Value": "ارزش معامله",
  "Deals": "معاملات",
  "Delete": "حذف",
  "Description": "توضیحات",
  "Details": "جزئیات",
  "Documents": "اسناد",
  "Download": "دانلود",
  "Edit": "ویرایش",
  "Email": "ایمیل",
  "Email Is required": "ایمیل الزامی است",
  "Email Template": "قالب ایمیل",
  "Emails": "ایمیل‌ها",
  "End Date": "تاریخ پایان",
  "Enter": "وارد کنید",
  "Enter Your Password": "رمز عبور خود را وارد کنید",
  "Enter your email and password to sign in!":
    "برای ورود، ایمیل و رمز عبور خود را وارد کنید.",
  "Export Selected Data as CSV": "خروجی CSV از داده‌های انتخاب‌شده",
  "Export Selected Data as Excel": "خروجی Excel از داده‌های انتخاب‌شده",
  "Export as CSV": "خروجی CSV",
  "Export as Excel": "خروجی Excel",
  "Filter": "فیلتر",
  "First Page": "صفحه اول",
  "First Name": "نام",
  "From": "از",
  "Go to page:": "برو به صفحه:",
  "Help": "راهنما",
  "Hey": "سلام",
  "Home": "خانه",
  "Hot Lead": "لید داغ",
  "Import": "درون‌ریزی",
  "Inactive": "غیرفعال",
  "In Progress": "در حال انجام",
  "Invoice": "فاکتور",
  "Invoice Status": "وضعیت فاکتور",
  "Invoices": "فاکتورها",
  "Is required": "الزامی است",
  "Keep me logged in": "مرا به خاطر بسپار",
  "Language": "زبان",
  "Last Page": "صفحه آخر",
  "Last Name": "نام خانوادگی",
  "Lead Import": "درون‌ریزی لیدها",
  "Lead Source": "منبع لید",
  "Lead Status": "وضعیت لید",
  "Lead Statistics": "آمار لیدها",
  "Lead": "لید",
  "Leads": "لیدها",
  "Light mode": "حالت روشن",
  "Log out": "خروج",
  "Log out Successfully": "با موفقیت خارج شدید",
  "Login Successfully!": "ورود با موفقیت انجام شد!",
  "Manage Columns": "مدیریت ستون‌ها",
  "Mark all read": "همه خوانده شد",
  "Meetings": "جلسات",
  "Module": "ماژول",
  "Module Data Report": "گزارش داده‌های ماژول",
  "Name": "نام",
  "Negotiation": "مذاکره",
  "No Data Found": "داده‌ای یافت نشد",
  "No data found": "داده‌ای یافت نشد",
  "N/A": "نامشخص",
  "New Update": "به‌روزرسانی جدید",
  "Next Page": "صفحه بعد",
  "Notifications": "اعلان‌ها",
  "Opportunities": "فرصت‌ها",
  "Opportunity": "فرصت",
  "Owner": "مالک",
  "Page": "صفحه",
  "Password": "رمز عبور",
  "Password Is required": "رمز عبور الزامی است",
  "Payment": "پرداخت",
  "Payment Terms": "شرایط پرداخت",
  "Payments": "پرداخت‌ها",
  "Phone": "تلفن",
  "Pending": "در انتظار",
  "Pipeline": "قیف فروش",
  "Postal Code": "کد پستی",
  "Price": "قیمت",
  "Priority": "اولویت",
  "Previous Page": "صفحه قبل",
  "Profile Settings": "تنظیمات پروفایل",
  "Properties": "املاک",
  "Property": "ملک",
  "Property Import": "درون‌ریزی املاک",
  "Prospect": "مشتری بالقوه",
  "Quote Stage": "مرحله پیش‌فاکتور",
  "Reporting and Analytics": "گزارش‌ها و تحلیل‌ها",
  "Reset": "بازنشانی",
  "Roles": "نقش‌ها",
  "Save": "ذخیره",
  "Sales Stage": "مرحله فروش",
  "Search...": "جستجو...",
  "Select": "انتخاب",
  "Select File": "انتخاب فایل",
  "Settings": "تنظیمات",
  "Show": "نمایش",
  "Sign In": "ورود",
  "Status": "وضعیت",
  "Statistics": "آمار",
  "Stage": "مرحله",
  "State": "استان",
  "Street": "خیابان",
  "Subject": "موضوع",
  "Submit": "ثبت",
  "Success": "موفق",
  "successfully": "با موفقیت",
  "Table Fields": "فیلدهای جدول",
  "Tasks": "وظایف",
  "Task Statistics": "آمار وظایف",
  "To": "تا",
  "Total": "مجموع",
  "Total Discount": "مجموع تخفیف",
  "Total Leads": "مجموع لیدها",
  "Active Leads": "لیدهای فعال",
  "Pending Leads": "لیدهای در انتظار",
  "Sold Leads": "لیدهای فروخته‌شده",
  "Total Tasks": "مجموع وظایف",
  "Token has expired": "نشست شما منقضی شده است",
  "Type": "نوع",
  "Update": "به‌روزرسانی",
  "Upload": "آپلود",
  "Upload File": "آپلود فایل",
  "Upload Files": "آپلود فایل‌ها",
  "User View": "نمایش کاربر",
  "User": "کاربر",
  "Users": "کاربران",
  "Validation": "اعتبارسنجی",
  "View": "نمایش",
  "View All": "نمایش همه",
  "View all": "نمایش همه",
  "view page": "صفحه نمایش",
  "of": "از",
  "A new update for your downloaded item is available!":
    "به‌روزرسانی جدیدی برای آیتم دانلودشده شما آماده است.",
  "Need help, facing issues, or looking for a new feature? Contact us for paid support and services at":
    "برای دریافت پشتیبانی، رفع مشکل یا درخواست قابلیت جدید با ما تماس بگیرید:",
};

const tr = {
  "Account": "Hesap",
  "Accounts": "Hesaplar",
  "Action": "İşlem",
  "Actions": "İşlemler",
  "Access": "Erişim",
  "Active Deactive Module": "Modülü Etkinleştir/Pasifleştir",
  "Active": "Aktif",
  "Activity": "Etkinlik",
  "Add": "Ekle",
  "Add Email Template": "E-posta Şablonu Ekle",
  "Add New": "Yeni Ekle",
  "Address": "Adres",
  "Admin Setting": "Yönetici Ayarları",
  "Admin Settings": "Yönetici Ayarları",
  "Advance Search": "Gelişmiş Arama",
  "All": "Tümü",
  "Amount": "Tutar",
  "Analytics": "Analitik",
  "Back": "Geri",
  "Billing Address": "Fatura Adresi",
  "Cancel": "İptal",
  "Call": "Arama",
  "Calender": "Takvim",
  "Calendar": "Takvim",
  "Calls": "Aramalar",
  "Change Images": "Görselleri Değiştir",
  "City": "Şehir",
  "Clear": "Temizle",
  "Close": "Kapat",
  "Cold Lead": "Soğuk Aday",
  "Contact": "Kişi",
  "Company": "Şirket",
  "Completed": "Tamamlandı",
  "Contact Import": "Kişileri İçe Aktar",
  "Contacts": "Kişiler",
  "Country": "Ülke",
  "Created Date": "Oluşturma Tarihi",
  "Customer": "Müşteri",
  "Custom Fields": "Özel Alanlar",
  "Data": "Veri",
  "Dashboard": "Panel",
  "Dark mode": "Koyu mod",
  "Date": "Tarih",
  "Deal": "Anlaşma",
  "Deal Value": "Anlaşma Değeri",
  "Deals": "Anlaşmalar",
  "Delete": "Sil",
  "Description": "Açıklama",
  "Details": "Detaylar",
  "Documents": "Belgeler",
  "Download": "İndir",
  "Edit": "Düzenle",
  "Email": "E-posta",
  "Email Is required": "E-posta gereklidir",
  "Email Template": "E-posta Şablonu",
  "Emails": "E-postalar",
  "End Date": "Bitiş Tarihi",
  "Enter": "Gir",
  "Enter Your Password": "Şifrenizi girin",
  "Enter your email and password to sign in!":
    "Giriş yapmak için e-posta ve şifrenizi girin.",
  "Export Selected Data as CSV": "Seçili Verileri CSV Olarak Dışa Aktar",
  "Export Selected Data as Excel": "Seçili Verileri Excel Olarak Dışa Aktar",
  "Export as CSV": "CSV Olarak Dışa Aktar",
  "Export as Excel": "Excel Olarak Dışa Aktar",
  "Filter": "Filtre",
  "First Page": "İlk Sayfa",
  "First Name": "Ad",
  "From": "Başlangıç",
  "Go to page:": "Sayfaya git:",
  "Help": "Yardım",
  "Hey": "Merhaba",
  "Home": "Ana Sayfa",
  "Hot Lead": "Sıcak Aday",
  "Import": "İçe Aktar",
  "Inactive": "Pasif",
  "In Progress": "Devam Ediyor",
  "Invoice": "Fatura",
  "Invoice Status": "Fatura Durumu",
  "Invoices": "Faturalar",
  "Is required": "gereklidir",
  "Keep me logged in": "Oturumumu açık tut",
  "Language": "Dil",
  "Last Page": "Son Sayfa",
  "Last Name": "Soyad",
  "Lead Import": "Adayları İçe Aktar",
  "Lead Source": "Aday Kaynağı",
  "Lead Status": "Aday Durumu",
  "Lead Statistics": "Aday İstatistikleri",
  "Lead": "Aday",
  "Leads": "Adaylar",
  "Light mode": "Açık mod",
  "Log out": "Çıkış yap",
  "Log out Successfully": "Başarıyla çıkış yapıldı",
  "Login Successfully!": "Giriş başarılı!",
  "Manage Columns": "Sütunları Yönet",
  "Mark all read": "Tümünü okundu işaretle",
  "Meetings": "Toplantılar",
  "Module": "Modül",
  "Module Data Report": "Modül Veri Raporu",
  "Name": "Ad",
  "Negotiation": "Müzakere",
  "No Data Found": "Veri bulunamadı",
  "No data found": "Veri bulunamadı",
  "N/A": "Yok",
  "New Update": "Yeni Güncelleme",
  "Next Page": "Sonraki Sayfa",
  "Notifications": "Bildirimler",
  "Opportunities": "Fırsatlar",
  "Opportunity": "Fırsat",
  "Owner": "Sahip",
  "Page": "Sayfa",
  "Password": "Şifre",
  "Password Is required": "Şifre gereklidir",
  "Payment": "Ödeme",
  "Payment Terms": "Ödeme Şartları",
  "Payments": "Ödemeler",
  "Phone": "Telefon",
  "Pending": "Beklemede",
  "Pipeline": "Satış Hattı",
  "Postal Code": "Posta Kodu",
  "Price": "Fiyat",
  "Priority": "Öncelik",
  "Previous Page": "Önceki Sayfa",
  "Profile Settings": "Profil Ayarları",
  "Properties": "Mülkler",
  "Property": "Mülk",
  "Property Import": "Mülkleri İçe Aktar",
  "Prospect": "Potansiyel",
  "Quote Stage": "Teklif Aşaması",
  "Reporting and Analytics": "Raporlama ve Analitik",
  "Reset": "Sıfırla",
  "Roles": "Roller",
  "Save": "Kaydet",
  "Sales Stage": "Satış Aşaması",
  "Search...": "Ara...",
  "Select": "Seç",
  "Select File": "Dosya Seç",
  "Settings": "Ayarlar",
  "Show": "Göster",
  "Sign In": "Giriş Yap",
  "Status": "Durum",
  "Statistics": "İstatistikler",
  "Stage": "Aşama",
  "State": "Eyalet",
  "Street": "Sokak",
  "Subject": "Konu",
  "Submit": "Gönder",
  "Success": "Başarılı",
  "successfully": "başarıyla",
  "Table Fields": "Tablo Alanları",
  "Tasks": "Görevler",
  "Task Statistics": "Görev İstatistikleri",
  "To": "Bitiş",
  "Total": "Toplam",
  "Total Discount": "Toplam İndirim",
  "Total Leads": "Toplam Adaylar",
  "Active Leads": "Aktif Adaylar",
  "Pending Leads": "Bekleyen Adaylar",
  "Sold Leads": "Satılan Adaylar",
  "Total Tasks": "Toplam Görevler",
  "Token has expired": "Oturum süreniz doldu",
  "Type": "Tür",
  "Update": "Güncelle",
  "Upload": "Yükle",
  "Upload File": "Dosya Yükle",
  "Upload Files": "Dosyaları Yükle",
  "User View": "Kullanıcı Görünümü",
  "User": "Kullanıcı",
  "Users": "Kullanıcılar",
  "Validation": "Doğrulama",
  "View": "Görüntüle",
  "View All": "Tümünü Gör",
  "View all": "Tümünü Gör",
  "view page": "görüntüleme sayfası",
  "of": "/",
  "A new update for your downloaded item is available!":
    "İndirdiğiniz öğe için yeni bir güncelleme var.",
  "Need help, facing issues, or looking for a new feature? Contact us for paid support and services at":
    "Yardım, sorun çözümü veya yeni özellik talepleri için ücretli destek ekibimize ulaşın:",
};

const dictionaries = { en: {}, fa, tr };

const LanguageContext = createContext({
  language: "en",
  direction: "ltr",
  setLanguage: () => {},
  t: (value) => value,
});

const originalText = new WeakMap();
const translatedText = new WeakMap();
const originalPlaceholders = new WeakMap();
const translatedPlaceholders = new WeakMap();
const excludedTags = new Set([
  "SCRIPT",
  "STYLE",
  "TEXTAREA",
  "INPUT",
  "CODE",
  "PRE",
  "SVG",
  "CANVAS",
]);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const translate = (value, language = "en") => {
  if (value === undefined || value === null || language === "en") return value;
  const text = String(value);
  const dict = dictionaries[language] || {};
  if (dict[text]) return dict[text];
  const trimmed = text.trim();
  if (!trimmed || /^[\d\s.,:/#$%()+-]+$/.test(trimmed)) return text;
  if (dict[trimmed]) return text.replace(trimmed, dict[trimmed]);

  let translated = text;
  Object.keys(dict)
    .sort((a, b) => b.length - a.length)
    .forEach((key) => {
      const pattern = new RegExp(`(^|[^A-Za-z])${escapeRegExp(key)}(?=$|[^A-Za-z])`, "g");
      translated = translated.replace(pattern, `$1${dict[key]}`);
    });

  return translated;
};

const getSourceText = (node) => {
  const lastTranslated = translatedText.get(node);
  const current = node.nodeValue;
  if (originalText.has(node) && current === lastTranslated) {
    return originalText.get(node);
  }
  originalText.set(node, current);
  return current;
};

const getSourcePlaceholder = (node) => {
  const lastTranslated = translatedPlaceholders.get(node);
  const current = node.getAttribute("placeholder");
  if (originalPlaceholders.has(node) && current === lastTranslated) {
    return originalPlaceholders.get(node);
  }
  originalPlaceholders.set(node, current);
  return current;
};

const translateTree = (root, language) => {
  if (!root || typeof document === "undefined") return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || excludedTags.has(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (
        parent.closest(
          "[data-no-translate], [contenteditable='true'], .apexcharts-canvas",
        )
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const source = getSourceText(node);
    const nextValue = translate(source, language);
    translatedText.set(node, nextValue);
    if (node.nodeValue !== nextValue) {
      node.nodeValue = nextValue;
    }
  });

  root.querySelectorAll?.("input[placeholder], textarea[placeholder]").forEach(
    (node) => {
      const nextPlaceholder = translate(getSourcePlaceholder(node), language);
      translatedPlaceholders.set(node, nextPlaceholder);
      if (node.getAttribute("placeholder") !== nextPlaceholder) {
        node.setAttribute("placeholder", nextPlaceholder);
      }
    },
  );
};

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(
    () => localStorage.getItem("crm-language") || "en",
  );

  const setLanguage = useCallback((nextLanguage) => {
    const safeLanguage = LANGUAGES[nextLanguage] ? nextLanguage : "en";
    localStorage.setItem("crm-language", safeLanguage);
    setLanguageState(safeLanguage);
  }, []);

  const direction = LANGUAGES[language]?.dir || "ltr";

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.body?.setAttribute("dir", direction);
    document.body?.classList.toggle("crm-rtl", direction === "rtl");
    document.body?.classList.toggle("crm-ltr", direction !== "rtl");
  }, [language, direction]);

  const value = useMemo(
    () => ({
      language,
      direction,
      setLanguage,
      t: (text) => translate(text, language),
    }),
    [direction, language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function TranslationBoundary({ children }) {
  const { language } = useLanguage();
  const frame = useRef();

  useEffect(() => {
    const root = document.body;
    if (!root) return undefined;

    const run = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => translateTree(root, language));
    };

    run();
    const observer = new MutationObserver(run);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["placeholder"],
    });

    return () => {
      cancelAnimationFrame(frame.current);
      observer.disconnect();
    };
  }, [language]);

  return <>{children}</>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
