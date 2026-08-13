# Funding Pulze Elevate

Create a premium modern website for a platform called Funding Pulze.

Brand & Design

Platform name: Funding Pulze

Theme: Premium, modern, classy

Primary colors:

Deep Blue: #2563EB

Dark Black: #0B0B0F

Accent Blue: #3B82F6

The UI should feel sleek, fintech-style, and slightly “sexy” (clean luxury aesthetic).

Use modern premium fonts such as Inter, Satoshi, or Space Grotesk.

UI should feel similar to modern fintech dashboards.

Dark Mode

Add a dark mode toggle switch in the navbar.

Default theme: Blue + Dark Black

When switched to dark mode:

Theme becomes Black & White minimalist

Background: #000000

Text: #FFFFFF

Animations

Use GSAP animations across the website.

Include:

Scroll-trigger animations

Smooth reveal transitions

Subtle hover effects

Section fade/slide animations

Animations should feel premium and smooth, not excessive.

Navbar

Create a floating sticky navbar that slightly blurs on scroll.

Navbar items:

Logo / Brand: Funding Pulze

Home

FAQ

Affiliate Dashboard

Login button (right side)

User states:

If not logged in → show Login button

If logged in → show profile avatar icon

Navbar behavior:

Floating navbar

Shrinks slightly on scroll

Smooth GSAP animation

Homepage Structure

1. Hero / Landing Section

Bold headline introducing Funding Pulze

Subtitle explaining the platform

CTA buttons:

Start Challenge

View Rules

Animated background or gradient glow

2. Challenge Section

Explain funded account challenges.

Include pricing cards for accounts:

5K Account

10K Account

25K Account

50K Account

100K Account

Each card should include:

Price

Profit target

Max drawdown

CTA button

3. Rules Section

Add a toggle switch between:

One Step Challenge

Two Step Challenge

When switching:

Display rules dynamically.

Example rule structure:

Profit target

Daily drawdown

Maximum drawdown

Minimum trading days

Allowed trading styles

Use smooth GSAP transitions when switching tabs.

4. FAQ Section

Modern accordion-style FAQ.

Example questions:

What is Funding Pulze?

How do funded accounts work?

What is the payout structure?

What trading strategies are allowed?

Animate opening/closing with GSAP.

Footer

Create a premium styled footer.

Include sections:

Company

About

Careers

Resources

FAQ

Blog

Legal

Terms

Privacy Policy

Social Media Icons

Footer style:

Dark

Clean typography

Minimalistic

Backend

Use MongoDB for data storage.

Important requirements:

Do NOT use Supabase.

No Supabase Auth.

All backend data should connect via MongoDB URL.

Data stored in MongoDB:

Users

Login credentials

Affiliate data

Challenge purchases

Tech Stack

Recommended stack:

Next.js

React

Tailwind CSS

GSAP

Node.js backend

MongoDB

Extra Requirements

Fully responsive

Mobile optimized

Fast loading

Clean modular code structure

Component-based architecture

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pulse-funded-future.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/af41cd7c-2bb9-4864-b34b-2e509d26f720).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
