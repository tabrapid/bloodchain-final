import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata = {
  title: 'BloodChain Hospital Console',
  description: 'Hospital operations workspace for the BloodChain',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
