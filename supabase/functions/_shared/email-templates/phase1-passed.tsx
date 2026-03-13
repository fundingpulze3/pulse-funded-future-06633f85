/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text, Button } from 'npm:@react-email/components@0.0.22'
import { SocialFooter } from './social-footer.tsx'

interface Props { siteName: string; siteUrl: string; recipient: string; accountNumber: string; profit: string; profitPercent: string }

const logoUrl = 'https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const Phase1PassedEmail = ({ siteName = 'Funding Pulze', siteUrl = 'https://fundingpulze.com', recipient, accountNumber, profit, profitPercent }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>🎉 Phase 1 Challenge Passed — Account #{accountNumber}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}><Img src={logoUrl} width="48" height="48" alt="Funding Pulze" style={logoStyle} /></Section>
        <Heading style={h1}>Phase 1 Passed! ✅</Heading>
        <Text style={text}>Incredible work! You've successfully passed Phase 1 of your trading challenge. You're one step closer to getting funded.</Text>
        <Section style={successBox}>
          <Text style={successRow}><strong>Account:</strong> #{accountNumber}</Text>
          <Text style={successRow}><strong>Profit:</strong> {profit} ({profitPercent})</Text>
          <Text style={successRow}><strong>Status:</strong> ✅ Phase 1 Complete</Text>
          <Text style={successRow}><strong>Next:</strong> Phase 2 Verification</Text>
        </Section>
        <Text style={text}>You'll now move on to Phase 2. Maintain your discipline — the same rules apply. We believe in you!</Text>
        <Button style={button} href={`${siteUrl}/dashboard`}>View Your Dashboard</Button>
        <Text style={footer}>Keep pushing — funded accounts await! 🏆</Text>
        <SocialFooter />
      </Container>
    </Body>
  </Html>
)

export default Phase1PassedEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Space Grotesk', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '24px' }
const logoStyle = { borderRadius: '12px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0d0d0d', margin: '0 0 16px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#666666', lineHeight: '1.6', margin: '0 0 20px' }
const successBox = { backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '20px 24px', margin: '0 0 24px', border: '1px solid #bbf7d0' }
const successRow = { fontSize: '14px', color: '#166534', lineHeight: '2', margin: '0' }
const button = { backgroundColor: '#0d0d0d', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
