

# Homepage Premium Upgrade Plan

## Current State
The homepage has: Hero (interactive grid), StatsBar (count-up), WhyChoose (4 cards), Shop (challenge pricing), Roadmap (4 steps), CertificateShowcase, Testimonials, Community (dot grid), GlobeCTA, Footer. The design is clean grayscale with canvas-based interactive backgrounds.

## What to Build

### 1. Marquee Trust Bar (new section, after Hero before StatsBar)
An infinite-scrolling horizontal marquee of partner/broker logos and trust badges (e.g. "As Seen On", "Partnered With"). Two rows scrolling in opposite directions. Gives immediate credibility and a $10M site feel. Uses CSS animation only — no JS overhead.

### 2. Upgraded Hero Section
- Add a **live ticker** strip below the hero subtitle showing real-time-style data: "John D. just got funded $50K", "Payout of $8,200 sent to Sarah W." — auto-cycling with smooth fade transitions. Creates urgency and social proof.
- Add subtle **particle float** effect — small dots that drift upward slowly behind the text, adding depth without distracting from the grid.

### 3. "How It Works" Animated Counter Comparison (new section, after WhyChoose)
A side-by-side visual comparing "Other Prop Firms" vs "Funding Pulze" with animated bars/counters for metrics like payout speed, profit split, spread, support response time. Auto-animates on scroll. Competitive differentiation done visually.

### 4. Live Payout Feed (new section, after Shop)
A sleek real-time-style feed showing recent payouts: name (partially masked), amount, country flag, time ago. Auto-scrolls vertically. Creates FOMO and trust. Uses mock data for now with option to connect to real DB later.

### 5. Platform Preview / Dashboard Mockup (new section, after Roadmap)
A floating browser-frame mockup showing a stylized trading dashboard screenshot or animated SVG. Parallax tilt on mouse hover using CSS perspective transforms. Shows users what they'll get access to.

### 6. Smooth Section Transitions
Add subtle gradient dividers between sections — thin lines that fade from transparent to foreground/5% and back. Replaces abrupt section boundaries with fluid visual flow.

### 7. Scroll Progress Indicator
A thin progress bar fixed at the top of the viewport that fills as the user scrolls down the page. Subtle foreground color with low opacity.

---

## User-Facing Features to Add (beyond visual)

These are features that would make the platform more complete for traders:

- **User Dashboard** — After login, show account status, challenge progress, profit/loss chart, payout history
- **Leaderboard** — Public ranking of top-performing funded traders (weekly/monthly)
- **Referral Program Tracker** — Visual dashboard for the affiliate system with unique links, conversion stats, and earnings
- **Live Chat Widget** — Embedded support chat bubble on all pages
- **Email Notifications** — Automated emails for challenge pass/fail, payout processed, new blog post
- **Multi-language Support** — i18n for global reach (the site already serves 85+ countries)

---

## Technical Approach

### Files to create:
- `src/components/MarqueeTrustBar.tsx` — infinite CSS marquee with logo placeholders
- `src/components/LiveTicker.tsx` — auto-cycling social proof ticker for Hero
- `src/components/ComparisonSection.tsx` — animated bar comparison
- `src/components/PayoutFeed.tsx` — vertical auto-scroll payout feed
- `src/components/PlatformPreview.tsx` — parallax browser mockup
- `src/components/ScrollProgress.tsx` — top progress bar

### Files to modify:
- `src/pages/Index.tsx` — add new sections in order
- `src/components/Hero.tsx` — integrate LiveTicker + particle layer
- `src/index.css` — add marquee keyframes, section divider utilities

### Animation approach:
- Marquee: pure CSS `@keyframes` for infinite scroll
- LiveTicker: `setInterval` + Framer Motion `AnimatePresence` for cycling
- Comparison bars: Framer Motion `useInView` + animated width
- Payout feed: CSS `@keyframes` vertical scroll or `setInterval` cycling
- Platform preview: CSS `perspective` + `rotateX/Y` on `mousemove`
- Scroll progress: `window.scrollY / document.body.scrollHeight` on scroll event
- Section dividers: Tailwind gradient utility class

### Homepage order after changes:
Hero (with LiveTicker + particles) → MarqueeTrustBar → StatsBar → WhyChoose → ComparisonSection → Shop → PayoutFeed → Roadmap → PlatformPreview → CertificateShowcase → Testimonials → Community → GlobeCTA → Footer

