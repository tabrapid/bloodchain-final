import './globals.css';

export const metadata = {
  title: 'DONOR Blood Center Console',
  description: 'Blood center operations workspace for the DONOR platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
