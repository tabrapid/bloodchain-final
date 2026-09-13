import type { Metadata } from 'next';
import './globals.css';
import { LocaleProvider } from '@bloodchain/ui/i18n';

export const metadata: Metadata = {
  title: 'Admin Portal - BloodChain',
  description: 'Platform administration and management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
