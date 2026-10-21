const labels = {
  "pwa.installTitle": [
    "Install the application",
    "نصب برنامه",
    "Uygulamayı yükle",
  ],
  "pwa.install": ["Install", "نصب", "Yükle"],
  "pwa.installDescription": [
    "Keep the CRM on your home screen and open it like an app.",
    "سامانه را به صفحهٔ اصلی گوشی اضافه کنید و مثل یک برنامه باز کنید.",
    "CRM'yi ana ekranınıza ekleyip uygulama gibi açın.",
  ],
  "pwa.httpsRequired": [
    "Installation needs a secure HTTPS address. Open the secure site once HTTPS is enabled.",
    "برای نصب، آدرس سامانه باید HTTPS معتبر داشته باشد. پس از فعال‌شدن HTTPS، سایت را با آدرس امن باز کنید.",
    "Yükleme için güvenli bir HTTPS adresi gerekir. HTTPS etkinleşince güvenli adresi açın.",
  ],
  "pwa.onlineRequired": [
    "An internet connection is required to view and save CRM information.",
    "برای مشاهده و ذخیرهٔ اطلاعات سامانه، اتصال اینترنت لازم است.",
    "CRM bilgilerini görüntülemek ve kaydetmek için internet bağlantısı gerekir.",
  ],
  "pwa.iosSafari": [
    "Open this site in Safari.",
    "این سایت را در مرورگر Safari باز کنید.",
    "Bu siteyi Safari'de açın.",
  ],
  "pwa.iosShare": [
    "Tap Share in the browser toolbar.",
    "گزینهٔ اشتراک‌گذاری (Share) مرورگر را بزنید.",
    "Tarayıcının Paylaş düğmesine dokunun.",
  ],
  "pwa.addToHome": [
    "Choose Add to Home Screen, then Add.",
    "گزینهٔ افزودن به صفحهٔ اصلی (Add to Home Screen) و سپس افزودن را انتخاب کنید.",
    "Ana Ekrana Ekle seçeneğini, ardından Ekle'yi seçin.",
  ],
  "pwa.browserMenu": [
    "In the browser menu, choose Install app or Add to Home Screen. If the option is missing, open this site in Chrome, Edge or Safari.",
    "از منوی مرورگر، «نصب برنامه» یا «افزودن به صفحهٔ اصلی» را انتخاب کنید. اگر این گزینه نبود، سایت را در Chrome، Edge یا Safari باز کنید.",
    "Tarayıcı menüsünden Uygulamayı yükle veya Ana Ekrana Ekle'yi seçin. Seçenek yoksa siteyi Chrome, Edge veya Safari'de açın.",
  ],
  "pwa.ready": [
    "Tap Install to add the application to this device.",
    "برای افزودن برنامه به این دستگاه، دکمهٔ نصب را بزنید.",
    "Uygulamayı bu cihaza eklemek için Yükle'ye dokunun.",
  ],
  "pwa.installed": [
    "The application is already installed on this device.",
    "برنامه روی این دستگاه نصب شده است.",
    "Uygulama bu cihazda zaten yüklü.",
  ],
  "pwa.installFailed": [
    "Installation could not be opened. Use the browser menu to add the app to your home screen.",
    "پنجرهٔ نصب باز نشد. از منوی مرورگر، برنامه را به صفحهٔ اصلی اضافه کنید.",
    "Yükleme açılamadı. Tarayıcı menüsünden uygulamayı ana ekranınıza ekleyin.",
  ],
  "pwa.offline": [
    "You are offline",
    "اتصال اینترنت قطع است",
    "İnternet bağlantısı yok",
  ],
  "pwa.updateReady": [
    "An update is ready",
    "نسخهٔ جدید آماده است",
    "Yeni sürüm hazır",
  ],
  "pwa.saveBeforeUpdate": [
    "Save your changes before reloading the application.",
    "پیش از به‌روزرسانی، تغییرات خود را ذخیره کنید؛ برنامه دوباره باز می‌شود.",
    "Uygulamayı yeniden yüklemeden önce değişikliklerinizi kaydedin.",
  ],
  "pwa.update": [
    "Reload and update",
    "به‌روزرسانی و بازکردن مجدد",
    "Yenile ve güncelle",
  ],
  "pwa.later": ["Later", "بعداً", "Daha sonra"],
};
export default Object.fromEntries(
  ["en", "fa", "tr"].map((language, index) => [
    language,
    Object.fromEntries(
      Object.entries(labels).map(([key, values]) => [key, values[index]]),
    ),
  ]),
);
