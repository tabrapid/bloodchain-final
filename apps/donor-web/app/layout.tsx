import localFont from 'next/font/local';
import './globals.css';
const donorFont = localFont({
  src: [
    { path: '../../../packages/ui/assets/fonts/Inter_400Regular.ttf', weight: '400' },
    { path: '../../../packages/ui/assets/fonts/Inter_600SemiBold.ttf', weight: '600' },
    { path: '../../../packages/ui/assets/fonts/Inter_700Bold.ttf', weight: '700' },
  ],
  variable: '--font-portal',
  display: 'swap',
});
import { LocaleProvider } from '@bloodchain/ui/i18n';
export const metadata = {
  title: 'BloodChain — Donor kabineti',
  description: 'Donatsiya, tahlillar va sog‘liq ma’lumotlari uchun shaxsiy kabinet',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className={donorFont.variable}>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
