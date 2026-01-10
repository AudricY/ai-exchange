import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Exchange - Market Black Box Agent',
  description: 'Double-auction mini exchange with forensic analysis',
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
              <h1 className="text-xl font-bold">AI Exchange</h1>
            </Link>
            <span className="text-muted-foreground">Market Black Box Agent</span>
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
