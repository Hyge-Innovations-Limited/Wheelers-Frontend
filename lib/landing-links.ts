export const APP_STORE_URL =
  "https://apps.apple.com/ng/app/wheelers-driver/id6802810113";

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.timmy133.wheelers.driver";

// Set NEXT_PUBLIC_WHATSAPP_NUMBER (digits only, with country code) to point
// the "Ride on WhatsApp" buttons at the live Wheelers business number.
const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || "2348141979106";

export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

// Where Wheelers lives online.
export const SOCIAL_LINKS = [
  { name: "TikTok", icon: "tiktok", href: "https://www.tiktok.com/@_wheelersng" },
  { name: "Instagram", icon: "instagram", href: "https://instagram.com/_wheelersng" },
  { name: "X", icon: "x", href: "https://x.com/_wheelers" },
] as const;

// The riders' and drivers' community, on WhatsApp.
export const COMMUNITY_URL = "https://chat.whatsapp.com/H4EzW4IUm6N2BhdbQfBveA";
