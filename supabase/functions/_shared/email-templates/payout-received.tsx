/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text, Button } from 'npm:@react-email/components@0.0.22'
import { SocialFooter } from './social-footer.tsx'

interface Props { siteName: string; siteUrl: string; recipient: string; accountNumber: string; payoutAmount: string; payoutNumber: string }

const logoUrl = 'https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const PayoutReceivedEmail = ({ siteName = 'Funding Pulze', siteUrl = 'https://fundingpulze.com', recipient, accountNumber, payoutAmount, payoutNumber }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>💰 Payout #{payoutNumber} processed — {payoutAmount} sent!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}><Img src={logoUrl} width="48" height="48" alt="Funding Pulze" style={logoStyle} /></Section>
        <Heading style={h1}>Payout Received! 💰</Heading>
        <Text style={text}>Great news — your payout has been processed and the funds are on the way!</Text>
        <Section style={payoutBox}>
          <Text style={payoutRow}><strong>Account:</strong> #{accountNumber}</Text>
          <Text style={payoutRow}><strong>Payout #:</strong> {payoutNumber}</Text>
          <Text style={payoutRow}><strong>Amount:</strong> {payoutAmount} (90% split)</Text>
          <Text style={payoutRow}><strong>Processing:</strong> 24-48 hours</Text>
        </Section>
        <Text style={text}>Keep up the amazing work. Consistent profitable trading unlocks scaling up to $1,000,000!</Text>
        <Button style={button} href={`${siteUrl}/dashboard`}>View Your Dashboard</Button>
        <Text style={footer}>Thank you for trading with Funding Pulze. More payouts await! 🚀</Text>
        <SocialFooter />
      </Container>
    </Body>
  </Html>
)

export default PayoutReceivedEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Space Grotesk', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '24px' }
const logoStyle = { borderRadius: '12px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0d0d0d', margin: '0 0 16px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#666666', lineHeight: '1.6', margin: '0 0 20px' }
const payoutBox = { backgroundColor: '#faf5ff', borderRadius: '12px', padding: '20px 24px', margin: '0 0 24px', border: '1px solid #e9d5ff' }
const payoutRow = { fontSize: '14px', color: '#581c87', lineHeight: '2', margin: '0' }
const button = { backgroundColor: '#0d0d0d', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
