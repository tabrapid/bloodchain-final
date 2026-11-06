import './globals.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';

const inter = localFont({
  src: [
    { path: './fonts/Inter_400Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Inter_600SemiBold.ttf', weight: '600', style: 'normal' },
    { path: './fonts/Inter_700Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://bloodchain.uz'),
  title: 'BloodChain — donorlik va qon ta’minoti platformasi',
  description:
    'Donorlar, shifoxonalar va qon markazlari uchun yagona raqamli platforma. Kerakli kabinetingizni tanlang.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
