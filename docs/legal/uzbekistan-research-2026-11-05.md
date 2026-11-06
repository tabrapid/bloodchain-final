# BloodChain — O‘zbekiston bo‘yicha tadqiqot va bajarish dalillari

Tekshiruv sanasi: 2026-11-05. Bu mahsulotga oid tadqiqot, individual regulyator qarori yoki tasdiqlangan klinik protokol emas.

Loyiha egasi ushbu chatda operator yuridik shaxsi hali tashkil etilmaganini bildirdi. Internetdagi tashkilot rekvizitlari BloodChain’ga tegishli deb ko‘chirilmaydi. Hamkorlik, klinik mas’ul tayinlanishi va rozilik hujjati tasdiqlangani haqida dalil yo‘q.

## Aniqlangan rasmiy tartiblar

| Dalil | Aniq topilma | BloodChain uchun bajariladigan ish |
| --- | --- | --- |
| [SSV, 3751-son qoidalar](https://lex.uz/docs/7987076), 33–38-bandlar; kuchga kirishi 26.02.2026 | Tibbiy jihoz hisoblangan dastur uchun alohida tasniflash bobi bor; 35-band AI qo‘llangan shu doiradagi dasturga III sinfni belgilaydi. | “AI faqat informational” yorlig‘idan ruxsat xulosasi chiqarilmaydi. Dastur vazifasi, klinik qarorga ta’siri va mahsulot chegarasi bo‘yicha tasniflash paketi tayyorlanadi. Bu BloodChain’ga rasmiy ravishda III sinf berildi degani emas. |
| [VMQ 415, 29.07.2026](https://lex.uz/uz/docs/-8369688), 4-band va ilova; kuchga kirishi 03.08.2026 | Transchegaraviy oqimlar uchun davlatlar ro‘yxati bor. AQSH satrida DPF doirasidagi kompaniyalarga oid izoh mavjud. Transchegaraviy sizish aniqlansa 24 soatda xabar, 72 soatda batafsil axborot talabi bor. | Vendorning faqat server regioni yoki “GDPR compliant” yorlig‘i yetarli dalil emas. Operator shartnomasi, subpudratchilar va real oqimlar tekshiriladi; tegishli incident jarayoni tayyorlanadi. |
| [O‘RQ-1125](https://lex.uz/uz/docs/-8099215), 20 va 27¹-moddalarga o‘zgartirish | Lokal saqlash va reyestr qo‘llanishi ma’lumot toifalariga bog‘langan. | Barcha bazalar bo‘yicha bir xil mutlaq da’vo qilinmaydi. Har bir maydon, saqlash nusxasi va tashqi oqim inventarizatsiya qilinadi. |
| [SSV, 2556-son tartib](https://lex.uz/uz/docs/-2320451), 9-band va tegishli tekshiruvlar | Donorning shaxsini tasdiqlovchi hujjatni tekshirish tartibi mavjud. Bu o‘z-o‘zidan barcha ID nusxalarini saqlash talabi degani emas. | Muassasa xodimining shaxsni tekshirganini qayd etish jarayoni ishlab chiqiladi; JSHSHIR yoki hujjat nusxasini saqlash zarurati alohida aniqlanadi. |
| [Shaxsga doir ma’lumotlar qonuni](https://lex.uz/uz/docs/-4396419), 21, 25, 28-moddalar | Rozilik/ishlov berish asosi va maxfiylik masalalari bor. | Versiya, maqsad, til, tashkilot va qaytarib olish izini saqlash; eski yoki boshqa scope roziligini yangi ishlovga dalil qilmaslik. |
| [Fuqarolar sog‘lig‘ini saqlash qonuni](https://lex.uz/uz/docs/-26013), 24–27, 45-moddalar | Bemor huquqlari, tibbiy aralashuv va shifokor siri alohida masalalar. | Ilova shartlari, shaxsiy ma’lumotga ishlov va tibbiy muolaja roziligi ajratiladi. |
| [VMQ 80](https://lex.uz/uz/docs/-5870213), 27-ilova | Tibbiy faoliyat doirasi xizmatlar bilan bog‘liq. | Onboardingda rasmiy maqom, manzil, tegishli xizmat va huquqiy asos tekshiriladi; “laboratoriya bor” boolean’i release ruxsati bo‘lmaydi. |

Qonunlarning kelajakda kuchga kiradigan tahrirlari bugungi talab sifatida olinmaydi. Yuqoridagi havola, band, tekshirish sanasi va mahsulotga qo‘llanish xulosasi keyingi review’da qayta tekshiriladi.

## Operatorni tashkil etish — UZ-01

[MyGov biznesni ro‘yxatdan o‘tkazish xizmati](https://my.gov.uz/uz/service/57) va [Adliyaning boshlash tartibi](https://advice.adliya.uz/oz/document/179?keyword=Tadbirkorlik) topildi. MChJ shakli B2B platforma uchun ishchi taklif; muayyan tashkiliy shakl qonunan yagona variant degan xulosa emas.

Egasi belgilaydigan ma’lumotlar: tashkilot nomi, ta’sischilar va ulushlar, direktor, haqiqiy manzil, ustav, xizmat turi va hisob-kitob modeli. Keyin rasmiy ro‘yxatdan o‘tish, STIR/reyestr hujjati, bank va elektron imzo masalalari hal qilinadi. Joriy yig‘im ariza paytidagi rasmiy xizmatdan olinadi. Egasi nomidan shaxsiy identifikatsiya, imzo yoki to‘lov bajarilmadi.

Kod, domen, logotip va uchinchi kutubxonalar huquqlari inventari ham operatorga topshirish paketiga kiradi. Klinika bilan shartnoma tuzishdan oldin operator rekvizitlari tayyor bo‘lishi kerak.

## Regulyatorga taqdim etiladigan paket — UZ-02

Rasmiy axborot manbasi: [Farmatsevtika mahsulotlari xavfsizligi markazi](https://uzpharm-control.uz/). [MyGov tibbiy buyumlar xizmati](https://my.gov.uz/uz/service/330) umumiy yo‘lni ko‘rsatadi; aynan BloodChain uchun to‘g‘ri yo‘nalish va joriy tartib tasdiqlanadi.

Tayyorlanadigan ilovalar:

1. Mahsulot intended-use bayoni va modul chegaralari: donor rejalashtirish, klinik natija ko‘rsatish, screening/release, logistika, AI.
2. Qaysi natija faqat qayd, qaysisi tavsiya yoki klinik qarorga ta’sir ekanini ko‘rsatuvchi matritsa.
3. Arxitektura, versiyalar, ma’lumotlar xaritasi, autentifikatsiya va audit, test dalillari.
4. Xatolik oqibatlari, fail-closed cheklovlar, klinik mas’ul, correction/recall va uzilish tartibi.
5. Savollar: tizim/modullar tibbiy jihoz doirasiga kiradimi; qaysi tasnif va ro‘yxatdan o‘tish zarur; pilotga qo‘yiladigan talablar; ERI va elektron klinik hujjatlar maqomi.

Bu so‘rovning mazmuni tayyorlandi, lekin rasmiy javob olinmadi va ariza yuborilmadi. Mahsulot scope’ini o‘zgartirish orqali regulyator talabi avtomatik yo‘qoladi deb hisoblanmaydi.

## Hamkorlar va suhbat paketi — UZ-03/04

Nomzod sifatida [Respublika qon quyish markazining rasmiy kontakti](https://qonber.uz/uz/contacts) va [rahbariyat sahifasi](https://qonber.uz/uz/center/management) topildi. Sahifalarning to‘liq ochilishi tekshiruvda 502 qaytardi; kontaktlar uchrashuvdan oldin rasmiy kanal orqali qayta tasdiqlanadi. Tashkilot hamkor yoki platformada VERIFIED deb belgilanmadi.

Suhbatda olinadi: jarayon xaritasi, ishlatiladigan rasmiy shakllar va SOP, litsenziya yoki tegishli huquqiy asos, filial va xizmatlar, xodim malakasi/tayinlash vakolati, laboratoriya QC va critical-result tartibi, komponent identifikatsiyasi va sovuq zanjir, recall hamda uzilish jarayoni. Faqat ruxsat etilgan sintetik misollar so‘raladi, bemor/donor bazasi chatga yuborilmaydi.

Pilot shartnomasi uchun bandlar: scope, mas’ullar, ishlov berish rollari, uchinchi tomonlar, xavfsizlik, support/SLA, incident, audit, ma’lumotga kirish va pilot yakunida topshirish/saqlash. Davlat muassasasi bo‘lsa xarid va vakolatli imzolovchi tartibi ham tekshiriladi. Hech kimga loyiha nomidan xat yoki xabar yuborilmadi.

## Uchinchi tomonlar va joriy texnik oqim — UZ-05/06/07

| Oqim | Kuzatilgan yoki koddagi ma’lumot | Ish va holat |
| --- | --- | --- |
| VPS/PostgreSQL va lokal backup | Profil, sog‘liq/klinik ma’lumotlar, tokenlar xeshlari, audit | Datacenter mamlakati va shartnoma dalili yo‘q. IP/domen lokatsiya dalili emas; provayder hujjati talab etiladi. |
| Resend SMTP | Qabul qiluvchi email, tasdiqlash/tiklash xatlari va bir martalik havola | [DPA](https://resend.com/legal/dpa) va [subpudratchilar](https://resend.com/legal) manbalari topildi. Ushbu shartlar O‘zbekiston talabini avtomatik yopmaydi; klinik mazmun emailga chiqarilmasligi tekshiriladi. |
| Expo → APNs/FCM | Device push token va notification payload | [Expo security](https://expo.dev/security) va [push hujjatlari](https://docs.expo.dev/push-notifications/sending-notifications/) tekshirildi. Payload generic xabar va inbox yo‘liga kamaytirildi; klinik mazmun API ichida qoladi. Tokenning o‘zi ham hisobga olinadi. |
| Telegram monitoring | Server holati va tiklanish xabarlari | Tibbiy mazmun, shaxsiy profil, OTP va credential yuborilmasligi shart. Bot faqat tasdiqlangan operator chatiga yo‘naltiriladi. |
| Maps/OSM va qurilma ruxsatlari | Manzil/koordinata va tashqi tile so‘rovi ehtimoli | Web map kutubxonasi bor. Har ekran va haqiqiy provider oqimi alohida inventory qilinadi; aniq donor location ommaviy xaritaga chiqarilmaydi. |
| AI, crash analytics, boshqa SDK | Konfiguratsiyaga bog‘liq | Pilot scope’ida AI o‘chiq qoladi; yangi xizmat qo‘shishdan oldin payload va maqsad tahlili qilinadi. “O‘chiq” holat deployment dalili bilan tekshiriladi. |

## Kod tekshiruvida topilgan kamchiliklar va tuzatmalar

- Consent gate faqat purpose bo‘yicha eng so‘nggi acceptance’ni olgan: scope va amaldagi hujjat/versiya/hash bilan bog‘lanishi kuchaytirildi. Effective date barcha fallback yo‘llarida tekshiriladi.
- Push arbitrary data, original body va deepLink yuborgan: klinik mazmun/tasodifiy metadata tashqi payloadga qo‘shilmaydi. Xabarning to‘liq nusxasi autentifikatsiyalangan inboxda qoladi.
- HTTP logger query’dagi email-verification tokenini yozishi mumkin bo‘lgan: request/response allowlist va query’ni olib tashlash qo‘shildi.
- Global `/users` va `/users/:id` tenant admin rollariga ochiq bo‘lgan: tenant bilan cheklanmagan directory platforma adminiga cheklangan; o‘z profiliga `/users/me` orqali kirish saqlanadi.
- Controller audit IP’lari raw forwarded header’dan olingan: Express’da konfiguratsiya qilingan proxy ishonchiga mos `req.ip` ishlatiladi.
- Reference seed operator belgilagan consent mode/note’ni qayta yozgan: mavjud qaror saqlanadi, faqat yetishmagan standart yozuv yaratiladi.

Har bir tuzatma test natijasi va commit bilan yopiladi. Bu ro‘yxat butun reja tugallangan degani emas.

## Ochiq tashqi bog‘liqliklar

Yuridik shaxs, hamkor shartnomasi, haqiqiy klinik mas’ullar, individual regulyator javobi, provayder joylashuv hujjati, SMS hisobi, tashqi storage hisobi, tasdiqlangan saqlash muddatlari va rozilik matnlari uchun dalil yo‘q. Internet tadqiqoti bu hujjatlarning imzosi yoki mavjudligi o‘rnini bosmaydi. Bular ochiq holatda kuzatiladi; hech biri sun’iy ravishda tasdiqlanmaydi.
