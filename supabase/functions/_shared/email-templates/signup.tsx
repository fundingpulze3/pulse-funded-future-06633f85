/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { SocialFooter } from './social-footer.tsx'

interface SignupEmailProps { siteName: string; siteUrl: string; recipient: string; confirmationUrl: string }

const logoUrl = 'https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const SignupEmail = ({ siteName = 'Funding Pulze', siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to Funding Pulze — confirm your email</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}><Img src={logoUrl} width="48" height="48" alt="Funding Pulze" style={logoStyle} /></Section>
        <Heading style={h1}>Welcome aboard!</Heading>
        <Text style={text}>You're one step away from accessing funded trading accounts up to $100K. Confirm your email to get started.</Text>
        <Text style={textSmall}>Your email: <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link></Text>
        <Button style={button} href={confirmationUrl}>Confirm &amp; Get Started</Button>
        <Text style={footer}>If you didn't create a Funding Pulze account, you can safely ignore this email.</Text>
        <SocialFooter />
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Space Grotesk', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '24px' }
const logoStyle = { borderRadius: '12px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0d0d0d', margin: '0 0 16px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#666666', lineHeight: '1.6', margin: '0 0 20px' }
const textSmall = { fontSize: '14px', color: '#666666', lineHeight: '1.5', margin: '0 0 28px' }
const link = { color: '#0d0d0d', textDecoration: 'underline' }
const button = { backgroundColor: '#0d0d0d', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
