import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read the Wheelers privacy policy for waitlist, ride quote, location data, analytics, and contact information.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy | Wheelers",
    description:
      "Read how Wheelers handles waitlist, ride quote, analytics, and contact information.",
    url: "/privacy",
  },
  twitter: {
    title: "Privacy Policy | Wheelers",
    description:
      "Read how Wheelers handles waitlist, ride quote, analytics, and contact information.",
  },
};

const policySections = [
  {
    title: "1. Information we collect",
    body: [
      "When you join the waitlist, we collect the details you submit, including your name, email address, optional phone number, transport preferences, survey answers, optional feedback, consent to be contacted, and submission time.",
      "When you use ride quote or location search features, we may process pickup and destination searches, approximate route or distance information, and the quote results needed to return a fare estimate.",
      "We also collect basic technical and usage information such as browser type, device information, pages visited, referral information, IP-derived location, and interactions with the site. We use Microsoft Clarity to help understand how visitors use Wheelers.",
    ],
  },
  {
    title: "2. Location data",
    body: [
      "Wheelers collects and processes location data to provide ride-hailing services. For the Wheelers Driver app, location data may be collected while the app is in use and, where required for service functionality, when the app is running in the background.",
      "We use location data to match drivers with nearby ride requests, provide navigation and route guidance, calculate trip distances and fares, improve service quality and operational efficiency, and enhance safety and fraud prevention measures.",
      "Location data is only collected with your permission and can be managed through your device settings. We do not sell your location information to third parties.",
      "We may share necessary location information with riders using the Wheelers platform, mapping and navigation service providers, and legal authorities when required by law.",
      "You can disable location permissions through your device settings. However, some features of the Wheelers Driver app may not function properly without access to location data.",
    ],
  },
  {
    title: "3. How we use information",
    body: [
      "We use your information to manage the waitlist, understand rider and driver needs, improve pricing and route experiences, respond to early access interest, test product ideas, detect abuse, keep the website reliable, and measure site performance.",
      "If you gave contact consent, we may contact you about early access, research, testing, launch updates, or follow-up questions related to Wheelers.",
    ],
  },
  {
    title: "4. Cookies and analytics",
    body: [
      "Wheelers may use cookies, similar technologies, and analytics scripts to remember site preferences, understand traffic patterns, debug issues, and improve the product experience.",
      "Microsoft Clarity may capture usage data such as clicks, scrolling, page visits, and general device or browser details. This helps us identify confusing parts of the site and improve the experience.",
    ],
  },
  {
    title: "5. Sharing information",
    body: [
      "We do not sell your personal information. We may share information with service providers that help us operate the website, store waitlist submissions, provide analytics, calculate routes or locations, host the product, or communicate with users.",
      "We may also disclose information if required by law, to protect users and the Wheelers service, or as part of a business transfer such as a merger, acquisition, or reorganization.",
    ],
  },
  {
    title: "6. Data retention",
    body: [
      "We keep waitlist and survey information for as long as needed to build, launch, improve, and operate Wheelers, unless a longer period is required by law or a shorter period is appropriate for product, safety, or operational reasons.",
      "Ride quote, analytics, and technical logs may be kept for shorter operational periods or according to the retention settings of the services we use.",
    ],
  },
  {
    title: "7. Your choices",
    body: [
      "You can choose not to submit waitlist information or optional fields. You can also avoid ride quote and location search features if you do not want those searches processed.",
      "You may request access, correction, deletion, or withdrawal from Wheelers contact messages through the contact channels available on our website or in messages we send you.",
    ],
  },
  {
    title: "8. Security",
    body: [
      "We use reasonable technical and organizational measures to protect information submitted to Wheelers. No website or online service can guarantee absolute security, so we work to limit access and keep data handling focused on legitimate product needs.",
    ],
  },
  {
    title: "9. Children",
    body: [
      "Wheelers is not intended for children, and we do not knowingly collect personal information from children. If you believe a child has submitted personal information, contact us so we can review and remove it where appropriate.",
    ],
  },
  {
    title: "10. Changes to this policy",
    body: [
      "We may update this Privacy Policy as Wheelers evolves. If we make material changes, we will update the date on this page and may provide additional notice where appropriate.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="page-shell privacy-page">
      <Navbar />

      <section className="privacy-hero">
        <div className="hero-grid-bg" />
        <div className="privacy-hero-inner">
          <div className="section-eyebrow">Privacy Policy</div>
          <h1 className="privacy-title clash-display">
            How Wheelers handles <em>your data.</em>
          </h1>
          <p className="privacy-lead">
            This policy explains what Wheelers collects through this website,
            the waitlist, ride quote tools, analytics, and contact forms, and
            how that information is used.
          </p>
          <div className="privacy-meta mono">
            <span>Effective date: June 5, 2026</span>
            <span>Last updated: June 5, 2026</span>
          </div>
        </div>
      </section>

      <section className="privacy-content" aria-label="Privacy policy content">
        <aside className="privacy-summary">
          <h2>At a glance</h2>
          <p>
            Wheelers uses information to run the waitlist, improve electric ride
            hailing, calculate route estimates, contact people who opted in, and
            keep the site reliable.
          </p>
          <Link href="/waitlist" className="btn-glow syne">
            Join the waitlist
          </Link>
        </aside>

        <div className="privacy-policy-stack">
          {policySections.map((section) => (
            <article className="privacy-policy-card" key={section.title}>
              <h2>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}

          <article className="privacy-policy-card privacy-contact-card">
            <h2>11. Contact</h2>
            <p>
              For privacy questions or data requests, use the official Wheelers
              contact channels available on this website or in Wheelers
              communications.
            </p>
          </article>
        </div>
      </section>

      <Footer />
    </main>
  );
}
