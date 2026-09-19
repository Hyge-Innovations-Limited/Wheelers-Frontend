import type { Metadata } from "next";
import { Archivo, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import LandingPage from "@/components/landing/LandingPage";

import "../styles/landing.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-instrument-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-jetbrains-mono",
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
    <LandingPage className={`${archivo.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`} />
  );
}
