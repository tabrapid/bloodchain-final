# BloodChain maxfiylik siyosati — o‘zbekcha ishchi loyiha

**DRAFT — e’lon qilish yoki rozilik olish uchun tasdiqlanmagan.** Operator yuridik
shaxsi hali tashkil etilmagan. Quyidagi matn tasdiqlangan operator rekvizitlari,
ishlov berish asoslari, xizmat ko‘rsatuvchilar va saqlash jadvali bilan
to‘ldirilgach, tegishli ko‘rib chiqishdan o‘tkaziladi. Kuchga kirish sanasi va
tasdiqlangan versiya hali belgilanmagan.

## 1. Mas’ul tashkilot va aloqa

Platforma operatori: **[rasmiy nom, STIR, manzil va vakolatli vakil]**.
Maxfiylik murojaatlari: **[operator tayinlagan aloqa kanali]**.
Tibbiyot muassasasi bilan platformaning ma’lumotlarga ishlov berishdagi rollari
tegishli shartnomada belgilanadi. Loyiha egasining shaxsiy emaili avtomatik
ravishda ommaviy maxfiylik kontakti hisoblanmaydi.

## 2. Qaysi ma’lumotlar va nima uchun

- Hisob ma’lumotlari: ism, aloqa ma’lumotlari, parol xeshi va hisob holati —
  tizimga kirish va hisobni boshqarish uchun.
- Donor profili, qon guruhi va tekshiruv holati, qabul/donorlik tarixi,
  tasdiqlangan laboratoriya natijalari — muassasaning ruxsat etilgan jarayonlari
  va foydalanuvchining o‘z ma’lumotlarini ko‘rishi uchun.
- Sessiya va audit ma’lumotlari — kirishni boshqarish va xavfsizlik uchun.
- Push token va bildirishnoma sozlamalari — tanlangan bildirishnomalarni
  jo‘natish uchun. Tokenning o‘zi ham ma’lumotlar inventariga kiradi.
- Faollashtirilgan va ruxsat berilgan funksiyalarda joylashuv — aniq emergency
  yoki kuryer jarayoni uchun. Ushbu ikki maqsad alohida baholanadi.
- Faollashtirilgan hamjamiyat/reyting funksiyalarida ko‘rsatiladigan profil va
  ishtirok ma’lumotlari — foydalanuvchiga ko‘rsatilgan visibility sozlamalari
  doirasida.

Har bir maqsad uchun huquqiy asos: **[tasdiqlangan ishlov berish jadvali]**.
Tibbiy muolajaga rozilik, shaxsiy ma’lumotlarga ishlov berish va ixtiyoriy
marketing/location tanlovlari bitta umumiy tasdiqqa birlashtirilmaydi.

## 3. Kimlar ko‘rishi mumkin

Foydalanuvchi o‘ziga tegishli ko‘rinishlarni ko‘radi. Muassasa xodimining
kirishi uning vazifasi, ruxsati va tegishli tashkilot/yozuv doirasiga bog‘liq.
Texnik yoki tashkilot administratori bo‘lish klinik ma’lumotlardan istalgan
maqsadda foydalanishga rozilik degani emas. Aniq rol/scope matritsasi pilot
uchun tasdiqlanadi va tekshiriladi.

Ommaviy ko‘rinadigan hamjamiyat yoki reyting ma’lumotlari foydalanuvchiga
alohida tushuntiriladi. Tibbiy natija va donorning aniq joylashuvi ommaviy
katalog sifatida chiqarilmaydi.

## 4. Tashqi xizmatlar va saqlash joylari

Joriy arxitekturada hosting/PostgreSQL, tranzaksion SMTP, push va xarita
xizmatlari bor; SMS tanlangan provayderga bog‘liq. Haqiqiy xizmat ko‘rsatuvchi,
mamlakat, subpudratchi, uzatiladigan ma’lumot va ishlov berish asosi:
**[tasdiqlangan tashqi xizmatlar ro‘yxati]**.

Emailni tasdiqlash va parol tiklash xati qabul qiluvchi email hamda bir martalik
havolani SMTP xizmatiga uzatadi. Push xabarida generic matn va ilovadagi inbox
yo‘li ishlatiladi; tibbiy mazmun autentifikatsiyadan keyin ilovada olinadi.
Xarita yoki push xizmatidan foydalanish ma’lumot almashinuvi yo‘qligini
anglatmaydi. Server va backupning jismoniy joylashuvi provayder hujjati bilan
tasdiqlanadi.

## 5. AI

Dastlabki pilot doirasida AI funksiyalarini yoqish rejalashtirilmagan.
Ularni yoqishdan oldin mahsulot tasnifi, maqsad, uzatiladigan aniq ma’lumot,
tashqi xizmatlar va tegishli rozilik/asoslar alohida ko‘rib chiqiladi.
“Faqat ma’lumot uchun” yorlig‘i ushbu tekshiruvlarni almashtirmaydi.

## 6. Saqlash va hisobni yopish

Har bir ma’lumot sinfi, boshlanish hodisasi, muddat, istisno, backup va
yo‘q qilish/egasizlantirish tartibi: **[tasdiqlangan saqlash jadvali]**.
Bu loyiha 72 soat yoki 90 kunni umumiy huquqiy muddat sifatida belgilamaydi.

Ilovadagi hisobni yopish kirishni to‘xtatadi, sessiyalarni bekor qiladi va
ayrim ixtiyoriy profil/location sozlamalarini olib tashlaydi. Bu barcha shaxsiy
yoki klinik yozuvlar o‘chdi degani emas. Qoladigan identifikatsiya, klinik tarix,
rozilik va audit yozuvlari hamda ularni saqlash asosi foydalanuvchiga aniq
ko‘rsatilishi kerak.

## 7. Murojaatlar va tanlovlar

Ma’lumotni ko‘rish, tuzatish, ruxsat etilgan nusxasini olish, rozilikni qaytarish
yoki hisobni yopish bo‘yicha murojaatlar tayinlangan aloqa kanali orqali
ro‘yxatga olinadi. Shaxsni tekshirish, javob tartibi, muddatlar va saqlanishi
kerak bo‘lgan yozuvlar istisnolari: **[tasdiqlangan murojaatlar tartibi]**.
Hozir umumiy self-service export tayyor deb va’da qilinmaydi.

Ixtiyoriy bildirishnoma, joylashuv va visibility sozlamalari foydalanuvchiga
ko‘rsatiladi. Rozilik kerak bo‘lgan funksiya uchun ko‘rsatilgan matnning aniq
versiyasi/hash’i va qaytarib olish izi saqlanadi.

## 8. Himoya va hodisalar

Himoya choralariga TLS, parol xeshlash, sessiyalarni bekor qilish, kirish
chegaralari, audit va backup sinovlari kiradi. Ular mutlaq xavfsizlik yoki
muvofiqlik sertifikati haqidagi kafolat emas. Hodisa yuz bersa qo‘llaniladigan
xabar berish tartibi va foydalanuvchi aloqasi tasdiqlangan incident jarayonida
belgilanadi.

## 9. Hujjatni kuchga kiritish

Operator rekvizitlari, barcha yuqoridagi jadvallar, amaldagi kod bilan moslik,
o‘zbekcha matnning tushunarliligi va zarur tarjimalar ko‘rib chiqilgach
versiya, tasdiqlovchi va kuchga kirish sanasi qayd etiladi. Ushbu DRAFT ilovada
tasdiqlangan rozilik sifatida avtomatik chiqarilmaydi.
