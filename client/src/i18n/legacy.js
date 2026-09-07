// Existing English keys remain stable; aliases cover historical spelling/casing.
const rows = `
Message|پیام|Mesaj
Title|عنوان|Başlık
Grand Total|جمع کل|Genel Toplam
Recipient|گیرنده|Alıcı
Start Date|تاریخ شروع|Başlangıç Tarihi
End Date|تاریخ پایان|Bitiş Tarihi
Value|مقدار|Değer
Shipping|ارسال|Teslimat
Shipping Street|خیابان تحویل|Teslimat Sokağı
Billing Street|خیابان صورتحساب|Fatura Sokağı
Shipping Postal Code|کد پستی تحویل|Teslimat Posta Kodu
Billing Postal Code|کد پستی صورتحساب|Fatura Posta Kodu
Shipping City|شهر تحویل|Teslimat Şehri
Billing City|شهر صورتحساب|Fatura Şehri
Shipping State|استان تحویل|Teslimat İli
Billing State|استان صورتحساب|Fatura İli
Shipping Country|کشور تحویل|Teslimat Ülkesi
Billing Country|کشور صورتحساب|Fatura Ülkesi
Print as PDF|چاپ پی‌دی‌اف|PDF olarak yazdır
Email Address|نشانی ایمیل|E-posta Adresi
Subtotal|جمع جزء|Ara Toplam
Shipping Tax|مالیات ارسال|Teslimat Vergisi
Quote Number|شماره پیشنهاد|Teklif Numarası
Quote Date|تاریخ پیشنهاد|Teklif Tarihi
Quotes|پیشنهادها|Teklifler
Created|ایجادشده|Oluşturuldu
Related|مرتبط|İlgili
Fields In Crm|فیلدهای سامانه|Sistem Alanları
Fields In File|فیلدهای فایل|Dosya Alanları
Tax|مالیات|Vergi
Timestamp|زمان ثبت|Zaman Damgası
Discount|تخفیف|İndirim
Agenda|دستور جلسه|Gündem
Valid Until|معتبر تا|Geçerlilik Tarihi
Approval Issues|مشکلات تأیید|Onay Sorunları
Terms|شرایط|Koşullar
Office Phone|تلفن دفتر|Ofis Telefonu
Fax|فکس|Faks
Opportunity Name|نام فرصت|Fırsat Adı
Opportunity Amount|مبلغ فرصت|Fırsat Tutarı
Invoice Number|شماره فاکتور|Fatura Numarası
Assign To|واگذاری به|Atanan Kişi
URL|نشانی اینترنتی|Bağlantı
Expected Close Date|تاریخ پایان مورد انتظار|Beklenen Kapanış Tarihi
Other|سایر|Diğer
Account Number|شماره حساب بانکی|Banka Hesap Numarası
Bank|بانک|Banka
Branch|شعبه|Şube
Number|عدد|Sayı
Max Value|حداکثر مقدار|En Yüksek Değer
Min Value|حداقل مقدار|En Düşük Değer
Related To|مرتبط با|İlgili Kayıt
Assigned To|واگذارشده به|Atanan
Copy address from left|کپی نشانی بخش مقابل|Diğer adresi kopyala
Notes|یادداشت‌ها|Notlar
Draft|پیش‌نویس|Taslak
Delivered|تحویل‌شده|Teslim Edildi
Confirmed|تأییدشده|Onaylandı
Closed Accepted|بسته‌شده و پذیرفته|Kapandı ve Kabul Edildi
Closed Lost|بسته‌شده و ازدست‌رفته|Kapandı ve Kaybedildi
Closed Dead|بسته‌شده و لغوشده|Kapandı ve İptal Edildi
Selected Files|فایل‌های انتخاب‌شده|Seçilen Dosyalar
Sender|فرستنده|Gönderen
Call Duration|مدت تماس|Arama Süresi
Call Notes|یادداشت تماس|Arama Notları
Swift Code|کد سوئیفت|SWIFT Kodu
Call Fred|تماس با فرد|Fred'i ara
Shipping Address|نشانی تحویل|Teslimat Adresi
Currency|ارز|Para Birimi
Phone Number|شماره تلفن|Telefon Numarası
Assign To Sales Agent|واگذاری به کارشناس فروش|Satış Temsilcisine Ata
Recipient (Contact)|گیرنده (مخاطب)|Alıcı (Kişi)
Recipient (Lead)|گیرنده (لید)|Alıcı (Müşteri Adayı)
Template|قالب|Şablon
Role Name|نام نقش|Rol Adı
Partner|همکار|İş Ortağı
Assigned User|کاربر مسئول|Atanan Kullanıcı
Information|اطلاعات|Bilgi
Require|الزامی|Zorunlu
Min|حداقل|En Az
Min Message|پیام حداقل|Alt Sınır Mesajı
Max|حداکثر|En Fazla
Max Message|پیام حداکثر|Üst Sınır Mesajı
Match|الگو|Eşleşme
Match Message|پیام الگو|Eşleşme Mesajı
Match Value|مقدار الگو|Eşleşme Değeri
Formik Type|نوع اعتبارسنجی|Doğrulama Türü
String|رشته متنی|Metin
Object|شیء|Nesne
Array|آرایه|Dizi
Boolean|منطقی|Mantıksal
Positive|مثبت|Pozitif
Negative|منفی|Negatif
Integer|عدد صحیح|Tam Sayı
Formik Type Message|پیام نوع اعتبارسنجی|Doğrulama Türü Mesajı
Sender Name|نام فرستنده|Gönderen Adı
Change|تغییر|Değiştir
Invoice Date|تاریخ فاکتور|Fatura Tarihi
Location|مکان|Konum
Opportunity|فرصت|Fırsat
Not Invoiced|بدون فاکتور|Faturalanmadı
Invoiced|فاکتورشده|Faturalandı
Payment Terms|شرایط تسویه|Ödeme Koşulları
Nett 15|سررسید ۱۵ روزه|15 Gün Vade
Nett 30|سررسید ۳۰ روزه|30 Gün Vade
Approval Status|وضعیت تأیید|Onay Durumu
Approved|تأییدشده|Onaylandı
Requirement|نیازمندی|Gereksinim
No|خیر|Hayır
Yes|بله|Evet
Date Time|تاریخ و زمان|Tarih ve Saat
Created By|ایجادکننده|Oluşturan
Category|دسته‌بندی|Kategori
Communication|ارتباطات|İletişim
Template Name|نام قالب|Şablon Adı
Overview|نمای کلی|Genel Bakış
Paid|تسویه‌شده|Ödendi
Unpaid|تسویه‌نشده|Ödenmedi
Cancelled|لغوشده|İptal Edildi
Address Information|اطلاعات نشانی|Adres Bilgileri
Line Items|اقلام|Kalemler
Item|قلم|Kalem
Qty|تعداد|Miktar
Rate|نرخ|Birim Fiyat
Associated Listing|ملک مرتبط|İlişkili İlan
Assign to User|واگذاری به کاربر|Kullanıcıya Ata
Next Step|گام بعدی|Sonraki Adım
Prospecting|یافتن مشتری|Müşteri Arama
Qualification|ارزیابی صلاحیت|Nitelendirme
Needs Analysis|تحلیل نیازها|İhtiyaç Analizi
Value Proposition|ارزش پیشنهادی|Değer Önerisi
Identifying Decision Makers|شناسایی تصمیم‌گیرندگان|Karar Vericileri Belirleme
Perception Analysis|تحلیل برداشت مشتری|Algı Analizi
Proposal/Price Quote|پیشنهاد قیمت|Fiyat Teklifi
Negotiation/Review|مذاکره و بررسی|Müzakere ve İnceleme
Closed/Won|بسته‌شده و موفق|Kapandı ve Kazanıldı
Closed/Lost|بسته‌شده و ناموفق|Kapandı ve Kaybedildi
Probability|احتمال|Olasılık
None|هیچ‌کدام|Hiçbiri
Show more|نمایش بیشتر|Daha fazla göster
Sold|فروخته‌شده|Satıldı
Email Id|نشانی ایمیل|E-posta Adresi
Link|پیوند|Bağlantı
Buy Now|خرید|Satın Al
Pages|صفحات|Sayfalar
Upgrade to PRO|ارتقا به نسخه حرفه‌ای|Profesyonel Sürüme Yükselt
Folder Name|نام پوشه|Klasör Adı
File Name|نام فایل|Dosya Adı
Website|وب‌سایت|Web Sitesi
Contact Name|نام مخاطب|Kişi Adı
Select Interested Property|انتخاب ملک مورد علاقه|İlgilenilen Gayrimenkulü Seç
Document|سند|Belge
Heading|سرفصل|Başlık
Field|فیلد|Alan
Label|عنوان فیلد|Etiket
Text|متن|Metin
Radio|تک‌انتخابی|Tek Seçim
Check|کادر انتخاب|Onay Kutusu
Tel|تلفن|Telefon
Range|بازه|Aralık
Color|رنگ|Renk
Belongs To|سرفصل مرتبط|Bağlı Başlık
Fixed|ثابت|Sabit
Option|گزینه|Seçenek
Require Message|پیام الزام|Zorunluluk Mesajı
Link Contact|اتصال مخاطب|Kişi Bağla
Link Lead|اتصال لید|Müşteri Adayı Bağla
Sales Agent|کارشناس فروش|Satış Temsilcisi
Due Date|تاریخ سررسید|Son Ödeme Tarihi
Invoice No.|شماره فاکتور|Fatura No.
S No|ردیف|Sıra No.
Type a Name|یک نام وارد کنید|Bir ad yazın
Convert Date&Time|تاریخ و زمان تبدیل|Dönüştürme Tarihi ve Saati
Existing Business|کسب‌وکار موجود|Mevcut İş
New Business|کسب‌وکار جدید|Yeni İş
Cold Call|تماس اولیه|Soğuk Arama
Existing Customer|مشتری فعلی|Mevcut Müşteri
Self Generated|ایجادشده توسط خود|Kendi Oluşturduğu
Employee|کارمند|Çalışan
Public Relation|روابط عمومی|Halkla İlişkiler
Direct Mail|نامه مستقیم|Doğrudan Posta
Conference|کنفرانس|Konferans
Trade Show|نمایشگاه تجاری|Ticaret Fuarı
Web Site|وب‌سایت|Web Sitesi
Word Of Mouth|معرفی شفاهی|Ağızdan Ağıza
Opportunity Project|پروژه فرصت|Fırsat Projesi
Assign To Contact|واگذاری به مخاطب|Kişiye Ata
Assign To Lead|واگذاری به لید|Müşteri Adayına Ata
Create|ایجاد|Oluştur
Task Title|عنوان وظیفه|Görev Başlığı
Task Related To|رکورد مرتبط با وظیفه|Görevin İlgili Kaydı
Task Start|شروع وظیفه|Görev Başlangıcı
Task End|پایان وظیفه|Görev Bitişi
Task Link|پیوند وظیفه|Görev Bağlantısı
Task Reminder|یادآوری وظیفه|Görev Hatırlatıcısı
Task Create By|ایجادکننده وظیفه|Görevi Oluşturan
Task Description|توضیحات وظیفه|Görev Açıklaması
Task Notes|یادداشت وظیفه|Görev Notları
Password|رمز عبور|Parola
Role|نقش|Rol
Change Role|تغییر نقش|Rolü Değiştir
Validations|اعتبارسنجی‌ها|Doğrulamalar
Since Last Month|از ماه گذشته|Geçen Aydan Bu Yana
Linked Contact|مخاطب مرتبط|Bağlı Kişi
Linked Lead|لید مرتبط|Bağlı Müşteri Adayı
Dashboards|داشبوردها|Panolar
Authentications|احراز هویت|Kimlik Doğrulama
Main Pages|صفحات اصلی|Ana Sayfalar
NFTs|دارایی‌های دیجیتال|Dijital Varlıklar
Extra|سایر|Ek
Application|برنامه|Uygulama
Ecommerce|تجارت الکترونیک|Elektronik Ticaret
Colors|رنگ‌ها|Renkler
Font Sizes|اندازه قلم‌ها|Yazı Boyutları
Hello World|سلام دنیا|Merhaba Dünya
Physical Address|نشانی محل|Fiziksel Adres
Preferred Contact Method|روش ارتباط ترجیحی|Tercih Edilen İletişim Yöntemi
Lead Name|نام لید|Müşteri Adayı Adı
Lead Email|ایمیل لید|Müşteri Adayı E-postası
Lead Phone Number|تلفن لید|Müşteri Adayı Telefonu
Lead Address|نشانی لید|Müşteri Adayı Adresi
Lead Creation Date|تاریخ ایجاد لید|Müşteri Adayı Oluşturma Tarihi
Lead Conversion Date|تاریخ تبدیل لید|Müşteri Adayı Dönüşüm Tarihi
Lead Follow Up Date|تاریخ پیگیری لید|Müşteri Adayı Takip Tarihi
Lead Score|امتیاز لید|Müşteri Adayı Puanı
Lead Conversion Rate|نرخ تبدیل لید|Müşteri Adayı Dönüşüm Oranı
Property Type|نوع ملک|Gayrimenkul Türü
Property Address|نشانی ملک|Gayrimenkul Adresi
Listing Price|قیمت آگهی|İlan Fiyatı
Square Footage|مساحت بر حسب فوت مربع|Fit Kare Alanı
Number Of Bedrooms|تعداد اتاق خواب|Yatak Odası Sayısı
Number Of Bathrooms|تعداد حمام|Banyo Sayısı
Year Built|سال ساخت|Yapım Yılı
Property Description|توضیحات ملک|Gayrimenkul Açıklaması
Website URL|نشانی وب‌سایت|Web Sitesi Bağlantısı
Bank Details|اطلاعات بانکی|Banka Bilgileri
Email Send successfully|ایمیل با موفقیت ثبت شد|E-posta başarıyla kaydedildi
Send Email|ارسال ایمیل|E-posta Gönder
Text Message|پیام متنی|Metin Mesajı
Text Msg|پیام متنی|Metin Mesajı
Property of Interest|ملک مورد علاقه|İlgilenilen Gayrimenkul
Social Media Profiles|حساب‌های شبکه‌های اجتماعی|Sosyal Medya Profilleri
LinkedIn Profile|پروفایل لینکدین|LinkedIn Profili
Facebook Profile|پروفایل فیس‌بوک|Facebook Profili
Twitter Handle|شناسه توییتر|Twitter Kullanıcı Adı
Other Profiles|سایر پروفایل‌ها|Diğer Profiller
Dropdown|فهرست انتخاب|Açılır Liste
Select All Headings|انتخاب همه سرفصل‌ها|Tüm Başlıkları Seç
Your Pie Chart|نمودار دایره‌ای|Pasta Grafiğiniz
Daily|روزانه|Günlük
Monthly|ماهانه|Aylık
Yearly|سالانه|Yıllık
Your files|فایل‌های شما|Dosyalarınız
System|سیستم|Sistem
Report|گزارش|Rapor
File Explorer|مدیریت فایل|Dosya Gezgini
Sender Email|ایمیل فرستنده|Gönderen E-postası
Create From|ایجاد از|Oluşturma Kaynağı
Image|تصویر|Resim
Images|تصاویر|Resimler
Navbar Small Logo Image|لوگوی کوچک نوار پیمایش|Küçük Gezinme Logosu
Navbar Large Logo Image|لوگوی بزرگ نوار پیمایش|Büyük Gezinme Logosu
Login page Image|تصویر صفحه ورود|Giriş Sayfası Resmi
Set Image|انتخاب تصویر|Resmi Ayarla
Email Send|ثبت ایمیل|E-posta Kaydı
Last Communication|آخرین ارتباط|Son İletişim
Scheduled Communication|ارتباط زمان‌بندی‌شده|Planlanan İletişim
Meeting|جلسه|Toplantı
Attendees|شرکت‌کنندگان|Katılımcılar
Time|زمان|Saat
Opportunity Project Name|نام پروژه فرصت|Fırsat Projesi Adı
Opportunity Project Requirement|نیازمندی پروژه فرصت|Fırsat Projesi Gereksinimi
Create To|ایجاد برای|Hedef Kayıt
Contact Method|روش ارتباط|İletişim Yöntemi
Gallery|گالری|Galeri
Property Photos|تصاویر ملک|Gayrimenkul Fotoğrafları
Virtual Tours or Videos|تور مجازی یا ویدئو|Sanal Turlar veya Videolar
Floor Plans|نقشه طبقات|Kat Planları
Property Documents|اسناد ملک|Gayrimenkul Belgeleri
Property All Document|همه اسناد ملک|Tüm Gayrimenkul Belgeleri
Convert To Invoice|تبدیل به فاکتور|Faturaya Dönüştür
Reports|گزارش‌ها|Raporlar
Email Sent|ایمیل‌های ثبت‌شده|Kaydedilen E-postalar
Outbound Calls|تماس‌های خروجی|Giden Aramalar
Change Access|تغییر دسترسی|Yetkiyi Değiştir
Manage Users|مدیریت کاربران|Kullanıcıları Yönet
Open View|نمایش جزئیات|Ayrıntıları Aç
All Day Task ?|وظیفه تمام‌روز؟|Tüm Günlük Görev mi?
Background-Color|رنگ پس‌زمینه|Arka Plan Rengi
Border-Color|رنگ حاشیه|Kenarlık Rengi
Text-Color|رنگ متن|Metin Rengi
Task|وظیفه|Görev
User Email|ایمیل کاربر|Kullanıcı E-postası
User Name|نام کاربری|Kullanıcı Adı
Reminder|یادآوری|Hatırlatıcı
All Day|تمام‌روز|Tüm Gün
Background Color|رنگ پس‌زمینه|Arka Plan Rengi
Border Color|رنگ حاشیه|Kenarlık Rengi
Text Color|رنگ متن|Metin Rengi
Display|نمایش|Görünüm
Start|شروع|Başlangıç
End|پایان|Bitiş
Available|موجود|Müsait
Residential|مسکونی|Konut
Commercial|تجاری|Ticari
Apartment|آپارتمان|Daire
Residence|رزیدانس|Rezidans
Villa|ویلا|Villa
Shop|مغازه|Dükkan
Office|دفتر|Ofis
Alternate Phone|تلفن جایگزین|Alternatif Telefon
Non Primary Email|ایمیل جایگزین|Alternatif E-posta
Rating|رتبه|Derecelendirme
SIC Code|کد طبقه‌بندی صنعتی|Sektör Kodu
Ownership|مالکیت|Mülkiyet
Analyst|تحلیلگر|Analist
Competitor|رقیب|Rakip
Integrator|یکپارچه‌ساز|Entegratör
Investor|سرمایه‌گذار|Yatırımcı
Press|مطبوعات|Basın
Reseller|فروشنده واسط|Bayi
Industry|صنعت|Sektör
Apparel|پوشاک|Giyim
Banking|بانکداری|Bankacılık
Biotechnology|زیست‌فناوری|Biyoteknoloji
Chemicals|مواد شیمیایی|Kimya
Communications|ارتباطات|İletişim
Construction|ساخت‌وساز|İnşaat
Consulting|مشاوره|Danışmanlık
Education|آموزش|Eğitim
Electronics|الکترونیک|Elektronik
Energy|انرژی|Enerji
Engineering|مهندسی|Mühendislik
Entertainment|سرگرمی|Eğlence
Finance|مالی|Finans
Government|دولت|Kamu
Healthcare|بهداشت و درمان|Sağlık
Hospitality|مهمانداری|Konaklama
Insurance|بیمه|Sigorta
Machinery|ماشین‌آلات|Makine
Manufacturing|تولید|Üretim
Media|رسانه|Medya
Not For Profit|غیرانتفاعی|Kâr Amacı Gütmeyen
Recreation|تفریح|Dinlenme
Retail|خرده‌فروشی|Perakende
Technology|فناوری|Teknoloji
Telecommunications|مخابرات|Telekomünikasyon
Transportation|حمل‌ونقل|Ulaşım
Utilities|خدمات عمومی|Kamu Hizmetleri
Member Of|عضو|Üyelik
Annual Revenue|درآمد سالانه|Yıllık Gelir
Email Opt Out|لغو دریافت ایمیل|E-posta İzni İptali
Invalid Email|ایمیل نامعتبر|Geçersiz E-posta
Belongs To Field|سرفصل مرتبط|Bağlı Başlık Alanı
Link With Document|اتصال به سند|Belgeye Bağla
Link With|اتصال به|Şuna Bağla
No Document Found|سندی یافت نشد|Belge Bulunamadı
Module Name|نام ماژول|Modül Adı
Pay|تسویه|Öde
Lead Mobile|تلفن همراه لید|Müşteri Adayı Cep Telefonu
Lead Campaign|کمپین لید|Müşteri Adayı Kampanyası
Campaign|کمپین|Kampanya
Referral|معرفی|Yönlendirme
Online|آنلاین|Çevrimiçi
Billboard|تابلوی تبلیغاتی|Reklam Panosu
Activation|فعال‌سازی|Etkinleştirme
Agent|کارشناس|Temsilci
Lead State|وضعیت لید|Müşteri Adayı Durumu
Open|باز|Açık
Parking|پارکینگ|Otopark
Waiting|در انتظار|Bekliyor
Booked|رزروشده|Rezerve
Blocked|مسدود|Engellendi
Sealed|نهایی‌شده|Kesinleşti
Communication Tool|ابزار ارتباط|İletişim Aracı
WhatsApp|واتس‌اپ|WhatsApp
Virtual Meet|جلسه آنلاین|Çevrimiçi Görüşme
Visit|بازدید|Ziyaret
Listed for|نوع آگهی|İlan Amacı
Rent|اجاره|Kiralık
Buy|خرید|Satın Alma
From Project 1|از پروژه ۱|Proje 1 Kaynağı
Project 2|پروژه ۲|Proje 2
Project 3|پروژه ۳|Proje 3
Lead Message|پیام لید|Müşteri Adayı Mesajı
Land|زمین|Arsa
Manssonnate|خانه دوبلکس|Dubleks Ev
Full Name|نام کامل|Ad Soyad
L.R. NO.|شماره ثبت زمین|Tapu Kayıt No.
Floor|طبقه|Kat
Flooring Type|نوع کف‌پوش|Zemin Türü
Facility|امکانات|Olanaklar
`;
const dictionaries = { en: {}, fa: {}, tr: {} };
for (const row of rows.trim().split('\n')) {
  const [en, fa, tr] = row.split('|'); dictionaries.fa[en] = fa; dictionaries.tr[en] = tr;
}
const special = {
  'Failed to fetch data': ['دریافت اطلاعات ناموفق بود', 'Veriler alınamadı'],
  'An error occurred while processing your request.': ['پردازش درخواست ناموفق بود.', 'İsteğiniz işlenirken bir hata oluştu.'],
  'Phone number is invalid': ['شماره تلفن معتبر نیست', 'Telefon numarası geçersiz'],
  'Empty or invalid CSV file': ['فایل داده خالی یا نامعتبر است', 'CSV dosyası boş veya geçersiz'],
  'Empty or invalid XLSX file': ['فایل صفحه‌گسترده خالی یا نامعتبر است', 'XLSX dosyası boş veya geçersiz'],
  'file Download successful': ['فایل با موفقیت دریافت شد', 'Dosya başarıyla indirildi'],
  'file Not Found': ['فایل یافت نشد', 'Dosya bulunamadı'],
  'Please select an authorized recipient': ['گیرنده مجاز را انتخاب کنید', 'Yetkili bir alıcı seçin'],
  'Invalid email format': ['قالب ایمیل معتبر نیست', 'E-posta biçimi geçersiz'],
  'Name can only contain letters, numbers, underscores, and dashes': ['نام فقط می‌تواند شامل حروف، اعداد، زیرخط و خط تیره باشد', 'Ad yalnızca harf, sayı, alt çizgi ve kısa çizgi içerebilir'],
  'File Name Must Be At Least 2 Characters': ['نام فایل باید دست‌کم ۲ نویسه باشد', 'Dosya adı en az 2 karakter olmalıdır'],
  'Email must be a valid email': ['نشانی ایمیل معتبر وارد کنید', 'Geçerli bir e-posta adresi girin'],
  'Enter a valid Email Address': ['نشانی ایمیل معتبر وارد کنید', 'Geçerli bir e-posta adresi girin'],
  'Office Number must be exactly 10 digits': ['شماره دفتر باید ۱۰ رقم باشد', 'Ofis numarası 10 haneli olmalıdır'],
  'Shipping Postal Code must be exactly 6 digits': ['کد پستی تحویل باید ۶ رقم باشد', 'Teslimat posta kodu 6 haneli olmalıdır'],
  'Billing Postal Code must be exactly 6 digits': ['کد پستی صورتحساب باید ۶ رقم باشد', 'Fatura posta kodu 6 haneli olmalıdır'],
  'Accepted File Type (csv, xlsx file - 15MB max) only 1 file': ['یک فایل داده یا صفحه‌گسترده، حداکثر ۱۵ مگابایت', 'Bir CSV veya XLSX dosyası, en fazla 15 MB'],
  'Accepted File Types (Images files - 15MB max) only 1 file': ['یک تصویر، حداکثر ۱۵ مگابایت', 'Bir resim dosyası, en fazla 15 MB'],
  'Accepted File Types (Images files - 15MB max) only 10 files': ['حداکثر ۱۰ تصویر، هر فایل حداکثر ۱۵ مگابایت', 'En fazla 10 resim, dosya başına en fazla 15 MB'],
  'Accepted File Types (Images, PDFs, Word docs, Powerpoint, Excel, ZIP, and video files - 15MB max)': ['تصویر، سند، ارائه، صفحه‌گسترده، فایل فشرده یا ویدئو؛ حداکثر ۱۵ مگابایت', 'Resim, PDF, belge, sunum, tablo, ZIP veya video; en fazla 15 MB'],
  'From Lead Score is invalid': ['امتیاز آغاز لید معتبر نیست', 'Başlangıç aday puanı geçersiz'],
  'To Lead Score must be greater than or equal to From Lead Score': ['امتیاز پایان باید حداقل برابر با امتیاز آغاز باشد', 'Bitiş puanı başlangıç puanından küçük olamaz'],
  'Explore our utilities pages': ['صفحات ابزارها را بررسی کنید', 'Araç sayfalarımızı keşfedin'],
  'View user\'s in': ['نمایش کاربران در', 'Kullanıcıları görüntüle'],
  'Element with ID \'reports\' not found.': ['بخش گزارش یافت نشد.', 'Rapor alanı bulunamadı.'],
  'total amount due must be no more than ₹999,999.99.': ['مبلغ از حداکثر مجاز بیشتر است.', 'Tutar izin verilen üst sınırı aşıyor.'],
  'This is an example of a simple PDF document created using @react-pdf/renderer.': ['این یک نمونه سند پی‌دی‌اف است.', 'Bu basit bir PDF belgesi örneğidir.'],
  'You can add more text, images, and other elements to your PDF document.': ['می‌توانید متن و تصویر بیشتری به سند اضافه کنید.', 'Belgenize daha fazla metin ve resim ekleyebilirsiniz.'],
  'Improve your development process and start doing more with Horizon UI PRO!': ['با نسخه حرفه‌ای امکانات بیشتری دریافت کنید.', 'Profesyonel sürümle daha fazla özelliğe erişin.'],
};
for (const [key, values] of Object.entries(special)) { dictionaries.fa[key] = values[0]; dictionaries.tr[key] = values[1]; }
export const aliases = {
  Account: 'Partner Customers', Accounts: 'Partner Customers', 'Account Name': 'Partner Customer', 'AccountName': 'Partner Customer',
  'AccountNumber': 'Account Number', 'BankDetails': 'Bank Details', 'SwiftCode': 'Swift Code',
  'Realeted To': 'Related To', 'Value Propositon': 'Value Proposition', 'Existing Bussiness': 'Existing Business', 'New Bussiness': 'New Business',
  'Valid Untile': 'Valid Until', 'Quotes Number': 'Quote Number', 'Date & time': 'Date Time', 'Date & Time': 'Date Time', 'Date&Time': 'Date Time', 'DateTime': 'Date Time',
  'Time Stamp': 'Timestamp', 'time stamp': 'Timestamp', 'times tamp': 'Timestamp', 'Create By': 'Created By', 'create By': 'Created By', 'CreateBy Name': 'Created By',
  'Task createBy': 'Task Create By', 'assignment To': 'Assigned To', 'FormikType': 'Formik Type', 'formik type': 'Formik Type',
  'Phonenumber': 'Phone Number', 'Opprtunities': 'Opportunities', 'Opprotunities': 'Opportunities', 'Attendes': 'Attendees', 'attendes': 'Attendees',
  'Send text Msg': 'Text Message', 'Please select an authorized to': 'Please select an authorized recipient', 'Enter Message Hear': 'Enter Message',
  'Please Select': 'Select', 'Select associated listing': 'Select Associated Listing', 'error': 'estate.serverError',
  'Failed to fetch users data:': 'Failed to fetch data', 'Error fetching data:': 'Failed to fetch data', 'Error decoding token:': 'estate.unauthorized',
  'Sc': 'Send Email', 'cc': 'CC', 'Bcc': 'BCC', 'bcc': 'BCC', 'Pr': 'Print as PDF',
  'slider-ex-1': 'Rating', 'Please Select Module': 'Select Module',
};
Object.assign(dictionaries.fa, { CC: 'رونوشت', BCC: 'رونوشت مخفی', USD: 'دلار آمریکا', ETH: 'اتر', Prolink: 'پرولینک' });
Object.assign(dictionaries.tr, { CC: 'Bilgi', BCC: 'Gizli Bilgi', USD: 'ABD Doları', ETH: 'Ether' });
export default dictionaries;
