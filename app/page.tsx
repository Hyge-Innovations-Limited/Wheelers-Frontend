import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import LandingPage from "@/components/landing/LandingPage";

import "../styles/landing.css";

// One clean, round sans for the whole page: headings in bold, the rest regular.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
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
    <LandingPage className={poppins.variable} />
  );
}
