/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text, Button } from 'npm:@react-email/components@0.0.22'
import { SocialFooter } from './social-footer.tsx'

interface Props { siteName: string; siteUrl: string; recipient: string; accountNumber: string; breachValue: string; limit: string }

const logoUrl = 'https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const MaxDDBreachEmail = ({ siteName = 'Funding Pulze', siteUrl = 'https://fundingpulze.com', recipient, accountNumber, breachValue, limit }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>⚠️ Max drawdown limit breached on account #{accountNumber}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}><Img src={logoUrl} width="48" height="48" alt="Funding Pulze" style={logoStyle} /></Section>
        <Heading style={h1}>Max Drawdown Breach ⚠️</Heading>
        <Text style={text}>Unfortunately, your trading account has exceeded the maximum overall drawdown limit.</Text>
        <Section style={alertBox}>
          <Text style={alertRow}><strong>Account:</strong> #{accountNumber}</Text>
          <Text style={alertRow}><strong>Max Drawdown:</strong> {breachValue}</Text>
          <Text style={alertRow}><strong>Limit:</strong> {limit}</Text>
          <Text style={alertRow}><strong>Status:</strong> ❌ Breached</Text>
        </Section>
        <Text style={text}>Don't give up! Many successful traders fail multiple times before passing. Try again with a fresh challenge.</Text>
        <Button style={button} href={siteUrl}>Start a New Challenge</Button>
        <Text style={footer}>If you believe this is an error, please contact support immediately.</Text>
        <SocialFooter />
      </Container>
    </Body>
  </Html>
)

export default MaxDDBreachEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Space Grotesk', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '24px' }
const logoStyle = { borderRadius: '12px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 16px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#666666', lineHeight: '1.6', margin: '0 0 20px' }
const alertBox = { backgroundColor: '#fef2f2', borderRadius: '12px', padding: '20px 24px', margin: '0 0 24px', border: '1px solid #fecaca' }
const alertRow = { fontSize: '14px', color: '#991b1b', lineHeight: '2', margin: '0' }
const button = { backgroundColor: '#0d0d0d', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
