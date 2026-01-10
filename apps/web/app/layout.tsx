import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'ForensiX - Market Forensics Agent',
  description: 'Synthetic market simulator with AI-powered forensic analysis',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <nav className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <h1 className="text-xl font-bold">ForensiX</h1>
            </Link>
            <span className="text-muted-foreground">Market Forensics Agent</span>
            <div className="flex-1" />
            <Link href="/" className="text-sm hover:text-foreground text-muted-foreground">
              Sessions
            </Link>
          </div>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
