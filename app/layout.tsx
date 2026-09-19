import type { Metadata } from "next";
import Script from "next/script";
import { getSiteUrl } from "@/lib/site-url";

import "./globals.css";
import "../styles/globals.css";
import "../styles/animations.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Wheelers | Ride. Earn. Own.",
    template: "%s | Wheelers",
  },
  description:
    "Wheelers is a ride-hailing platform focused on fixed pricing, electric mobility, and a cleaner booking experience.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Wheelers | Ride. Earn. Own.",
    description:
      "Wheelers is a ride-hailing platform focused on fixed pricing, electric mobility, and a cleaner booking experience.",
    url: siteUrl,
    siteName: "Wheelers",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wheelers | Ride. Earn. Own.",
    description:
      "Wheelers is a ride-hailing platform focused on fixed pricing, electric mobility, and a cleaner booking experience.",
  },
  icons: {
    icon: "/icon",
    shortcut: "/icon",
    apple: "/apple-icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light only" />
        <meta name="facebook-domain-verification" content="qaqcufqsuatlt9ltcfli3b4pp4tp52" />
      </head>
      <body>
        {/* Microsoft Clarity Analytics */}
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
        >
          {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "wmu6sf67cc");`}
        </Script>

        {children}
      </body>
    </html>
  );
}