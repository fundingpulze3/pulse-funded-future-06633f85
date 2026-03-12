/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text, Button } from 'npm:@react-email/components@0.0.22'

interface Props { siteName: string; siteUrl: string; recipient: string; mt5Login: string; mt5Password: string; mt5Server: string; challengeName: string; accountSize: string }

const logoUrl = 'https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const CredentialsEmail = ({ siteName = 'Funding Pulze', siteUrl = 'https://fundingpulze.com', recipient, mt5Login, mt5Password, mt5Server, challengeName, accountSize }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your MT5 trading credentials are ready — start trading!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}><Img src={logoUrl} width="48" height="48" alt="Funding Pulze" style={logoStyle} /></Section>
        <Heading style={h1}>Your Credentials Are Ready 🚀</Heading>
        <Text style={text}>Congratulations! Your <strong>{challengeName}</strong> ({accountSize}) account is now active. Here are your MT5 login details:</Text>
        <Section style={credBox}>
          <Text style={credRow}><strong>Login:</strong> {mt5Login}</Text>
          <Text style={credRow}><strong>Password:</strong> {mt5Password}</Text>
          <Text style={credRow}><strong>Server:</strong> {mt5Server}</Text>
        </Section>
        <Text style={text}>Download MetaTrader 5 and enter these credentials to start trading. Remember to follow the challenge rules — we're rooting for you!</Text>
        <Button style={button} href={`${siteUrl}/dashboard`}>Go to Dashboard</Button>
        <Text style={footer}>Keep these credentials safe. If you need help, reply to this email or contact our 24/7 support.</Text>
      </Container>
    </Body>
  </Html>
)

export default CredentialsEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Space Grotesk', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '24px' }
const logoStyle = { borderRadius: '12px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#0d0d0d', margin: '0 0 16px', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#666666', lineHeight: '1.6', margin: '0 0 20px' }
const credBox = { backgroundColor: '#0d0d0d', borderRadius: '12px', padding: '20px 24px', margin: '0 0 24px' }
const credRow = { fontSize: '14px', color: '#ffffff', lineHeight: '2', margin: '0', fontFamily: "'Courier New', monospace" }
const button = { backgroundColor: '#0d0d0d', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
