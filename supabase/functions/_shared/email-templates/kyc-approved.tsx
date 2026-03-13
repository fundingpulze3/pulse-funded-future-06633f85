/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text, Button } from 'npm:@react-email/components@0.0.22'

interface Props { siteName: string; siteUrl: string; recipient: string; displayName: string }

const logoUrl = 'https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const KYCApprovedEmail = ({ siteName = 'Funding Pulze', siteUrl = 'https://fundingpulze.com', recipient, displayName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your identity verification has been approved!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}><Img src={logoUrl} width="48" height="48" alt="Funding Pulze" style={logoStyle} /></Section>
        <Heading style={h1}>KYC Approved ✅</Heading>
        <Text style={text}>Hey {displayName || 'trader'},</Text>
        <Text style={text}>Great news! Your identity verification has been <strong>approved</strong>. You're now fully verified on Funding Pulze.</Text>
        <Section style={featureBox}>
          <Text style={featureRow}>✅ Identity verified</Text>
          <Text style={featureRow}>💰 Eligible for payouts</Text>
          <Text style={featureRow}>🔒 Account fully secured</Text>
        </Section>
        <Text style={text}>You can now request payouts and enjoy the full Funding Pulze experience.</Text>
        <Button style={button} href={`${siteUrl}/dashboard`}>Go to Dashboard</Button>
        <Text style={footer}>If you have any questions, reply to this email or contact our support team.</Text>
      </Container>
    </Body>
  </Html>
)

export default KYCApprovedEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Space Grotesk', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '24px' }
const logoStyle = { borderRadius: '12px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0d0d0d', margin: '0 0 16px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#666666', lineHeight: '1.6', margin: '0 0 20px' }
const featureBox = { backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '20px 24px', margin: '0 0 24px', border: '1px solid #bbf7d0' }
const featureRow = { fontSize: '14px', color: '#166534', lineHeight: '2', margin: '0' }
const button = { backgroundColor: '#0d0d0d', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
