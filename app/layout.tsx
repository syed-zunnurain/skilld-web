import type { Metadata } from 'next';

import './globals.css';

const configuredSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://skilld-web.workspace-337605.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(configuredSiteUrl),
  title: 'Skilld Agent Portal',
  description: 'Track provider referrals, wallet rewards, and withdrawals.',
  icons: {
    icon: '/favicon.png',
    apple: '/skilld-app-icon.png',
  },
  openGraph: {
    title: 'Skilld Agent Portal',
    description: 'Manage your Skilld agent account.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Skilld Agent Portal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Skilld Agent Portal',
    description: 'Manage your Skilld agent account.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
