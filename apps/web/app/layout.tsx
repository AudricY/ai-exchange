import type { Metadata } from 'next';
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
    <html lang="en">
      <body className="bg-gray-900 text-gray-100 min-h-screen">
        <nav className="border-b border-gray-700 px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">AI Exchange</h1>
            <span className="text-gray-400">Market Black Box Agent</span>
          </div>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
