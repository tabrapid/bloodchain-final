import Link from 'next/link';
export const metadata = { title: 'Foydalanish haqida — BloodChain' };
export default function Terms() {
  return (
    <main className="legal-page">
      <Link href="/">← BloodChain bosh sahifasi</Link>
      <h1>Foydalanish shartlari haqida</h1>
      <p className="legal-status">
        To‘liq foydalanish shartlari va operator rekvizitlari tasdiqlanish bosqichida. Bu sahifa
        ommaviy landing imkoniyatlari va cheklovlarini tushuntiradi; tasdiqlangan xizmat shartnomasi
        yoki ommaviy oferta emas.
      </p>
      <h2>Ommaviy sahifaning vazifasi</h2>
      <p>
        BloodChain bilan tanishish, tegishli muassasa portaliga o‘tish va hamkorlik uchun email
        qoralamasi tayyorlash. Murojaat tayyorlash yoki email yuborish avtomatik hisob, tekshirilgan
        muassasa maqomi yoki xizmatga ulanish yaratmaydi.
      </p>
      <h2>Demo interfeyslar</h2>
      <p>
        Sahifadagi mobil va web tasvirlar mahsulotning sintetik demo muhitidan olingan. Ular haqiqiy
        donor, bemor yoki muassasa faoliyati ko‘rsatkichlari emas. Interfeys va xizmatlar mavjudligi
        versiya va kelishilgan ish doirasiga qarab farq qilishi mumkin.
      </p>
      <h2>Tibbiy ma’lumotlar</h2>
      <p>
        Platformadagi matnlar tibbiy maslahat, tashxis yoki davolash o‘rnini bosmaydi. Donorlikka
        yaroqlilik va klinik qarorlarni vakolatli tibbiyot xodimlari baholaydi. Ushbu ommaviy sahifa
        shoshilinch tibbiy yordam xizmati emas.
      </p>
      <h2>Hisob va vakolatlar</h2>
      <p>
        Muassasa kabinetidan faqat o‘zingizga biriktirilgan hisob va berilgan vakolat doirasida
        foydalaning. Donor ilovasining rasmiy yuklab olish havolalari mavjud bo‘lgach e’lon
        qilinadi.
      </p>
      <p>
        <Link href="/privacy">Landing maxfiyligi bilan tanishing</Link> yoki{' '}
        <Link href="/#partnership">hamkorlik bo‘limiga o‘ting</Link>.
      </p>
    </main>
  );
}
