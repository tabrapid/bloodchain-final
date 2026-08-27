import './globals.css';
import 'leaflet/dist/leaflet.css';

export const metadata = {
  title: 'BloodChain Blood Center Console',
  description: 'Blood center operations workspace for the BloodChain',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
