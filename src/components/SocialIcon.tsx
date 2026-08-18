// Simplified, hand-drawn logo marks (same convention as every other icon
// in this app - inline SVG, no icon library) - not pixel-exact brand
// assets, just clearly recognizable at small badge sizes.

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M16.6 2.5c.5 2.4 2 4.1 4.4 4.4v3.1c-1.6 0-3.1-.5-4.4-1.4v6.6c0 3.7-3 6.7-6.7 6.7S3.2 18.9 3.2 15.2 6.2 8.5 9.9 8.5c.4 0 .7 0 1.1.1v3.2a3.5 3.5 0 1 0 2.4 3.3V2.5h3.2Z" />
    </svg>
  );
}

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3.5h15v10.5l-3.5 3.5h-3.8L9.5 20.5H8v-3H4.5v-11L5 3.5Z" />
      <line x1="12.3" y1="7" x2="12.3" y2="11.8" />
      <line x1="16" y1="7" x2="16" y2="11.8" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.3 9.3l5 2.7-5 2.7V9.3Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <path d="M5.5 5.5l13 13" />
      <path d="M18.5 5.5l-13 13" />
    </svg>
  );
}

function KickIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="square" strokeLinejoin="miter">
      <path d="M5.5 4v16" />
      <path d="M5.5 12l7-7.5h4l-8 7.5 8 7.5h-4l-7-7.5Z" />
    </svg>
  );
}

function WebsiteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.4 2.5 3.8 5.7 3.8 9s-1.4 6.5-3.8 9c-2.4-2.5-3.8-5.7-3.8-9s1.4-6.5 3.8-9Z" />
    </svg>
  );
}

export const SOCIAL_ICON_COMPONENTS: Record<string, (props: { className?: string }) => React.JSX.Element> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  twitch: TwitchIcon,
  youtube: YouTubeIcon,
  twitter: XIcon,
  kick: KickIcon,
  website: WebsiteIcon,
};
