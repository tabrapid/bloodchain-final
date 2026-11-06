import localFont from 'next/font/local';
import './globals.css';
import { LocaleProvider } from '@bloodchain/ui/i18n';
import 'leaflet/dist/leaflet.css';

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

export const metadata = {
  title: 'BloodChain Blood Center Console',
  description: 'Blood center operations workspace for the BloodChain',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className={`${portalFont.variable} antialiased`}>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
