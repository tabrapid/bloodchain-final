import Image from 'next/image';
import { Icon, type IconName } from './icons';
import { PartnershipForm } from './partnership-form';
import { PublicNavigation } from './public-navigation';
import { partnershipEmail, donorPortalUrl } from './site-config';

const audiences: {
  icon: IconName;
  number: string;
  title: string;
  description: string;
  items: string[];
  href: string;
  link: string;
}[] = [
  {
    icon: 'drop',
    number: '01',
    title: 'Donorlar',
    description: 'Yordam berish niyatingizni qulay rejalashtirilgan qadamga aylantiring.',
    items: [
      'Donorlikka yozilish',
      'Shaxsiy tarix va mavjud natijalar',
      'Tegishli eslatma va bildirishnomalar',
    ],
    href: donorPortalUrl,
    link: 'Donor kabinetiga kirish',
  },
  {
    icon: 'building',
    number: '02',
    title: 'Shifoxonalar',
    description:
      'Muassasa vakolatlari doirasida talabnoma va yetkazish jarayonlarini muvofiqlashtiring.',
    items: [
      'Qon komponentlariga talabnomalar',
      'Tasdiqlangan miqdor va jarayon holati',
      'Jo‘natmani kuzatish va qabul qilish',
    ],
    href: 'https://hospital.bloodchain.uz',
    link: 'Shifoxona kabinetiga kirish',
  },
  {
    icon: 'lab',
    number: '03',
    title: 'Qon markazlari',
    description:
      'Donor qabuli, qon komponentlari va inventar kuzatuvchanligini bir ish maydonida yuriting.',
    items: [
      'Donorlik va qabul yozuvlari',
      'Laboratoriya va alohida xavfsizlik skriningi',
      'Zaxira, ajratish va jo‘natmalar',
    ],
    href: 'https://center.bloodchain.uz',
    link: 'Qon markazi kabinetiga kirish',
  },
];
const faqs = [
  [
    'BloodChain kimlar uchun?',
    'Donorlar, shifoxonalar, klinikalar, qon markazlari va tegishli tibbiyot xodimlari uchun. Har bir auditoriya uchun alohida ish maydoni mavjud.',
  ],
  [
    'Donor sifatida qayerdan boshlayman?',
    'Donorlar bo‘limida jarayon bilan tanishing. Mobil ilovaning rasmiy yuklab olish havolalari tayyor bo‘lgach shu sahifada e’lon qilinadi.',
  ],
  [
    'Muassasani qanday ulash mumkin?',
    'Hamkorlik bo‘limidagi forma orqali muassasangiz haqida email murojaati tayyorlang. Bu murojaat avtomatik hisob yoki xizmatga ulanish yaratmaydi; keyingi tekshiruv va ulanish jarayoni alohida kelishiladi.',
  ],
  [
    'Qaysi kabinetga kirishim kerak?',
    'Shifoxona xodimlari shifoxona portaliga, qon markazi xodimlari qon markazi portaliga kiradi. Hisobingiz muassasa tomonidan sizga biriktirilgan bo‘lishi kerak.',
  ],
  [
    'Donorlikka yaroqlilikni kim baholaydi?',
    'Tegishli muassasaning vakolatli tibbiyot xodimi. Platforma tashxis, tibbiy maslahat yoki donorlikka yakuniy ruxsat o‘rnini bosmaydi.',
  ],
  [
    'Murojaat qanday yuboriladi?',
    'Forma email qoralamasini tayyorlaydi. “Email dasturida ochish” orqali uni o‘z email ilovangizda ko‘rib, yuborishni tasdiqlaysiz. Sahifa nomingizdan avtomatik email yubormaydi.',
  ],
];
function Brand({ light = false }: { light?: boolean }) {
  return (
    <a
      className={`brand${light ? ' brand-light' : ''}`}
      href="/"
      aria-label="BloodChain bosh sahifa"
    >
      <span className="brand-icon">
        <Icon name="drop" size={24} />
      </span>
      <span>
        BloodChain<small>Bir donorlik. Yagona tizim.</small>
      </span>
    </a>
  );
}
function Heading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <a className="skip" href="#main">
        Asosiy mazmunga o‘tish
      </a>
      <header className="header">
        <div className="container header-inner">
          <Brand />
          <div className="desktop-navigation">
            <PublicNavigation />
          </div>
          <div className="header-actions">
            <a className="sign-in" href="#portals">
              Kirish <Icon name="arrow" size={16} />
            </a>
            <a className="button small" href="#partnership">
              Boshlash
            </a>
            <details className="mobile-menu">
              <summary aria-label="Navigatsiya menyusi">
                <span />
                <span />
                <span />
              </summary>
              <PublicNavigation mobile />
            </details>
          </div>
        </div>
      </header>
      <main id="main">
        <section className="hero" id="overview">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="badge">
                <span className="badge-dot" /> INSONLARNI BOG‘LOVCHI TEXNOLOGIYA
              </span>
              <h1>
                Qon donorligini
                <br />
                <span>yangi bosqichga</span>
                <br />
                olib chiqamiz.
              </h1>
              <p className="hero-lead">
                Donorlar, tibbiyot muassasalari va qon markazlarini yagona raqamli platformada
                bog‘laymiz.
              </p>
              <p className="hero-description">
                Donorlikni rejalashtirish, qon komponentlari bilan bog‘liq jarayonlarni kuzatish va
                muassasalar o‘rtasidagi hamkorlik uchun.
              </p>
              <div className="actions">
                <a className="button donation-button" href={donorPortalUrl}>
                  Donor bo‘lish <Icon name="arrow" size={18} />
                </a>
                <a className="button secondary" href="#partnership">
                  Muassasa sifatida ulanish <Icon name="building" size={18} />
                </a>
              </div>
              <div className="hero-note">
                <span className="small-rule" /> Bir donorlik — yagona tizim — kuchliroq hamjamiyat.
              </div>
            </div>
            <figure className="product-preview">
              <div className="preview-orbit" aria-hidden="true" />
              <div className="desktop-preview">
                <div className="browser-bar">
                  <span />
                  <span />
                  <span />
                  <p>Shifoxona portali</p>
                  <span className="demo-label">DEMO</span>
                </div>
                <Image
                  src="/previews/hospital-dashboard.jpg"
                  alt="BloodChain shifoxona kabineti: talabnomalar, zaxira va ogohlantirishlarning demo ko‘rinishi"
                  width={1440}
                  height={1000}
                  priority
                  sizes="(max-width: 800px) 90vw, 44vw"
                />
              </div>
              <div className="phone-preview">
                <div className="phone-speaker" aria-hidden="true" />
                <Image
                  src="/previews/donor-home.png"
                  alt="Donor mobil ilovasining sintetik demo profil va donorlik tarixiga ega bosh ekrani"
                  width={824}
                  height={1830}
                  priority
                  sizes="(max-width: 800px) 30vw, 16vw"
                />
              </div>
              <div className="connection-label">
                <span className="icon-tile">
                  <Icon name="users" size={20} />
                </span>
                <div>
                  <strong>Alohida rollar. Yagona maqsad.</strong>
                  <span>Donor va muassasa o‘rtasida bog‘liqlik.</span>
                </div>
              </div>
              <figcaption>
                Mahsulotning demo interfeyslari. Versiyaga qarab ko‘rinish farq qilishi mumkin.
              </figcaption>
            </figure>
          </div>
        </section>
        <section className="trust-strip" aria-label="Platforma tamoyillari">
          <div className="container trust-inner">
            <div className="trust-heading">
              <span>ISHONCH — ASOSIY TAMOYIL</span>
              <h2>
                Yordamga texnologiya.
                <br />
                Ma’lumotga mas’uliyat.
              </h2>
            </div>
            {[
              ['shield', 'Maxfiylik', 'Shaxsiy ma’lumotlar ommaviy katalog emas.'],
              ['truck', 'Kuzatuvchanlik', 'Bir-biriga bog‘langan yozuvlar va jarayonlar.'],
              ['users', 'Vakolat nazorati', 'Rol va muassasaga mos ish maydoni.'],
            ].map(([icon, title, text]) => (
              <div className="trust-item" key={title}>
                <Icon name={icon as IconName} />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="section container" id="platform">
          <Heading
            eyebrow="BLOODCHAIN KIMLAR UCHUN?"
            title="Alohida ehtiyojlar. Bir-birini to‘ldiruvchi yechimlar."
            description="Har bir ishtirokchi o‘z vazifasini bilsa, hamkorlik tushunarliroq bo‘ladi."
          />
          <div className="audience-grid">
            {audiences.map((a) => (
              <article
                className={`audience-card ${a.number === '01' ? 'donor-card' : ''}`}
                key={a.title}
              >
                <div className="card-top">
                  <span className="icon-tile">
                    <Icon name={a.icon} size={25} />
                  </span>
                  <span className="card-number">{a.number}</span>
                </div>
                <h3>{a.title}</h3>
                <p>{a.description}</p>
                <ul>
                  {a.items.map((item) => (
                    <li key={item}>
                      <Icon name="check" size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
                <a className="text-link" href={a.href}>
                  {a.link}
                  <Icon name="arrow" size={17} />
                </a>
              </article>
            ))}
          </div>
        </section>
        <section className="solution-section">
          <div className="container solution-grid">
            <div>
              <p className="eyebrow">MUAMMODAN YECHIMGA</p>
              <h2>
                Bir-biridan uzilgan
                <br />
                jarayonlarni bog‘lash.
              </h2>
              <p className="section-lead">
                Donorlik — bitta uchrashuvdan ko‘proq. Uning ortida ma’lumot, tekshiruv, zaxira va
                muassasalar o‘rtasidagi hamkorlik bor.
              </p>
              <a className="text-link" href="#features">
                Platforma imkoniyatlarini ko‘ring <Icon name="arrow" size={17} />
              </a>
            </div>
            <div className="comparison">
              <div>
                <span className="comparison-label">TARQOQ JARAYONLAR</span>
                <h3>Keyingi qadamni topish qiyin.</h3>
                <p>Alohida yozuvlar, qayta so‘raladigan ma’lumot va turli joylardagi holatlar.</p>
              </div>
              <div className="comparison-connected">
                <span className="comparison-label">BOG‘LANGAN ISH MAYDONI</span>
                <h3>Har bir rol uchun aniq kontekst.</h3>
                <p>
                  Qabullar, talabnomalar va komponentlar haqidagi yozuvlarni tegishli jarayondan
                  kuzatish imkoniyati.
                </p>
                <div className="system-nodes">
                  <span>Donor</span>
                  <Icon name="arrow" size={16} />
                  <span>Qon markazi</span>
                  <Icon name="arrow" size={16} />
                  <span>Shifoxona</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="section container" id="donors">
          <div className="workflow-heading">
            <Heading
              eyebrow="DONOR UCHUN QANDAY ISHLAYDI?"
              title="Ezgu niyatdan birinchi qadamgacha."
              description="Murakkab tizimni o‘rganish shart emas. O‘zingizga tegishli jarayonni biling."
            />
            <span className="release-badge">
              <Icon name="drop" size={16} /> Donor web kabineti
            </span>
          </div>
          <ol className="donor-steps">
            {[
              [
                '01',
                'Profil yarating',
                'Kerakli ma’lumotlarni kiriting va donor profilingizni to‘ldiring.',
              ],
              [
                '02',
                'Donorlikka yoziling',
                'Mavjud muassasa, sana va uchrashuv imkoniyatlarini ko‘ring.',
              ],
              [
                '03',
                'Jarayonda qatnashing',
                'Donorlik tarixi va tegishli bildirishnomalarni kuzating.',
              ],
            ].map(([n, t, d]) => (
              <li key={n}>
                <span className="step-number">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
          <div className="donor-notice">
            <Icon name="calendar" size={22} />
            <div>
              <strong>Donor kabinetiga brauzerdan kiring</strong>
              <p>
                Mobil ilovadagi akkauntingiz web kabinetda ham ishlaydi. Qabulga yoziling va tahlil
                natijalarini ko‘ring. Donorlikka yaroqlilikni tibbiyot xodimi baholaydi.
              </p>
            </div>
            <a className="text-link" href={donorPortalUrl}>
              Donor kabinetini ochish <Icon name="arrow" size={16} />
            </a>
          </div>
        </section>
        <section className="features-section" id="features">
          <div className="container">
            <Heading
              eyebrow="PLATFORMA IMKONIYATLARI"
              title="Bitta platforma, turli ish jarayonlari."
              description="Donorlik, laboratoriya va muassasa operatsiyalari uchun bir-birini to‘ldiruvchi modullar."
            />
            <div className="bento-grid">
              <article className="bento-card bento-featured">
                <span className="icon-tile">
                  <Icon name="calendar" size={24} />
                </span>
                <h3>Donorlikni rejalashtirish</h3>
                <p>
                  Uchrashuvlar, eslatmalar va donorlik tarixini bir joyda ko‘rish. Donor uchun
                  tushunarli, muassasa uchun tartibli jarayon.
                </p>
                <div className="mini-flow">
                  <span>
                    <Icon name="building" size={17} /> Muassasa
                  </span>
                  <span>
                    <Icon name="calendar" size={17} /> Sana va vaqt
                  </span>
                  <span>
                    <Icon name="check" size={17} /> Qabul
                  </span>
                </div>
                <span className="module-tag">Donor ilovasi · Qabullar</span>
              </article>
              <article className="bento-card">
                <span className="icon-tile">
                  <Icon name="lab" size={24} />
                </span>
                <h3>Laboratoriya jarayonlari</h3>
                <p>
                  Natijalarni vakolatli xodimlar orqali kiritish, ko‘rib chiqish va e’lon qilish.
                  Diagnostika va komponent xavfsizligi skriningi alohida yuritiladi.
                </p>
                <span className="module-tag">Laboratoriya · Skrining</span>
              </article>
              <article className="bento-card">
                <span className="icon-tile">
                  <Icon name="truck" size={24} />
                </span>
                <h3>Kuzatuvchanlik</h3>
                <p>
                  Qon komponentlari, talabnomalar va jo‘natmalarga bog‘langan yozuvlar. Kerakli
                  jarayonni identifikator va holat orqali topish.
                </p>
                <span className="module-tag">Zaxira · Talabnoma · Jo‘natma</span>
              </article>
              <article className="bento-card bento-dark">
                <span className="icon-tile">
                  <Icon name="shield" size={24} />
                </span>
                <h3>Ruxsatlar va maxfiylik</h3>
                <p>
                  Xodimning roli va tegishli muassasa doirasiga bog‘langan kirish. Muhim amallar
                  uchun audit yozuvlari.
                </p>
                <span className="module-tag">Vakolat · Muassasa · Harakatlar tarixi</span>
              </article>
            </div>
          </div>
        </section>
        <section className="section container" id="portals">
          <Heading
            eyebrow="MUASSASA PORTALLARI"
            title="Ish maydoningizga qayting."
            description="Biriktirilgan hisobingiz bo‘lsa, tegishli portalga kiring. Yangi muassasalar hamkorlik bo‘limidan boshlaydi."
          />
          <div className="portal-grid">
            {audiences.slice(1).map((a) => (
              <a className="portal-card" key={a.title} href={a.href} aria-label={a.link}>
                <span className="icon-tile">
                  <Icon name={a.icon} size={26} />
                </span>
                <div>
                  <h3>
                    {a.title === 'Shifoxonalar' ? 'Shifoxona kabineti' : 'Qon markazi kabineti'}
                  </h3>
                  <p>
                    {a.title === 'Shifoxonalar'
                      ? 'Talabnomalar, yetkazish va qabul qilish.'
                      : 'Qabullar, laboratoriya, zaxira va jo‘natmalar.'}
                  </p>
                </div>
                <Icon name="arrow" size={22} />
              </a>
            ))}
          </div>
          <div className="institution-flow">
            <span>Yangi muassasa uchun:</span>
            <span>Murojaat</span>
            <Icon name="arrow" size={14} />
            <span>Vakolatni tekshirish</span>
            <Icon name="arrow" size={14} />
            <span>Xodimlarni ulash</span>
            <Icon name="arrow" size={14} />
            <span>Kelishilgan xizmatlar</span>
          </div>
        </section>
        <section className="partnership-section" id="partnership">
          <div className="container partnership-grid">
            <div className="partnership-copy">
              <p className="eyebrow">TIBBIYOT MUASSASALARI VA HAMKORLAR UCHUN</p>
              <h2>
                Tibbiyot muassasangizni
                <br />
                <span>BloodChain’ga ulang.</span>
              </h2>
              <p>
                Donorlik va qon bilan bog‘liq jarayonlarni raqamli muhitda tashkil etish bo‘yicha
                hamkorlikni boshlang.
              </p>
              <ul className="partnership-points">
                <li>
                  <Icon name="check" size={18} /> Muassasangiz ehtiyojlarini tushunish
                </li>
                <li>
                  <Icon name="check" size={18} /> Tegishli modullar va ish jarayonlarini muhokama
                  qilish
                </li>
                <li>
                  <Icon name="check" size={18} /> Vakolatlar va ulanish bosqichlarini kelishish
                </li>
              </ul>
              <div className="contact-block">
                <span>Platforma haqida so‘rang</span>
                <a href={`mailto:${partnershipEmail}`}>
                  {partnershipEmail}
                  <Icon name="arrow" size={17} />
                </a>
                <p>Murojaat yuborish avtomatik hisob ochmaydi.</p>
              </div>
            </div>
            <PartnershipForm />
          </div>
        </section>
        <section className="section container faq-section" id="questions">
          <Heading eyebrow="SAVOLLAR VA JAVOBLAR" title="Boshlashdan oldin bilmoqchimisiz?" />
          <div className="faq-grid">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="footer" id="contact">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-about">
              <Brand light />
              <p>
                Donorlar, tibbiyot muassasalari va qon markazlarini bog‘lovchi raqamli platforma.
              </p>
              <span>Bir donorlik. Yagona tizim. Kuchliroq hamjamiyat.</span>
            </div>
            <div>
              <h2>Platforma</h2>
              <a href="#platform">BloodChain haqida</a>
              <a href="#features">Imkoniyatlar</a>
              <a href="#questions">Savollar va javoblar</a>
            </div>
            <div>
              <h2>Boshlash</h2>
              <a href="#donors">Donorlar uchun</a>
              <a href={donorPortalUrl}>Donor kabineti</a>
              <a href="#portals">Muassasalar uchun</a>
              <a href="#partnership">Hamkorlikka murojaat</a>
              <a href="https://admin.bloodchain.uz">Admin kabineti</a>
            </div>
            <div>
              <h2>Aloqa va huquqiy ma’lumot</h2>
              <a className="footer-email" href={`mailto:${partnershipEmail}`}>
                {partnershipEmail}
              </a>
              <a href="/privacy">Maxfiylik haqida</a>
              <a href="/terms">Foydalanish shartlari</a>
              <span className="legal-note">
                Operator rekvizitlari va to‘liq huquqiy hujjatlar tasdiqlanish bosqichida.
              </span>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} BloodChain</span>
            <p>
              Platformadagi ma’lumotlar tibbiy maslahat, tashxis yoki davolash o‘rnini bosmaydi.
              Klinik qarorlarni vakolatli tibbiyot xodimlari qabul qiladi.
            </p>
            <a href="#overview">Yuqoriga ↑</a>
          </div>
        </div>
      </footer>
    </>
  );
}
