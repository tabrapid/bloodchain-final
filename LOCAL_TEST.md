1. Branch'ni oling
git clone https://github.com/tabrapid/bloodchain-final.git
cd bloodchain-final
git checkout claude/local-test-ready
2. O'rnatish
pnpm install
3. .env sozlash
cp .env.example .env
cp .env.example apps/api/.env

Ikkala faylda faqat 2 ta narsani o'zgartiring — JWT_ACCESS_SECRET va JWT_REFRESH_SECRET (kamida 32 ta belgi, tasodifiy matn yetarli). Qolgan hammasi tayyor holda ishlaydi (bu P3-4'da tuzatilgan — avval aynan shu fayl API'ni ishga tushirmasdi).

4. Ma'lumotlar bazasi — ikki variant

A) Docker bilan (eng oson, tavsiya etaman):

docker compose up --build

Bu Postgres'ni ham, API'ni ham o'zi ko'taradi, migratsiya va health-check avtomatik. API http://localhost:3001'da ishga tushadi.

B) Lokal Postgres bilan:

pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev:api
5. Seed qilingan hisoblar (parol hammasida bir xil: DevelopmentOnly!123)
Email	Rol
admin@donor.local	SUPER_ADMIN
hospital.admin@donor.local	HOSPITAL_ADMIN
blood.center.admin@donor.local	BLOOD_CENTER_ADMIN
courier@donor.local	COURIER
donor@donor.local	DONOR
6. Web ilovalarni ishga tushirish (har birini alohida terminalda)
pnpm dev:hospital       # http://localhost:3000  (kasalxona)
pnpm dev:blood-center   # http://localhost:3002  (qon markazi)
pnpm dev:admin          # http://localhost:3003  (admin panel)
7. Mobil ilova
pnpm dev:mobile

Expo QR kod chiqaradi — telefoningizdagi Expo Go ilovasi bilan skanerlang, yoki pnpm --filter @bloodchain/mobile android/ios orqali emulyatorda.

8. Bu sessiyada nima tuzatilganini alohida sinab ko'ring
Navbar: har uchala web ilovada — chiqish tugmasi endi ishlaydi, sahifa bosilganda menyu yorishishi kerak, klik sahifani qayta yuklamasligi kerak (tezkor o'tish).
Modal/Drawer: istalgan popup oynani Esc tugmasi bilan yoping.
Mobil "Ta'lim" bo'limi: kontentni "Start" bosib boshlang, keyin "Complete" bosing — XP hisoblanishini "Your Progress" bo'limida tekshiring.
Admin → Kuryerlar: kuryerni to'xtatish (suspend) — sabab maydonini bo'sh qoldirib ham, to'ldirib ham sinab ko'ring.

Savolingiz yoki xatolik topsangiz — ayting, shu yerda ko'rib chiqamiz.
