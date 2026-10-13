import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import LandingPage from "@/components/landing/LandingPage";

import "../styles/landing.css";

// The rider app's type, so the site and the app read as one product:
// Bricolage Grotesque for headings and prices, Hanken Grotesk for everything else.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

const title = "Ride from WhatsApp. Drive from the app.";
const description =
  "Wheelers is Lagos ride-hailing with no rider app: book on WhatsApp, get a fixed fare before you commit, and get matched to a KYC-verified driver on the Wheelers Driver app for iOS and Android.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${title} | Wheelers`,
    description,
    url: "/",
  },
  twitter: {
    title: `${title} | Wheelers`,
    description,
  },
};

export default function Page() {
  return (
    <LandingPage className={`${bricolage.variable} ${hanken.variable}`} />
  );
}
