import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mega Auction — Realtime IPL-Style Multiplayer Auction',
  description: 'Live multiplayer sports auction platform with real-time bidding, server authority, and automated bots.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        {children}
      </body>
    </html>
  );
}
