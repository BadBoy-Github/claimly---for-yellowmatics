import './globals.css';

export const metadata = {
  title: 'Claimly — Monthly claims',
  description: 'A calm, private workspace for preparing monthly expense claims.',
  robots: { index: false, follow: false },
  icons: {
    icon: '/icon.svg',
  },
};

export const viewport = {
  themeColor: '#f5f7f3',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
