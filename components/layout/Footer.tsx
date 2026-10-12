import Link from "next/link";

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "For Riders", href: "/#riders" },
      { label: "For Drivers", href: "/#drivers" },
      { label: "DeFi Features", href: "/#features" },
      { label: "Schedule Rides", href: "/#how" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/#riders" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
      { label: "Community", href: "#" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "#" },
      { label: "Safety", href: "#" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Terms of Service", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-wordmark clash-display clash-display--footer-wordmark">Wheelers</div>
          <div className="footer-tagline">ride. earn. own.</div>
          <p className="footer-body">
            The first community-owned ride-hailing platform. Built on the blockchain.
            Powered by its users.
          </p>
        </div>

        {footerColumns.map((column) => (
          <div className="footer-col" key={column.title}>
            <h4>{column.title}</h4>
            {column.links.map((link) => (
              <Link href={link.href} key={link.label}>
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="footer-bottom">
        <p>(c) 2025 Wheelers | All rights reserved</p>
        <div className="footer-social">
          {["X", "in", "ig", "tg"].map((label) => (
            <Link href="#" className="social-btn" key={label}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="footer-hyge">
        <p>
          A product of <strong>HYGE Innovations Limited</strong>
        </p>
      </div>
    </footer>
  );
}
