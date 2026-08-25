import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata = {
  title: 'DONOR Hospital Console',
  description: 'Hospital operations workspace for the DONOR platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
