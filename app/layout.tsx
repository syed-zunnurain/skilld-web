import type { Metadata } from 'next';

import './globals.css';

const configuredSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://skilld-web.workspace-337605.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(configuredSiteUrl),
  title: 'Create your Skilld account',
  description: 'Register as a Skilld customer or service provider, then continue in the mobile app.',
  icons: {
    icon: '/favicon.png',
    apple: '/skilld-app-icon.png',
  },
  openGraph: {
    title: 'Create your Skilld account',
    description: 'Register here. Continue in the app.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Create your Skilld account' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Create your Skilld account',
    description: 'Register here. Continue in the app.',
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
