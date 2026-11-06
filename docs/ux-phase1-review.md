# UI/UX — birinchi bosqichni ko‘rib chiqish

Bu bosqich keng UI/UX rejasining boshlanishi. Mobil ekranlar, ish navbatlari,
klinik shakllar va navigatsiyani qayta guruhlash hali amalga oshirilmagan.

## Git holati

- Ishchi branch: `modes`, asosi `claude/local-test-ready` (`7fc6e1ec`).
- `claude/modest-heisenberg-hi9tjp` (`4179693d`) shu asosning ajdodi:
  `git rev-list --left-right --count` natijasi `116 0`.
- Birlashtirish tekshiruvi `Already up to date` bilan tugadi.
- Yangi commit, push yoki pull request yaratilmagan.

## O‘zgarishlar

- `apps/landing-web`: bloodchain.uz uchun o‘zbekcha, moslashuvchan ommaviy sahifa.
  Shifoxona va qon markazi portallariga to‘g‘ridan-to‘g‘ri havolalar, jarayonlar
  tavsifi, donorlar bloki, FAQ va ikkilamchi admin havolasi bor.
- Haqiqiy ilova do‘koni havolalari berilmagani uchun yuklash tugmalari yo‘q.
- Uch dashboardda API xatosi bo‘sh ma’lumot sifatida ko‘rsatilmaydi: alohida
  xabar va qayta urinish tugmasi chiqadi. Xato muvaffaqiyatli javobdan keyin yo‘qoladi.
- Ish maydonining ixchamlik tanlovi brauzerda saqlanadi. Storage yopiq bo‘lsa
  ham tanlov joriy sahifada ishlaydi.
- Foydalanuvchi so‘roviga ko‘ra bordo-qizil brend, och pushti yuzalar va iliq
  sarg‘ish aksentlar qo‘shildi. Uch portal umumiy palitradan foydalanadi.
  Mobilning yorug‘ va qorong‘i mavzularidagi brend rangi ham moslashtirildi;
  kritik va ogohlantirish ranglari alohida saqlandi.
- Umumiy xato komponenti ekran o‘quvchilar uchun `role="alert"` olgan.

## Lokal ishga tushirish

Mavjud checkoutdan foydalaning:

```bash
cd /workspace/bloodchain-final
export PATH=/workspace/.bloodchain-tools/node_modules/.bin:$PATH
pnpm install --frozen-lockfile
pnpm dev:landing
```

Landing porti — `3004`. Alohida terminallarda:

```bash
pnpm dev:hospital       # 3000
pnpm dev:blood-center   # 3002
pnpm dev:admin          # 3003
```

Production builddan oldin tegishli dev serverni to‘xtating: ikkalasi `.next`
papkasidan foydalanadi. Ushbu ish production domenlariga joylashtirilmagan.

## Qo‘lda tekshirish

1. Landingda “Kabinetga kirish”ni bosing; kabinetlar bo‘limiga o‘tishini tekshiring.
2. Shifoxona va qon markazi havolalarining tegishli domenlarga yo‘nalishini tekshiring.
3. FAQ savollarini sichqoncha va klaviatura bilan ochib-yoping.
4. Ekranni 360 va 390 pikselga kichraytiring; sahifa yon tomonga chiqmasin.
5. Dashboardda ixcham ko‘rinishni yoqing, sahifani yangilang: tanlov saqlansin.
6. Dashboard ma’lumotlari so‘rovini rad eting: xato va qayta urinish chiqsin.
   API qayta ishlaganda qayta urinish orqali odatiy ekran tiklansin.

## Avtomatik tekshiruvlar

```bash
pnpm --filter @bloodchain/ui --filter @bloodchain/admin-web --filter @bloodchain/hospital-web --filter @bloodchain/blood-center-web run test --maxWorkers=2 --minWorkers=1
pnpm --filter @bloodchain/landing-web --filter @bloodchain/ui --filter @bloodchain/admin-web --filter @bloodchain/hospital-web --filter @bloodchain/blood-center-web typecheck
pnpm --filter @bloodchain/landing-web --filter @bloodchain/ui --filter @bloodchain/admin-web --filter @bloodchain/hospital-web --filter @bloodchain/blood-center-web lint
pnpm --filter @bloodchain/landing-web --filter @bloodchain/admin-web --filter @bloodchain/hospital-web --filter @bloodchain/blood-center-web build
```

Skrinshotlar: `artifacts/ux-phase1/`. Brauzerda API javoblarini almashtirib
tekshirish haqiqiy backend yoki klinik jarayonlar ishlashining dalili emas.
To‘liq API/e2e tayyorligi bu bosqichda da’vo qilinmaydi.

Keyingi bosqich: rollarga mos ish navbatlari, jadval va filtrlar, talabnoma
shakllari, landingning ruscha/inglizcha variantlari hamda mobil jarayonlar.

## Ushbu bosqichdagi natijalar

- Shared UI: 106 test o‘tdi, jumladan ixchamlik tanlovini qayta ochishda tiklash.
- Admin: 38, shifoxona: 72, qon markazi: 64 test o‘tdi.
  Uchalasida API xatosidan qayta urinish orqali tiklanish regressiyasi bor.
- Mobil ranglar: 46 ta mavjud kontrast va semantik farqlash testi o‘tdi.
  Qorong‘i mavzu uchun bordo to‘ldirish rangi kontrastga mos ravishda yorqinlashtirildi.
- Landing, uch portal va shared UI typecheck o‘tdi; mobil typecheck ham o‘tdi.
- Lint xatosiz, mavjud ogohlantirishlar bilan o‘tdi.
- Yangi ranglarda landing va uch portal production buildlari o‘tdi.
- Chromium: landing 1440/390/360px da HTTP 200, portal havolalari, FAQ,
  gorizontal overflow va runtime xatolari bo‘yicha tekshirildi.
- Admin Chromium tekshiruvida API javoblari sintetik fixture bilan almashtirildi:
  503 xatosi, qayta urinishdan keyingi metrikalar, reload orqali zichlikni tiklash
  va 390px ekran tekshirildi. Runtime xatolari aniqlanmadi.
- Mobilning haqiqiy qurilmadagi vizual ko‘rinishi va jonli backend bilan
  end-to-end jarayonlar bu bosqichda tekshirilmagan.
