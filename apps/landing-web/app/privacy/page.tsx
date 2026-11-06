import Link from 'next/link';
import { partnershipEmail } from '../site-config';
export const metadata = { title: 'Landing sahifasi maxfiyligi — BloodChain' };
export default function Privacy() {
  return (
    <main className="legal-page">
      <Link href="/">← BloodChain bosh sahifasi</Link>
      <h1>Maxfiylik haqida</h1>
      <p className="legal-status">
        Bu sahifa ommaviy landing va hamkorlik formasi qanday ishlashini tushuntiradi. Platformaning
        to‘liq maxfiylik siyosati va operator rekvizitlari tasdiqlanish bosqichida; ushbu izoh
        tasdiqlangan klinik xizmat siyosati sifatida taqdim etilmaydi.
      </p>
      <h2>Hamkorlik formasi</h2>
      <p>
        Muassasa nomi, turi, hudud, mas’ul shaxs, aloqa ma’lumoti va qiziqtirgan moduldan email
        qoralamasi tuziladi. Forma bu ma’lumotlarni backendga yubormaydi yoki brauzer xotirasiga
        doimiy saqlamaydi. Sahifani yangilash kiritilgan ma’lumotlarni yo‘qotadi.
      </p>
      <p>
        “Email dasturida ochish”ni tanlasangiz, qoralama qurilmangizdagi email dasturiga uzatiladi.
        Yuborishni o‘zingiz tasdiqlaysiz. Email yuborilgach, u tanlangan email xizmatlari orqali
        qayta ishlanadi. “Nusxalash” faqat tegishli tugma bosilganda matnni qurilmangiz almashuv
        buferiga qo‘yadi.
      </p>
      <h2>Nimalarni kiritmaslik kerak?</h2>
      <p>
        Formaga bemor yoki donorning tibbiy ma’lumotlari, laboratoriya natijalari, parollar yoki
        shaxsni tasdiqlovchi hujjatlarni kiritmang.
      </p>
      <h2>Ommaviy sahifa va kabinetlar</h2>
      <p>
        Landing shaxsiy tibbiy yozuvlarni ochmaydi. Muassasa kabinetlari alohida domenlarda ishlaydi
        va o‘z autentifikatsiya jarayoniga ega. Sahifa yuklanishi hosting darajasida texnik
        so‘rovlarni yuzaga keltiradi; tegishli server loglari va saqlash siyosati operatorning
        to‘liq hujjatlarida aniqlashtirilishi kerak.
      </p>
      <h2>Aloqa</h2>
      <p>
        Hamkorlik bo‘yicha foydalanuvchi tasdiqlagan aloqa manzili:{' '}
        <a href={`mailto:${partnershipEmail}`}>{partnershipEmail}</a>. Maxfiylik uchun mas’ul
        operator va rasmiy murojaat tartibi alohida e’lon qilinadi.
      </p>
    </main>
  );
}
