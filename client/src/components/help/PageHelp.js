import {
  Box,
  Button,
  Flex,
  Heading,
  Icon,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  Tooltip,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import React from "react";
import { MdHelpOutline } from "react-icons/md";
import { useLanguage } from "i18n";

const helpContent = {
  Dashboard: {
    en: {
      title: "Dashboard guide",
      purpose:
        "The dashboard gives you a quick overview of your CRM activity, including tasks, contacts, leads, properties, charts, and recent performance numbers.",
      actions:
        "Use the statistic cards to open each module, review email and call reports, compare module totals, and follow lead or task status from one place.",
    },
    fa: {
      title: "راهنمای داشبورد",
      purpose:
        "داشبورد یک نمای سریع از فعالیت‌های CRM شما نشان می‌دهد؛ مثل وظایف، مخاطب‌ها، لیدها، املاک، نمودارها و آمار عملکرد.",
      actions:
        "از کارت‌های آماری برای ورود به هر ماژول، بررسی گزارش ایمیل و تماس، مقایسه تعداد داده‌ها و پیگیری وضعیت لیدها و وظایف استفاده کنید.",
    },
    tr: {
      title: "Panel rehberi",
      purpose:
        "Panel; görevler, kişiler, adaylar, mülkler, grafikler ve performans sayıları dahil CRM etkinliğinize hızlı bir genel bakış sağlar.",
      actions:
        "İstatistik kartlarıyla modüllere gidebilir, e-posta ve arama raporlarını inceleyebilir, modül toplamlarını karşılaştırabilir ve aday/görev durumlarını takip edebilirsiniz.",
    },
  },
  Leads: {
    en: {
      title: "Leads guide",
      purpose:
        "This page is for managing potential customers before they become confirmed contacts or deals.",
      actions:
        "Create leads, import lists, search and filter records, update lead status, open lead details, and track follow-up activity.",
    },
    fa: {
      title: "راهنمای لیدها",
      purpose:
        "این صفحه برای مدیریت مشتریان بالقوه قبل از تبدیل شدن به مخاطب یا معامله قطعی استفاده می‌شود.",
      actions:
        "می‌توانید لید جدید بسازید، لیست وارد کنید، جستجو و فیلتر انجام دهید، وضعیت لید را تغییر دهید، جزئیات را ببینید و پیگیری‌ها را مدیریت کنید.",
    },
    tr: {
      title: "Adaylar rehberi",
      purpose:
        "Bu sayfa, kesin kişi veya anlaşmaya dönüşmeden önce potansiyel müşterileri yönetmek için kullanılır.",
      actions:
        "Aday oluşturabilir, liste içe aktarabilir, arama ve filtreleme yapabilir, aday durumunu güncelleyebilir, detayları açabilir ve takipleri yönetebilirsiniz.",
    },
  },
  Contacts: {
    en: {
      title: "Contacts guide",
      purpose:
        "Contacts stores people you communicate with, including customers, prospects, and related decision makers.",
      actions:
        "Add or import contacts, edit contact information, view history, connect records to properties or leads, and use search to find the right person quickly.",
    },
    fa: {
      title: "راهنمای مخاطب‌ها",
      purpose:
        "مخاطب‌ها محل نگهداری اطلاعات افرادی است که با آن‌ها در ارتباط هستید؛ مثل مشتری‌ها، مشتریان بالقوه و تصمیم‌گیرنده‌ها.",
      actions:
        "می‌توانید مخاطب اضافه یا وارد کنید، اطلاعات را ویرایش کنید، سابقه را ببینید، رکوردها را به ملک یا لید وصل کنید و با جستجو سریع‌تر فرد موردنظر را پیدا کنید.",
    },
    tr: {
      title: "Kişiler rehberi",
      purpose:
        "Kişiler sayfası; müşteriler, potansiyeller ve karar vericiler gibi iletişim kurduğunuz kişileri saklar.",
      actions:
        "Kişi ekleyebilir veya içe aktarabilir, bilgileri düzenleyebilir, geçmişi görebilir, kayıtları mülk ya da adaylarla ilişkilendirebilir ve aramayla doğru kişiyi hızlıca bulabilirsiniz.",
    },
  },
  Properties: {
    en: {
      title: "Properties guide",
      purpose:
        "Properties is where real estate units and property records are stored and managed.",
      actions:
        "Add properties, upload photos or documents, manage property details, update availability, import records, and open each property profile.",
    },
    fa: {
      title: "راهنمای املاک",
      purpose:
        "صفحه املاک برای نگهداری و مدیریت واحدها و رکوردهای ملکی استفاده می‌شود.",
      actions:
        "می‌توانید ملک اضافه کنید، عکس یا سند بارگذاری کنید، جزئیات ملک را مدیریت کنید، وضعیت موجودی را تغییر دهید، داده وارد کنید و پروفایل هر ملک را باز کنید.",
    },
    tr: {
      title: "Mülkler rehberi",
      purpose:
        "Mülkler sayfası, gayrimenkul birimlerini ve mülk kayıtlarını saklamak ve yönetmek için kullanılır.",
      actions:
        "Mülk ekleyebilir, fotoğraf veya belge yükleyebilir, detayları yönetebilir, uygunluk durumunu güncelleyebilir, kayıt içe aktarabilir ve mülk profilini açabilirsiniz.",
    },
  },
  Opportunities: {
    en: {
      title: "Opportunities guide",
      purpose:
        "Opportunities helps you manage active sales chances and follow each deal through the pipeline.",
      actions:
        "Create opportunities, connect them to accounts or contacts, update stage and value, import records, and review the details of each opportunity.",
    },
    fa: {
      title: "راهنمای فرصت‌ها",
      purpose:
        "فرصت‌ها برای مدیریت موقعیت‌های فروش فعال و پیگیری هر معامله در مسیر فروش استفاده می‌شود.",
      actions:
        "می‌توانید فرصت بسازید، آن را به حساب یا مخاطب وصل کنید، مرحله و ارزش را تغییر دهید، داده وارد کنید و جزئیات هر فرصت را بررسی کنید.",
    },
    tr: {
      title: "Fırsatlar rehberi",
      purpose:
        "Fırsatlar, aktif satış ihtimallerini yönetmenize ve her anlaşmayı satış hattında takip etmenize yardımcı olur.",
      actions:
        "Fırsat oluşturabilir, hesap veya kişilerle bağlayabilir, aşama ve değeri güncelleyebilir, kayıt içe aktarabilir ve detayları inceleyebilirsiniz.",
    },
  },
  "Partner Customers": {
    en: {
      title: "Partner customers guide",
      purpose:
        "Partner customers represent people or companies who buy properties through a business partner.",
      actions:
        "Add, search, filter, edit, and review partner customers and their related property purchases.",
    },
    fa: {
      title: "راهنمای مشتریان همکار",
      purpose:
        "مشتریان همکار اشخاص یا شرکت‌هایی هستند که از طریق یک شریک تجاری ملک خریداری می‌کنند.",
      actions:
        "می‌توانید مشتری همکار اضافه کنید، جستجو و فیلتر انجام دهید و اطلاعات و خریدهای مرتبط را بررسی کنید.",
    },
    tr: {
      title: "İş ortağı müşterileri rehberi",
      purpose:
        "İş ortağı müşterileri, bir iş ortağı üzerinden gayrimenkul satın alan kişi veya şirketleri temsil eder.",
      actions:
        "İş ortağı müşterisi ekleyebilir, arayabilir, filtreleyebilir, düzenleyebilir ve ilişkili satın alımları inceleyebilirsiniz.",
    },
  },
  Invoices: {
    en: {
      title: "Invoices guide",
      purpose:
        "Invoices is used to create and track billing documents for customers and deals.",
      actions:
        "Create invoices, import invoice data, review invoice status, preview records, and keep payment-related information organized.",
    },
    fa: {
      title: "راهنمای فاکتورها",
      purpose:
        "فاکتورها برای ایجاد و پیگیری اسناد مالی مربوط به مشتری‌ها و معاملات استفاده می‌شود.",
      actions:
        "می‌توانید فاکتور بسازید، داده وارد کنید، وضعیت فاکتور را بررسی کنید، پیش‌نمایش بگیرید و اطلاعات مالی را مرتب نگه دارید.",
    },
    tr: {
      title: "Faturalar rehberi",
      purpose:
        "Faturalar, müşteriler ve anlaşmalar için ödeme belgeleri oluşturmak ve takip etmek için kullanılır.",
      actions:
        "Fatura oluşturabilir, fatura verisi içe aktarabilir, durumu kontrol edebilir, kayıtları önizleyebilir ve ödeme bilgilerini düzenli tutabilirsiniz.",
    },
  },
  Tasks: {
    en: {
      title: "Tasks guide",
      purpose:
        "Tasks helps you plan, assign, and follow work that needs to be completed.",
      actions:
        "Create tasks, set dates and priorities, assign work to users or records, update status, and use filters to focus on pending or completed work.",
    },
    fa: {
      title: "راهنمای وظایف",
      purpose:
        "وظایف برای برنامه‌ریزی، واگذاری و پیگیری کارهایی است که باید انجام شوند.",
      actions:
        "می‌توانید وظیفه بسازید، تاریخ و اولویت تعیین کنید، کار را به کاربر یا رکورد مرتبط وصل کنید، وضعیت را تغییر دهید و با فیلترها روی کارهای در انتظار یا تکمیل‌شده تمرکز کنید.",
    },
    tr: {
      title: "Görevler rehberi",
      purpose:
        "Görevler, tamamlanması gereken işleri planlamanıza, atamanıza ve takip etmenize yardımcı olur.",
      actions:
        "Görev oluşturabilir, tarih ve öncelik belirleyebilir, işi kullanıcıya veya kayda bağlayabilir, durumu güncelleyebilir ve filtrelerle bekleyen ya da tamamlanan işlere odaklanabilirsiniz.",
    },
  },
  Meetings: {
    en: {
      title: "Meetings guide",
      purpose:
        "Meetings keeps scheduled appointments and meeting records connected to your CRM workflow.",
      actions:
        "Add meetings, set dates, connect participants or records, view meeting details, and keep follow-ups visible.",
    },
    fa: {
      title: "راهنمای جلسات",
      purpose:
        "جلسات برای نگهداری قرارها و سوابق جلسه در جریان کاری CRM استفاده می‌شود.",
      actions:
        "می‌توانید جلسه اضافه کنید، تاریخ تعیین کنید، شرکت‌کننده‌ها یا رکوردهای مرتبط را وصل کنید، جزئیات را ببینید و پیگیری‌ها را نگه دارید.",
    },
    tr: {
      title: "Toplantılar rehberi",
      purpose:
        "Toplantılar, CRM sürecinizdeki randevu ve toplantı kayıtlarını tutar.",
      actions:
        "Toplantı ekleyebilir, tarih belirleyebilir, katılımcı veya kayıtları bağlayabilir, detayları görebilir ve takipleri görünür tutabilirsiniz.",
    },
  },
  Calls: {
    en: {
      title: "Calls guide",
      purpose:
        "Calls records phone communication with leads, contacts, and customers.",
      actions:
        "Log calls, connect them to the right person or record, review call history, and use filters to find previous conversations.",
    },
    fa: {
      title: "راهنمای تماس‌ها",
      purpose:
        "تماس‌ها برای ثبت ارتباط تلفنی با لیدها، مخاطب‌ها و مشتری‌ها استفاده می‌شود.",
      actions:
        "می‌توانید تماس ثبت کنید، آن را به فرد یا رکورد درست وصل کنید، سابقه تماس را ببینید و با فیلترها مکالمه‌های قبلی را پیدا کنید.",
    },
    tr: {
      title: "Aramalar rehberi",
      purpose:
        "Aramalar, adaylar, kişiler ve müşterilerle yapılan telefon iletişimini kaydeder.",
      actions:
        "Arama kaydedebilir, doğru kişi veya kayda bağlayabilir, arama geçmişini inceleyebilir ve filtrelerle önceki görüşmeleri bulabilirsiniz.",
    },
  },
  Emails: {
    en: {
      title: "Emails guide",
      purpose:
        "Emails stores email activity and communication history across CRM records.",
      actions:
        "Create or review emails, connect messages to contacts or leads, inspect history, and search for past communication.",
    },
    fa: {
      title: "راهنمای ایمیل‌ها",
      purpose:
        "ایمیل‌ها محل نگهداری فعالیت‌ها و سابقه ارتباط ایمیلی در رکوردهای CRM است.",
      actions:
        "می‌توانید ایمیل بسازید یا بررسی کنید، پیام‌ها را به مخاطب یا لید وصل کنید، سابقه را ببینید و ارتباط‌های قبلی را جستجو کنید.",
    },
    tr: {
      title: "E-postalar rehberi",
      purpose:
        "E-postalar, CRM kayıtlarındaki e-posta etkinliğini ve iletişim geçmişini saklar.",
      actions:
        "E-posta oluşturabilir veya inceleyebilir, mesajları kişi ya da adaylara bağlayabilir, geçmişi görebilir ve eski iletişimleri arayabilirsiniz.",
    },
  },
  "Email Template": {
    en: {
      title: "Email template guide",
      purpose:
        "Email templates let you prepare reusable messages for common CRM communication.",
      actions:
        "Create templates, edit message content, preview saved templates, and reuse them when sending emails.",
    },
    fa: {
      title: "راهنمای قالب ایمیل",
      purpose:
        "قالب ایمیل برای آماده‌سازی پیام‌های قابل استفاده مجدد در ارتباط‌های رایج CRM است.",
      actions:
        "می‌توانید قالب بسازید، متن پیام را ویرایش کنید، قالب‌های ذخیره‌شده را ببینید و هنگام ارسال ایمیل دوباره استفاده کنید.",
    },
    tr: {
      title: "E-posta şablonu rehberi",
      purpose:
        "E-posta şablonları, sık kullanılan CRM mesajlarını yeniden kullanılabilir şekilde hazırlamanızı sağlar.",
      actions:
        "Şablon oluşturabilir, içerik düzenleyebilir, kayıtlı şablonları önizleyebilir ve e-posta gönderirken yeniden kullanabilirsiniz.",
    },
  },
  Calender: {
    en: {
      title: "Calendar guide",
      purpose:
        "The calendar shows scheduled tasks, meetings, and dates in a time-based view.",
      actions:
        "Review upcoming work, open events, check daily planning, and keep time-sensitive CRM activity organized.",
    },
    fa: {
      title: "راهنمای تقویم",
      purpose:
        "تقویم وظایف، جلسات و تاریخ‌های برنامه‌ریزی‌شده را در یک نمای زمانی نشان می‌دهد.",
      actions:
        "می‌توانید کارهای آینده را ببینید، رویدادها را باز کنید، برنامه روزانه را بررسی کنید و فعالیت‌های زمان‌دار CRM را مرتب نگه دارید.",
    },
    tr: {
      title: "Takvim rehberi",
      purpose:
        "Takvim; görevleri, toplantıları ve planlanan tarihleri zaman bazlı bir görünümde gösterir.",
      actions:
        "Yaklaşan işleri inceleyebilir, etkinlikleri açabilir, günlük planı kontrol edebilir ve zamana bağlı CRM etkinliklerini düzenli tutabilirsiniz.",
    },
  },
  "Admin Setting": {
    en: {
      title: "Admin setting guide",
      purpose:
        "Admin settings contains configuration tools for controlling how the CRM works.",
      actions:
        "Use this area to reach setup pages such as custom fields, module settings, validations, images, and table fields.",
    },
    fa: {
      title: "راهنمای تنظیمات مدیریت",
      purpose:
        "تنظیمات مدیریت شامل ابزارهای پیکربندی برای کنترل رفتار CRM است.",
      actions:
        "از این بخش برای دسترسی به نقش‌ها، فیلدهای سفارشی، تنظیمات ماژول‌ها، اعتبارسنجی‌ها، تصاویر و فیلدهای جدول استفاده کنید.",
    },
    tr: {
      title: "Yönetici ayarları rehberi",
      purpose:
        "Yönetici ayarları, CRM'in nasıl çalışacağını kontrol eden yapılandırma araçlarını içerir.",
      actions:
        "Roller, özel alanlar, modül ayarları, doğrulamalar, görseller ve tablo alanları gibi kurulum sayfalarına buradan ulaşabilirsiniz.",
    },
  },
  Roles: {
    en: {
      title: "Roles guide",
      purpose:
        "Roles controls what each user group can view, create, update, or delete.",
      actions:
        "Access is managed from the Users page with the fixed admin and user roles.",
    },
    fa: {
      title: "راهنمای نقش‌ها",
      purpose:
        "نقش‌ها مشخص می‌کنند هر گروه کاربری چه چیزهایی را می‌تواند ببیند، بسازد، ویرایش یا حذف کند.",
      actions:
        "می‌توانید نقش بسازید، دسترسی‌ها را ویرایش کنید، کاربرها را اختصاص دهید و قبل از دادن مجوز، سطح دسترسی را بررسی کنید.",
    },
    tr: {
      title: "Roller rehberi",
      purpose:
        "Roller, her kullanıcı grubunun neleri görüntüleyebileceğini, oluşturabileceğini, güncelleyebileceğini veya silebileceğini belirler.",
      actions:
        "Rol oluşturabilir, izinleri düzenleyebilir, kullanıcı atayabilir ve CRM yetkisi vermeden önce erişimi kontrol edebilirsiniz.",
    },
  },
  "Custom Fields": {
    en: {
      title: "Custom fields guide",
      purpose:
        "Custom fields lets you add extra fields to modules so the CRM matches your company workflow.",
      actions:
        "Create fields, choose the module, set field type and labels, and control what extra information users can save.",
    },
    fa: {
      title: "راهنمای فیلدهای سفارشی",
      purpose:
        "فیلدهای سفارشی به شما اجازه می‌دهد فیلدهای اضافی به ماژول‌ها اضافه کنید تا CRM با روند کاری شرکت هماهنگ شود.",
      actions:
        "می‌توانید فیلد بسازید، ماژول را انتخاب کنید، نوع و عنوان فیلد را مشخص کنید و اطلاعات اضافی قابل ذخیره را کنترل کنید.",
    },
    tr: {
      title: "Özel alanlar rehberi",
      purpose:
        "Özel alanlar, CRM'in şirket iş akışınıza uyum sağlaması için modüllere ek alanlar eklemenizi sağlar.",
      actions:
        "Alan oluşturabilir, modül seçebilir, alan türü ve etiketleri belirleyebilir ve kullanıcıların kaydedeceği ek bilgileri kontrol edebilirsiniz.",
    },
  },
  "Change Images": {
    en: {
      title: "Change images guide",
      purpose:
        "Change Images manages CRM branding and uploaded interface images.",
      actions:
        "Upload images, activate the image that should appear in the system, and keep branding assets updated.",
    },
    fa: {
      title: "راهنمای تغییر تصاویر",
      purpose:
        "تغییر تصاویر برای مدیریت برندینگ CRM و تصاویر بارگذاری‌شده رابط کاربری است.",
      actions:
        "می‌توانید تصویر بارگذاری کنید، تصویر فعال سیستم را مشخص کنید و دارایی‌های برندینگ را به‌روز نگه دارید.",
    },
    tr: {
      title: "Görselleri değiştirme rehberi",
      purpose:
        "Görselleri değiştirme sayfası, CRM marka görsellerini ve arayüz resimlerini yönetir.",
      actions:
        "Görsel yükleyebilir, sistemde görünecek aktif görseli seçebilir ve marka varlıklarını güncel tutabilirsiniz.",
    },
  },
  Validation: {
    en: {
      title: "Validation guide",
      purpose:
        "Validation controls rules that keep CRM data consistent and complete.",
      actions:
        "Add or edit validation rules, review existing rules, and use them to reduce incorrect or incomplete records.",
    },
    fa: {
      title: "راهنمای اعتبارسنجی",
      purpose:
        "اعتبارسنجی قوانین لازم برای کامل و منظم ماندن داده‌های CRM را کنترل می‌کند.",
      actions:
        "می‌توانید قوانین اعتبارسنجی اضافه یا ویرایش کنید، قوانین موجود را بررسی کنید و از ثبت داده ناقص یا اشتباه جلوگیری کنید.",
    },
    tr: {
      title: "Doğrulama rehberi",
      purpose:
        "Doğrulama, CRM verilerinin tutarlı ve eksiksiz kalmasını sağlayan kuralları kontrol eder.",
      actions:
        "Doğrulama kuralları ekleyebilir veya düzenleyebilir, mevcut kuralları inceleyebilir ve hatalı ya da eksik kayıtları azaltabilirsiniz.",
    },
  },
  "Table Fields": {
    en: {
      title: "Table fields guide",
      purpose:
        "Table Fields controls which fields can appear in module tables.",
      actions:
        "Manage table columns, adjust visible fields, and make list pages easier for users to scan.",
    },
    fa: {
      title: "راهنمای فیلدهای جدول",
      purpose:
        "فیلدهای جدول مشخص می‌کند چه فیلدهایی در جدول‌های ماژول‌ها نمایش داده شوند.",
      actions:
        "می‌توانید ستون‌های جدول را مدیریت کنید، فیلدهای قابل نمایش را تنظیم کنید و خواندن لیست‌ها را برای کاربران ساده‌تر کنید.",
    },
    tr: {
      title: "Tablo alanları rehberi",
      purpose:
        "Tablo Alanları, modül tablolarında hangi alanların görüneceğini kontrol eder.",
      actions:
        "Tablo sütunlarını yönetebilir, görünür alanları ayarlayabilir ve liste sayfalarını kullanıcılar için daha okunabilir hale getirebilirsiniz.",
    },
  },
  "Active Deactive Module": {
    en: {
      title: "Module activation guide",
      purpose:
        "This page controls which CRM modules are active and visible in the system.",
      actions:
        "Enable or disable modules carefully so users only see the parts of the CRM your company wants to use.",
    },
    fa: {
      title: "راهنمای فعال/غیرفعال کردن ماژول",
      purpose:
        "این صفحه کنترل می‌کند کدام ماژول‌های CRM فعال و در سیستم قابل استفاده باشند.",
      actions:
        "ماژول‌ها را با دقت فعال یا غیرفعال کنید تا کاربران فقط بخش‌هایی را ببینند که شرکت قصد استفاده از آن‌ها را دارد.",
    },
    tr: {
      title: "Modül etkinleştirme rehberi",
      purpose:
        "Bu sayfa, CRM modüllerinin hangilerinin aktif ve görünür olacağını kontrol eder.",
      actions:
        "Modülleri dikkatli şekilde etkinleştirin veya pasifleştirin; kullanıcılar yalnızca şirketin kullanacağı bölümleri görsün.",
    },
  },
  Module: {
    en: {
      title: "Module guide",
      purpose:
        "Module settings lets admins create or manage CRM modules and their navigation behavior.",
      actions:
        "Add modules, update module names or icons, and keep custom navigation aligned with your CRM setup.",
    },
    fa: {
      title: "راهنمای ماژول",
      purpose:
        "تنظیمات ماژول به مدیرها اجازه می‌دهد ماژول‌های CRM و رفتار نمایش آن‌ها در منو را مدیریت کنند.",
      actions:
        "می‌توانید ماژول اضافه کنید، نام یا آیکون را تغییر دهید و منوی سفارشی CRM را با نیاز شرکت هماهنگ نگه دارید.",
    },
    tr: {
      title: "Modül rehberi",
      purpose:
        "Modül ayarları, yöneticilerin CRM modüllerini ve menü davranışını yönetmesini sağlar.",
      actions:
        "Modül ekleyebilir, modül adı veya ikonunu güncelleyebilir ve özel menüyü CRM kurulumunuzla uyumlu tutabilirsiniz.",
    },
  },
  Documents: {
    en: {
      title: "Documents guide",
      purpose:
        "Documents keeps uploaded files and links related to CRM activity.",
      actions:
        "Upload documents, organize files, add links, delete old records, and find important files when working with customers or properties.",
    },
    fa: {
      title: "راهنمای اسناد",
      purpose:
        "اسناد محل نگهداری فایل‌ها و لینک‌های مرتبط با فعالیت‌های CRM است.",
      actions:
        "می‌توانید سند بارگذاری کنید، فایل‌ها را مرتب کنید، لینک اضافه کنید، رکوردهای قدیمی را حذف کنید و فایل‌های مهم مربوط به مشتری یا ملک را پیدا کنید.",
    },
    tr: {
      title: "Belgeler rehberi",
      purpose:
        "Belgeler, CRM etkinlikleriyle ilişkili yüklenen dosya ve bağlantıları saklar.",
      actions:
        "Belge yükleyebilir, dosyaları düzenleyebilir, bağlantı ekleyebilir, eski kayıtları silebilir ve müşteri ya da mülklerle çalışırken önemli dosyaları bulabilirsiniz.",
    },
  },
  "Reporting and Analytics": {
    en: {
      title: "Reporting and analytics guide",
      purpose:
        "Reporting and Analytics helps you understand CRM activity through charts and module reports.",
      actions:
        "Review email and call reports, compare data over time, analyze module performance, and use the reports to decide where follow-up is needed.",
    },
    fa: {
      title: "راهنمای گزارش‌ها و تحلیل‌ها",
      purpose:
        "گزارش‌ها و تحلیل‌ها به شما کمک می‌کند فعالیت‌های CRM را با نمودار و گزارش ماژول‌ها بهتر بفهمید.",
      actions:
        "می‌توانید گزارش ایمیل و تماس را ببینید، داده‌ها را در بازه‌های زمانی مقایسه کنید، عملکرد ماژول‌ها را تحلیل کنید و برای پیگیری تصمیم بگیرید.",
    },
    tr: {
      title: "Raporlama ve analitik rehberi",
      purpose:
        "Raporlama ve Analitik, CRM etkinliğini grafikler ve modül raporlarıyla anlamanıza yardımcı olur.",
      actions:
        "E-posta ve arama raporlarını inceleyebilir, verileri zaman içinde karşılaştırabilir, modül performansını analiz edebilir ve takip gereken alanları belirleyebilirsiniz.",
    },
  },
  Users: {
    en: {
      title: "Users guide",
      purpose:
        "Users is where admins manage people who can sign in and work inside the CRM.",
      actions:
        "Create users, edit profile information, choose admin or user access, review user details, and keep access organized.",
    },
    fa: {
      title: "راهنمای کاربران",
      purpose:
        "کاربران جایی است که مدیرها افراد دارای دسترسی به CRM را مدیریت می‌کنند.",
      actions:
        "می‌توانید کاربر بسازید، اطلاعات پروفایل را ویرایش کنید، نقش اختصاص دهید، جزئیات کاربر را ببینید و دسترسی‌ها را مرتب نگه دارید.",
    },
    tr: {
      title: "Kullanıcılar rehberi",
      purpose:
        "Kullanıcılar, yöneticilerin CRM'e giriş yapıp çalışabilecek kişileri yönettiği bölümdür.",
      actions:
        "Kullanıcı oluşturabilir, profil bilgilerini düzenleyebilir, rol atayabilir, kullanıcı detaylarını inceleyebilir ve erişimi düzenli tutabilirsiniz.",
    },
  },
};

const fallbackContent = {
  en: {
    title: "Page guide",
    purpose:
      "This page is part of your CRM workspace and is used to view, manage, and organize business records.",
    actions:
      "Use the available buttons, filters, tables, and forms on this page to manage the information your team needs.",
  },
  fa: {
    title: "راهنمای صفحه",
    purpose:
      "این صفحه بخشی از فضای کاری CRM شماست و برای مشاهده، مدیریت و مرتب‌سازی رکوردهای کاری استفاده می‌شود.",
    actions:
      "از دکمه‌ها، فیلترها، جدول‌ها و فرم‌های همین صفحه برای مدیریت اطلاعات موردنیاز تیم استفاده کنید.",
  },
  tr: {
    title: "Sayfa rehberi",
    purpose:
      "Bu sayfa CRM çalışma alanınızın bir parçasıdır ve iş kayıtlarını görüntülemek, yönetmek ve düzenlemek için kullanılır.",
    actions:
      "Ekibinizin ihtiyaç duyduğu bilgileri yönetmek için bu sayfadaki düğmeleri, filtreleri, tabloları ve formları kullanın.",
  },
};

export default function PageHelp({ route, activeRouteName }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { language, t } = useLanguage();
  const pageName = (route?.parentName || route?.name || activeRouteName || "").trim();
  const contentGroup = helpContent[pageName] || fallbackContent;
  const content = contentGroup[language] || contentGroup.en;
  const modalBg = useColorModeValue("white", "navy.800");
  const sectionBg = useColorModeValue("secondaryGray.100", "whiteAlpha.100");
  const textColor = useColorModeValue("secondaryGray.900", "white");
  const mutedColor = useColorModeValue("secondaryGray.700", "secondaryGray.200");
  const borderColor = useColorModeValue("secondaryGray.200", "whiteAlpha.200");
  const accentBg = useColorModeValue("brand.50", "whiteAlpha.100");

  if (!pageName || pageName === "Sign In") return null;

  return (
    <>
      <Flex justifyContent="flex-end" mb="14px">
        <Tooltip label={t("Help")} hasArrow placement="left">
          <IconButton
            aria-label={t("Help")}
            icon={<Icon as={MdHelpOutline} w="18px" h="18px" />}
            onClick={onOpen}
            size="sm"
            minW="34px"
            h="34px"
            borderRadius="10px"
            colorScheme="brand"
            variant="solid"
          />
        </Tooltip>
      </Flex>

      <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
        <ModalOverlay />
        <ModalContent bg={modalBg} dir="ltr">
          <ModalHeader color={textColor} textAlign="left" paddingRight="48px">
            {content.title}
          </ModalHeader>
          <ModalCloseButton right="12px" />
          <ModalBody>
            <Box
              bg={accentBg}
              border="1px solid"
              borderColor={borderColor}
              borderRadius="10px"
              p={4}
              mb={4}
            >
              <Text color={mutedColor} fontSize="sm" fontWeight={700} mb={2}>
                {t("Current page")}
              </Text>
              <Heading color={textColor} size="md">
                {t(pageName)}
              </Heading>
            </Box>

            <Box bg={sectionBg} borderRadius="10px" p={4} mb={3}>
              <Text color={textColor} fontWeight={800} mb={2}>
                {t("What is this page for?")}
              </Text>
              <Text color={mutedColor} lineHeight="1.9">
                {content.purpose}
              </Text>
            </Box>

            <Box bg={sectionBg} borderRadius="10px" p={4}>
              <Text color={textColor} fontWeight={800} mb={2}>
                {t("What can the user do here?")}
              </Text>
              <Text color={mutedColor} lineHeight="1.9">
                {content.actions}
              </Text>
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="brand" onClick={onClose}>
              {t("Close")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
