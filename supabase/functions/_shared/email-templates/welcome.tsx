/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text, Button } from 'npm:@react-email/components@0.0.22'

interface Props { siteName: string; siteUrl: string; recipient: string; displayName: string }

const logoUrl = 'https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const WelcomeEmail = ({ siteName = 'Funding Pulze', siteUrl = 'https://fundingpulze.com', recipient, displayName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to Funding Pulze — your journey to funded trading starts now!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}><Img src={logoUrl} width="48" height="48" alt="Funding Pulze" style={logoStyle} /></Section>
        <Heading style={h1}>Welcome to Funding Pulze! 🎯</Heading>
        <Text style={text}>Hey {displayName || 'trader'},</Text>
        <Text style={text}>You've just joined the most trader-friendly prop firm. Here's what you can do:</Text>
        <Section style={featureBox}>
          <Text style={featureRow}>🏆 <strong>Choose a Challenge</strong> — Pick from 1-Step or 2-Step challenges, $5K to $100K</Text>
          <Text style={featureRow}>📊 <strong>Trade & Prove Yourself</strong> — Hit profit targets while staying within drawdown limits</Text>
          <Text style={featureRow}>💰 <strong>Get Funded & Earn</strong> — 90% profit split, payouts in 24-48 hours</Text>
          <Text style={featureRow}>📈 <strong>Scale Up</strong> — Grow your account up to $1,000,000</Text>
        </Section>
        <Text style={text}>Ready to start? Pick your challenge and begin trading today.</Text>
        <Button style={button} href={siteUrl}>Get Your Challenge</Button>
        <Text style={footer}>Need help? Our support team is available 24/7. Just reply to this email.</Text>
      </Container>
    </Body>
  </Html>
)

export default WelcomeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Space Grotesk', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '24px' }
const logoStyle = { borderRadius: '12px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0d0d0d', margin: '0 0 16px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#666666', lineHeight: '1.6', margin: '0 0 20px' }
const featureBox = { backgroundColor: '#f8f8f8', borderRadius: '12px', padding: '20px 24px', margin: '0 0 24px' }
const featureRow = { fontSize: '14px', color: '#333333', lineHeight: '2', margin: '0' }
const button = { backgroundColor: '#0d0d0d', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
