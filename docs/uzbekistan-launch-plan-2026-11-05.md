# BloodChain: O‘zbekistonda huquqiy va amaliy ishga tushirish rejasi

Sana: 2026-11-05. Holat: bajarish uchun ishchi reja; yuridik xulosa yoki klinik protokol emas.

Asos: foydalanuvchi taqdim etgan muassasa/vakolat roadmap’i, joriy repository va quyida keltirilgan rasmiy manbalar. Biriktirilgan matndagi Python ko‘rsatmalari bajarilmadi; undagi reja mazmuni talablar sifatida ko‘rib chiqildi.

## 1. Birinchi mahsulot chegarasi

Birinchi pilot: bitta vakolatli qon markazi, bitta shifoxona va ular bilan ishlovchi laboratoriya. Laboratoriya qon markazining vakolatli bo‘linmasi ham bo‘lishi mumkin. Alohida laboratoriya bo‘lsa, shartnoma va namuna/natija almashish chegarasi belgilanadi.

Platforma tashkilotlarni tekshiradi, xodimlar kirishini boshqaradi va jarayonlarni qayd etadi. Donor yaroqliligi, laboratoriya natijasining rasmiy chiqarilishi va qon komponentini chiqarish bo‘yicha mas’ul klinik shaxslar oldindan belgilanadi. Faqat “tibbiy maslahat emas” yozuvi qo‘yish mahsulotning real vazifasidan kelib chiqadigan majburiyatlarni hal qilmaydi.

Birinchi pilotga barcha tibbiyot muassasalari taksonomiyasi, to‘liq shifoxona axborot tizimi, AI tavsiyalari, ommaviy donor xaritasi va tijoriy bonus bozori kiritilmaydi. SOS faqat alohida tasdiqlangan keyingi bosqichda ochiladi. Bu mahsulot doirasini toraytirish taklifi, qonun talabi emas.

## 2. Joriy holat va dalil chegarasi

- VPS, domen/TLS, API va uch panel, SMTP, monitoring va lokal backup/restore tekshiruvi oldingi deploy ishlarida bajarilgan. Bular yuridik yoki klinik tasdiq o‘rnini bosmaydi.
- Rol/ruxsatlar va reference seed mavjud. Tashkilot modeli, tenant tekshiruvlari va laboratoriya natijalari versiyalari bor; endi ular real filial, xodim vakolati va huquqiy asos bilan tekshirilishi kerak.
- `ConsentDocument`, `ConsentAcceptance`, `ConsentRequirement` modellari va consent moduli bor. “Rozilik mexanizmi umuman yo‘q” degan eski hujjatlar joriy kodga to‘liq mos emas. Tasdiqlangan matn, barcha endpointlarda ishlashi va elektron rozilikning yetarli dalili alohida tekshiriladi.
- Privacy policy va terms fayllari bor, ammo DRAFT, operator rekvizitlari to‘ldirilmagan. “Fayl mavjud” va “yuridik tasdiqlangan” turli holatlar.
- Haqiqiy SMS, serverning jismoniy joylashuvi bo‘yicha hujjat, tashqi backup, regulyator tasnifi, klinik imzolar va real hamkorlar tasdig‘i hali yopilgan deb hisoblanmaydi.
- Dependency auditidagi ochiq xavfsizlik topilmalari, jumladan web framework yangilanishlari ommaviy chiqarishdan oldin hal qilinadi.

Eski `production-readiness.md` va review-pack holatlari yangilanadi; hech bir band faqat eskirgan hujjatdagi “Absent” yozuvi asosida qaytadan ishlab chiqilmaydi.

## 3. Rasmiy manbalar va aniqlashtiriladigan huquqiy masalalar

Quyidagi qisqa izohlar ish yo‘nalishini belgilaydi; qo‘llanish bo‘yicha yozma xulosani O‘zbekiston yuristi beradi. LexUZ’dagi kuchga kirish sanalari va keyingi tahrirlar har bir imzodan oldin qayta tekshiriladi; kelajakda kuchga kiradigan norma amaldagi norma sifatida olinmaydi.

| Manba | Rejadagi qo‘llanishi |
| --- | --- |
| [O‘RQ-547: Shaxsga doir ma’lumotlar](https://lex.uz/uz/docs/-4396419), xususan 21, 25, 28-moddalar | Sog‘liq ma’lumotlari, ishlov berish asosi, rozilik dalili va maxfiylik tahlili. Har bir maqsad uchun asos alohida belgilanadi. |
| [O‘RQ-1125, 26.03.2026](https://lex.uz/uz/docs/-8099215) | 20 va 27¹-moddalar o‘zgargan: majburiy mahalliy saqlash toifalari, boshqa ma’lumotlar uchun xorijda saqlash shartlari va reyestr qo‘llanishi qayta baholanadi. “Hamma baza majburiy reyestrga kiradi” degan umumiy xulosa olinmaydi. |
| [265-I: Fuqarolar sog‘lig‘ini saqlash](https://lex.uz/uz/docs/-26013), 24–27, 45-moddalar | Bemor huquqlari, tibbiy aralashuvga rozilik va shifokor siri. Ilovadagi maxfiylik roziligi tibbiy muolaja roziligidan ajratiladi. |
| [402-II: Qon va uning tarkibiy qismlari donorligi](https://lex.uz/uz/docs/-46727), 5–7, 10–13-moddalar | Ixtiyoriy donorlik, xavfsizlik va qon xizmati vakolatlari. Platforma roli muassasaning vakolatiga tenglashtirilmaydi. |
| [SSV buyrug‘i, ro‘yxat raqami 2556](https://www.lex.uz/acts/-2320451) | Klinik mutaxassis amaldagi donorlik tartibi va cheklovlarini mahsulot qoidalari bilan solishtiradi. |
| [VMQ 80, 27-ilova](https://lex.uz/uz/docs/-5870213) | Tibbiy faoliyat litsenziyasi doirasi va muassasa onboardingida tekshiriladigan xizmatlar. Davlat muassasasi uchun tegishli huquqiy asos alohida aniqlanadi. |
| [O‘RQ-793: Elektron raqamli imzo](https://lex.uz/uz/docs/-6234904) | Qaysi tasdiqlash va hujjat uchun ERI kerakligi aniqlanadi; login, OTP yoki oddiy “Tasdiqlash” tugmasi avtomatik ERI deb olinmaydi. |

Hosting uchun alohida qaror: 27¹-moddaning joriy tahririda biometrik, genetik va telekommunikatsiya operatorlari abonentlariga oid belgilangan toifalar mahalliy saqlashga tegishli; qolgan ma’lumotlarni xorijda saqlash ham shartlarga bog‘liq. Sog‘liq ko‘rsatkichlarini avtomatik ravishda genetik yoki biometrik deb ham, bunday toifalardan mutlaqo tashqari deb ham tasniflamaymiz. Qon guruhi, laboratoriya maydonlari va identifikatsiya vositalari bo‘yicha alohida xulosa olinadi. [Asos: O‘RQ-1125](https://lex.uz/uz/docs/-8099215).

Ehtiyotkor arxitektura taklifi: huquqiy tasnif tugaguncha haqiqiy klinik bazani pilotga ochmaslik; pilot uchun asosiy baza va zaxirani O‘zbekistondagi hujjatlashtirilgan joylashuvda rejalashtirish. Bu barcha ma’lumotlarga bir xil mutlaq qonun talabi bor degan da’vo emas. IP yoki `.uz` domen jismoniy joylashuvni isbotlamaydi.

## 4. Mas’ullar

PO — loyiha egasi; LEGAL — O‘zbekiston tibbiyot/shaxsiy ma’lumotlar yuristi; CLIN — transfuziolog va laboratoriya mas’uli; OPS — hamkor muassasa operatsion rahbari; ENG — dasturchilar; INFRA — server/xavfsizlik mas’uli. Tashkilot kichik bo‘lsa rollar bir kishida birlashishi mumkin, ammo klinik va huquqiy qarorlar tegishli mutaxassissiz dasturchiga topshirilmaydi.

## 5. Bosqichlar va tugash mezonlari

### A — Huquqiy va biznes asos, taxminan 1–3 hafta

| ID | Ish | Mas’ul | Yopish dalili |
| --- | --- | --- | --- |
| UZ-01 | Operator yuridik shaxsi, STIR, vakil, support/maxfiylik kontakti, kod va brend huquqlari; shartnoma va hisob-kitob modelini belgilash | PO + LEGAL + buxgalter | Rekvizitlar va faoliyat modeli tasdiqlangan |
| UZ-02 | Platformaning har bir moduli uchun regulyator tasnifi: oddiy IT xizmat, klinik qarorga ta’sir qiluvchi funksiya, ehtimoliy tibbiy dastur maqomi; talab bo‘lsa vakolatli organdan yozma tushuntirish | LEGAL + CLIN | “Talab etiladi/etilmaydi” degan asoslangan xulosa; talab etilgan ruxsat bo‘lsa olingan |
| UZ-03 | Bitta real markaz, shifoxona va lab bilan jarayon suhbatlari; qog‘oz shakllar, SOP va mas’ullarni olish | PO + OPS + CLIN | Tasdiqlangan bitta end-to-end jarayon xaritasi |
| UZ-04 | Hamkorning davlat/nodavlat maqomi, faoliyat doirasi, filial manzili, hujjat amal qilishi; davlat tashkiloti bilan xarid/shartnoma tartibini aniqlash | LEGAL + OPS | Tekshirilgan hamkor kartasi va pilot shartnomasi |

UZ-02 aniqlanmaguncha “sertifikat shart emas” yoki “albatta sertifikat kerak” deyilmaydi. Regulyator talabi chiqsa muddat shu jarayonga mos qayta rejalashtiriladi.

### B — Ma’lumotlar va shartnomalar, A bilan parallel 2–4 hafta

| ID | Ish | Mas’ul | Yopish dalili |
| --- | --- | --- | --- |
| UZ-05 | Maydonlar va oqimlar inventari: kimdan olinadi, nima uchun, kim ko‘radi, qayerga chiqadi; mulkdor/operator/uchinchi shaxs rollari | LEGAL + ENG | Ma’lumotlar xaritasi va har maqsad uchun huquqiy asos jadvali |
| UZ-06 | VPS provayderidan datacenter mamlakati va subpudratchilar dalili; backup joyi; lokalizatsiya, transchegaraviy uzatish va reyestr qo‘llanishi bo‘yicha qaror | LEGAL + INFRA | Hosting dalili, huquqiy xulosa; tegishli bo‘lsa reyestr qaydi |
| UZ-07 | Resend, Telegram, Expo push, Maps, crash analytics va AI oqimlarini tekshirish | LEGAL + ENG | Har xizmatga ruxsat etilgan maydonlar va shartlar; klinik mazmun notification/loglardan chiqarilgan |
| UZ-08 | Privacy policy, foydalanish shartlari, maqsadlar bo‘yicha roziliklar, muassasa bilan ma’lumotlarga ishlov berish kelishuvi, maxfiylik majburiyati, SLA, pilot tugashi/chiqish rejasi | LEGAL + PO | Versiya va sanali tasdiqlangan hujjatlar; foydalanuvchiga tushunarli o‘zbekcha matn, zarur ruscha tarjima |
| UZ-09 | Retention, foydalanuvchi murojaatlari, tuzatish, rozilikni qaytarish va akkaunt yopish siyosati; majburiy klinik tarixni saqlash chegaralari | LEGAL + CLIN + ENG | Har ma’lumot sinfiga muddat/asos/amal jadvali va ishlaydigan jarayon |

Email va push uchun dastlabki mahsulot qoidasi: “Yangi xabar bor” kabi minimal bildirishnoma; qon guruhi, tahlil, tashxis, aniq geolokatsiya yoki tokenlar monitoring xatlariga kiritilmaydi. Haqiqiy mazmun va xizmat ko‘rsatuvchi loglari alohida tekshiriladi. Hozir ishlayotgan transport huquqiy tasdiqlangan transport deb qabul qilinmaydi.

Rozilik dalili bo‘yicha texnik talab: matnning o‘zgarmas versiyasi/hash’i, maqsad, subyekt, vaqt, usul va qaytarib olish izi. Qaysi elektron tasdiqlash shakli yetarli bo‘lishini yurist belgilaydi. Marketing, geolokatsiya, klinik ishlov va tibbiy muolaja bir checkbox’ga birlashtirilmaydi. Account deletion klinik tarixni avtomatik yo‘qotish deb talqin qilinmaydi.

### C — Muassasa va xodim vakolatlari, A qarorlaridan so‘ng 3–5 hafta

- **UZ-10, ENG + OPS:** mavjud organization modelini filial, faoliyat manzili, huquqiy asos va amal qilish muddatlari bilan to‘ldirish. Taxsonomiya ruxsatning o‘zi emas. Hujjat yuklashdan tashqari tasdiqlash manbasi, tekshiruvchi va qaror sababi yoziladi.
- **UZ-11, ENG + CLIN:** capability’lar: buyurtma, namuna olish, qabul qilish, tahlil bajarish, validate, release, correction va qon komponenti amallari alohida. Muddati tugagan/bekor qilingan capability darhol yuqori xavfli amalni bloklaydi.
- **UZ-12, ENG + OPS:** department, position, specialty, role va scope ajratiladi. Bir martalik taklif, xodimning shaxsiy akkaunti, muhim rollarda MFA, rol almashishi/ishdan ketishda sessiyalar bekor qilinishi.
- **UZ-13, ENG + xavfsizlik tekshiruvchisi:** barcha klinik endpoint, export va fayllarda tenant/filial/bo‘lim nazorati. Direktor yoki platforma adminiga klinik yozuvlarga avtomatik to‘liq kirish berilmaydi. Favqulodda kirish zarur bo‘lsa sabab, vaqt, audit va keyingi nazorat bilan alohida loyihalanadi.

Tugash mezoni: A muassasa xodimi B muassasa yozuvini ID almashtirish orqali ham ko‘ra/o‘zgartira olmaydi; sample-only filial natija chiqara olmaydi; bekor qilingan vakolat eski sessiyada ham ishlamaydi. Bu testlar API darajasida bajariladi.

### D — Klinik va qon xizmati jarayoni, C bilan qisman parallel 4–8 hafta

- **UZ-14, CLIN + ENG:** donor identifikatsiyasi, yosh va boshqa eligibility mezonlari, cheklov sabablari va muddatlarini amaldagi klinik asos bilan belgilash. Ilovaning taxminiy “mos” belgisi yakuniy tibbiy ruxsat bo‘lmaydi.
- **UZ-15, lab mas’uli + ENG:** donor skriningi, bemor klinik tahlili va transfuziyadan oldingi testlarni ajratish. Test nomi, birlik, usul, namuna turi, referens interval va kritik natijaga javob berish tartibi klinik tasdiqdan o‘tadi.
- **UZ-16, lab mas’uli + ENG:** namuna barcode’i va qabul/topshirish tarixi; draft → validation → release; zarur rol ajratilishi; chiqarilgan natijani jim o‘zgartirish o‘rniga versiya va correction/addendum. Qaysi hujjatga ERI zarurligi UZ-02/08 qaroriga bog‘lanadi.
- **UZ-17, qon markazi + ENG:** donation → unit → component → saqlash → karantin/release → transport → qabul/berish → yakuniy disposition. Takrorlanmas ID, reconciliation, donor→komponent va komponent→donor izlash, recall/look-back mashqi.
- **UZ-18, OPS + CLIN:** sovuq zanjir qaydlari, transport mas’uliyati, harorat buzilishi, utilizatsiya, noto‘g‘ri natija va uzilishda qog‘oz/offline tartibi. Harorat va yaroqlilik sonlari dasturchi tomonidan taxmin qilinmaydi.

Tugash mezoni: real ish jarayoniga mos namunaviy case muassasa mutaxassislari tomonidan tasdiqlanadi; cheklovli donor, yaroqsiz/muddati o‘tgan yoki karantindagi komponent chiqarilmaydi; yo‘qolgan namuna va noto‘g‘ri natija holatlari boshqariladi.

### E — Xavfsizlik va ekspluatatsiya, pilotdan oldin 2–4 hafta

- **UZ-19, ENG:** framework va boshqa dependency xavfsizlik yangilanishlari; topilmalarni ta’sir doirasi bilan yopish. Production konfiguratsiya real SMS bilan sinovdan o‘tadi, development adapterga tayanmaydi.
- **UZ-20, INFRA:** ma’lumot va backup shifrlanishi, kalitlarni alohida boshqarish, eng kam SSH/DB ruxsatlari, tashqi backup, kelishilgan RPO/RTO bilan restore mashqi. Avval chatda oshkor qilingan SSH paroli va ortiqcha tokenlar rotatsiyasi ham shu ishga kiradi.
- **UZ-21, ENG + INFRA:** klinik ma’lumot ko‘rish/export qilish auditi, tenant admini o‘chira olmaydigan jurnal, loglardan token/health ma’lumotlarini chiqarish; audit saqlash muddati UZ-09 bilan mos.
- **UZ-22, mustaqil tekshiruvchi:** tenant isolation, auth, upload/export, API va notification xavfsizlik tekshiruvi; pilot yuklamasi bilan load test; incident mashqi va hostdan tashqaridagi availability monitoring.

Tugash mezoni: xavfli ochiq topilma yo‘q; qabul qilinadigan qolgan risklar egasi va muddati bor; xavfsizlik/klinik P0 bandlar “qo‘lda workaround” bilan yashilga o‘tkazilmaydi. Incident xabarlash muddatlari qonun/shartnoma tekshiruviga ko‘ra belgilanadi; chet yurisdiksiya muddati avtomatik ko‘chirilmaydi.

### F — Nazoratli pilot va ommaviy chiqish, kamida 4–6 hafta kuzatuv

- **UZ-23:** avval sintetik ma’lumot bilan muassasa xodimlari UAT va treningi.
- **UZ-24:** real ma’lumotga o‘tishdan oldin LEGAL, CLIN, OPS, ENG/INFRA va PO tomonidan scope hamda yopilgan bloklovchilar bo‘yicha imzo. Pilot so‘zi huquqiy talablardan ozod qilmaydi.
- **UZ-25:** kichik guruh bilan nazoratli ish; noto‘g‘ri kirish, yo‘qolgan namuna/komponent, natija xatosi, tiklanish va support ko‘rsatkichlarini kuzatish. Maqsad sonlari hamkor bilan oldindan kelishiladi; uydirma “norma” qo‘yilmaydi.
- **UZ-26:** store maxfiylik deklaratsiyalari haqiqiy SDK/ma’lumot oqimiga moslanadi; public URL va akkaunt yopish yo‘li tekshiriladi; ommaviy reliz uchun alohida go/no-go qarori.
- **UZ-27:** SOS/geolokatsiya keyin: faqat vakolatli so‘rov, donorning erkin javobi, vaqt bilan cheklangan location, yopilganda ko‘rishning tugashi, retention va navbatchi mas’ul. Ilova davlat tez yordam xizmati bilan tenglashtirilmaydi.

## 6. Dastlabki 10 ish kuni

| Vaqt | Aniq natija |
| --- | --- |
| 1–2-kun | PO pilot scope va hamkor nomzodlarini belgilaydi; LEGAL va CLIN mas’ullari topiladi; operator rekvizitlari va mavjud shartnomalar yig‘iladi. |
| 3–4-kun | Hamkor jarayonlari va hujjatlari olinadi; data-flow va uchinchi xizmatlar ro‘yxati tayyorlanadi; provayderdan hosting joylashuvi dalili so‘raladi. |
| 5-kun | Regulyator maqomi, ma’lumot tasnifi va localization/reyestr savollari uchun yozma topshiriq; texnik gap-analysis: mavjud/qisman/yo‘q/dalil yetarli emas. |
| 6–8-kun | Capability/permission matritsasi, hujjatlar birinchi loyihasi, retention jadvali va acceptance case’lar; tasdiqdan mustaqil xavfsizlik yangilanishlari davom etadi. |
| 9–10-kun | Yurist va klinik mas’ul bilan review; har ochiq savolga egasi va muddati; keyingi sprint uchun tasdiqlangan backlog va pilotni bloklovchi bandlar. |

## 7. Muddat va xarajatni boshqarish

Kichik jamoa va mavjud kod asosida dastlabki ishchi taxmin: 12–20+ hafta; bu ketma-ket barcha bosqichlar yig‘indisi emas, ayrim ishlar parallel. Bir dasturchi, yangi klinik modullar, integratsiya yoki ruxsat jarayonlari bilan muddat uzayadi. Dastlabki 10 kundan keyin scope va imkoniyatlar asosida qayta baholanadi; aniq ruxsat muddati va byudjet taxmin qilinmaydi.

Byudjet satrlari: yurist, transfuziolog/lab ekspert, dasturlash, xavfsizlik testi, mahalliy hosting va tashqi backup, SMS/email, mobil build/store, trening va support. Har biri uchun taklif olinadi. Davlat tizimlari integratsiyasi va xarid tartibi alohida tashqi bog‘liqlik hisoblanadi.

## 8. Pilotga ruxsat berish varaqasi

- [ ] Operator rekvizitlari, mas’ullar va hamkor shartnomasi tayyor.
- [ ] Dastur maqomi va zarur ruxsatlar masalasi yozma hal qilingan.
- [ ] Hosting, tashqi xizmatlar, data-flow va tegishli reyestr talabi yopilgan.
- [ ] Tasdiqlangan privacy/terms/rozilik matnlari va dalil yig‘ish oqimi ishlaydi.
- [ ] Muassasa, filial, xizmat va xodim vakolatlari hujjat bilan tekshirilgan.
- [ ] Klinik qoidalar va natija/komponent release tartibi tasdiqlangan.
- [ ] Tenant/scope, vakolatni bekor qilish va audit testlari o‘tgan.
- [ ] Backup restore, uzilish va incident mashqi muvaffaqiyatli.
- [ ] Ochiq xavfsizlik bloklovchilari yopilgan, real SMS ishlaydi.
- [ ] Trening, support, pilotni to‘xtatish va ma’lumotni topshirish tartibi bor.
- [ ] LEGAL, CLIN, OPS, ENG/INFRA va PO imzolari hamda pilot scope versiyasi qayd etilgan.

Har band uchun “tayyor” belgisi bilan birga hujjat/test daliliga havola, tekshiruvchi, sana va keyingi qayta ko‘rish sanasi saqlanadi. Mazkur reja tasdiqlarning o‘zi hisoblanmaydi.
