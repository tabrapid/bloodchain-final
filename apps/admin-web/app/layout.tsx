import localFont from 'next/font/local';
import type { Metadata } from 'next';
import './globals.css';
import { LocaleProvider } from '@bloodchain/ui/i18n';

const portalFont = localFont({
  src: [
    {
      path: '../../../packages/ui/assets/fonts/Inter_400Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../../packages/ui/assets/fonts/Inter_600SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    { path: '../../../packages/ui/assets/fonts/Inter_700Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-portal',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Admin Portal - BloodChain',
  description: 'Platform administration and management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className={portalFont.variable}>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
