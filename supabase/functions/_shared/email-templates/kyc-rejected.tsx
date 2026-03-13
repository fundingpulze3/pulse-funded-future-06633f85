/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text, Button } from 'npm:@react-email/components@0.0.22'

interface Props { siteName: string; siteUrl: string; recipient: string; displayName: string; reviewNote: string }

const logoUrl = 'https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const KYCRejectedEmail = ({ siteName = 'Funding Pulze', siteUrl = 'https://fundingpulze.com', recipient, displayName, reviewNote }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your identity verification needs attention</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}><Img src={logoUrl} width="48" height="48" alt="Funding Pulze" style={logoStyle} /></Section>
        <Heading style={h1}>KYC Verification Update</Heading>
        <Text style={text}>Hey {displayName || 'trader'},</Text>
        <Text style={text}>Unfortunately, your identity verification could not be approved at this time. Please review the details below and resubmit.</Text>
        {reviewNote ? (
          <Section style={noteBox}>
            <Text style={noteLabel}>Reason:</Text>
            <Text style={noteText}>{reviewNote}</Text>
          </Section>
        ) : null}
        <Text style={text}>Common reasons for rejection include unclear document photos, mismatched information, or incomplete video verification. Please ensure all documents are clearly visible and up to date.</Text>
        <Button style={button} href={`${siteUrl}/dashboard/kyc`}>Resubmit KYC</Button>
        <Text style={footer}>Need help? Reply to this email or contact our support team.</Text>
      </Container>
    </Body>
  </Html>
)

export default KYCRejectedEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Space Grotesk', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '24px' }
const logoStyle = { borderRadius: '12px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0d0d0d', margin: '0 0 16px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#666666', lineHeight: '1.6', margin: '0 0 20px' }
const noteBox = { backgroundColor: '#fef2f2', borderRadius: '12px', padding: '16px 20px', margin: '0 0 24px', border: '1px solid #fecaca' }
const noteLabel = { fontSize: '13px', fontWeight: '600' as const, color: '#991b1b', margin: '0 0 4px' }
const noteText = { fontSize: '14px', color: '#7f1d1d', lineHeight: '1.5', margin: '0' }
const button = { backgroundColor: '#0d0d0d', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
