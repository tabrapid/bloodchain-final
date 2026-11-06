'use client';

const links = [
  ['#platform', 'Platforma'],
  ['#donors', 'Donorlar uchun'],
  ['#portals', 'Muassasalar uchun'],
  ['#partnership', 'Hamkorlik'],
  ['#questions', 'FAQ'],
];
export function PublicNavigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav aria-label={mobile ? 'Mobil navigatsiya' : 'Asosiy navigatsiya'}>
      {links.map(([href, label]) => (
        <a
          key={href}
          href={href}
          onClick={(e) => {
            if (mobile) {
              const menu = e.currentTarget.closest('details');
              if (menu) menu.open = false;
            }
          }}
        >
          {label}
        </a>
      ))}
      {mobile && (
        <a className="button" href="#partnership">
          Boshlash
        </a>
      )}
    </nav>
  );
}
