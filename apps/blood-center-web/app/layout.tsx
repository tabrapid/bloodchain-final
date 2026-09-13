import './globals.css';
import { LocaleProvider } from '@bloodchain/ui/i18n';
import 'leaflet/dist/leaflet.css';

export const metadata = {
  title: 'BloodChain Blood Center Console',
  description: 'Blood center operations workspace for the BloodChain',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
