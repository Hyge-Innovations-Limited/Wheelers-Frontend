import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for using Wheelers as a rider or a driver: accounts, prices, payment, cancelling, and conduct.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Service | Wheelers",
    description: "The terms for using Wheelers as a rider or a driver.",
    url: "/terms",
  },
  twitter: {
    title: "Terms of Service | Wheelers",
    description: "The terms for using Wheelers as a rider or a driver.",
  },
};

const termsSections = [
  {
    title: "1. About these terms",
    body: [
      "These terms apply when you use Wheelers to request a ride or to drive, in the Wheelers app or through Wheelers on WhatsApp. By creating an account or booking a ride you agree to them.",
      "Wheelers connects riders who want a ride with drivers who offer one. Riders say what they are willing to pay, and drivers accept that price or answer with their own.",
    ],
  },
  {
    title: "2. Your account",
    body: [
      "You must be at least 18 years old to use Wheelers. Give us accurate details and keep them up to date.",
      "Riders sign in with a phone number and a code we send to it. Drivers sign in with Apple, Google or email. You are responsible for what happens on your account, so keep your phone, your codes and your wallet PIN to yourself.",
      "One person, one account. Do not let someone else ride or drive on yours.",
    ],
  },
  {
    title: "3. Booking a ride and agreeing a price",
    body: [
      "When you book, Wheelers shows a suggested price and the lowest price you may offer for that trip. You choose the price you offer.",
      "Drivers near you can accept your price or reply with a different one. You are free to accept any offer, change your price, or decline. A ride is agreed only when you accept a driver's offer.",
      "The price you agree is the total for that trip. It already includes VAT and the Wheelers service charge. If you add or change a stop during the trip, the price is worked out again and shown to you.",
    ],
  },
  {
    title: "4. Paying",
    body: [
      "Rides are paid from your Wheelers wallet. You add money to the wallet by bank transfer to the account number shown in the app.",
      "When you accept a driver, the agreed price is held in your wallet. It is charged when the trip is completed. If the ride is cancelled, or no driver accepts, the held amount goes back to your wallet.",
      "You can withdraw money from your wallet to your bank account. A withdrawal fee applies and is shown before you confirm.",
    ],
  },
  {
    title: "5. Cancelling",
    body: [
      "You can cancel a search at any time and nothing is charged. You can also cancel after a driver has accepted; please do it as early as you can and tell us why.",
      "A driver may cancel too. If that happens we look for another driver for you where we can.",
      "Wheelers may introduce a cancellation fee in future. If we do, the app will show it before you cancel.",
    ],
  },
  {
    title: "6. Scheduled rides",
    body: [
      "You can book a ride for a later time. We start looking for a driver shortly before that time. A scheduled ride is a request, not a guarantee that a driver will accept it.",
    ],
  },
  {
    title: "7. Drivers",
    body: [
      "To drive with Wheelers you must complete verification and keep your licence and your vehicle's papers valid. You must tell us if any of them changes, expires or is withdrawn.",
      "You choose which trips to offer on and at what price. Wheelers keeps a commission and any charges shown in the app from each completed trip; the rest is paid into your wallet.",
      "You are responsible for your vehicle, for driving safely and lawfully, and for the taxes and levies that apply to you.",
    ],
  },
  {
    title: "8. Safety and conduct",
    body: [
      "Treat each other with respect. Do not threaten, harass or discriminate against anyone you meet through Wheelers.",
      "Riders: be at the pickup point, give the trip code only to your driver once you are in the car, and wear a seat belt. Drivers: confirm the trip code before starting, follow the route, and do not carry anyone who is not part of the booking.",
      "In an emergency, use the Emergency button in the app and call the emergency services.",
      "We may suspend or close an account that breaks these terms, that is used for fraud, or that puts other people at risk.",
    ],
  },
  {
    title: "9. Referrals and cashback",
    body: [
      "If you share a referral code or use one, the rewards and their conditions are the ones shown in the app at the time. Ride cashback can only be used towards rides and has no cash value. We may withdraw rewards obtained by abuse.",
    ],
  },
  {
    title: "10. Our responsibility",
    body: [
      "We work to keep Wheelers available and accurate, but we do not promise that a driver will always be available, that a trip will take a particular time, or that the service will never be interrupted.",
      "Nothing in these terms limits any right you have under the law that cannot be limited.",
    ],
  },
  {
    title: "11. Changes to these terms",
    body: [
      "We may update these terms as Wheelers changes. When we make a material change we will update the date on this page and tell you in the app or on WhatsApp where appropriate. If you keep using Wheelers after a change, you accept the updated terms.",
    ],
  },
  {
    title: "12. Law",
    body: [
      "These terms are governed by the laws of the Federal Republic of Nigeria.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="page-shell privacy-page">
      <Navbar />

      <section className="privacy-hero">
        <div className="hero-grid-bg" />
        <div className="privacy-hero-inner">
          <div className="section-eyebrow">Terms of Service</div>
          <h1 className="privacy-title clash-display">
            The terms for riding and <em>driving with Wheelers.</em>
          </h1>
          <p className="privacy-lead">
            What you can expect from Wheelers, and what we ask of you, whether
            you book rides or drive.
          </p>
          <div className="privacy-meta mono">
            <span>Effective date: October 12, 2026</span>
            <span>Last updated: October 12, 2026</span>
          </div>
        </div>
      </section>

      <section className="privacy-content" aria-label="Terms of service content">
        <aside className="privacy-summary">
          <h2>At a glance</h2>
          <p>
            You set your price and choose your driver. The price you agree is
            the total you pay. It is held in your wallet when you accept a
            driver and charged when the trip is done.
          </p>
          <Link href="/privacy" className="btn-glow syne">
            Read the Privacy Policy
          </Link>
        </aside>

        <div className="privacy-policy-stack">
          {termsSections.map((section) => (
            <article className="privacy-policy-card" key={section.title}>
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}

          <article className="privacy-policy-card privacy-contact-card">
            <h2>13. Contact</h2>
            <p>
              For questions about these terms, use Help and support in the
              Wheelers app, or the official Wheelers contact channels on this
              website.
            </p>
          </article>
        </div>
      </section>

      <Footer />
    </main>
  );
}
