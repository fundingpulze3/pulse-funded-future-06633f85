/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface PurchaseConfirmationEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  challengeName: string
  accountSize: string
  amountPaid: string
}

const logoUrl = 'https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const PurchaseConfirmationEmail = ({
  siteName = 'Funding Pulze',
  siteUrl = 'https://fundingpulze.com',
  recipient,
  challengeName = '2 Step Challenge',
  accountSize = '$50K',
  amountPaid = '$289',
}: PurchaseConfirmationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Funding Pulze challenge is confirmed — let's trade!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={logoUrl} width="48" height="48" alt="Funding Pulze" style={logoStyle} />
        </Section>
        <Heading style={h1}>You're all set! 🎉</Heading>
        <Text style={text}>
          Your challenge has been purchased successfully. Here's a summary of your order:
        </Text>
        <Section style={orderBox}>
          <Text style={orderRow}>
            <strong>Challenge:</strong> {challengeName}
          </Text>
          <Text style={orderRow}>
            <strong>Account Size:</strong> {accountSize}
          </Text>
          <Text style={orderRow}>
            <strong>Amount Paid:</strong> {amountPaid}
          </Text>
        </Section>
        <Text style={text}>
          Your funded account credentials will be delivered to <strong>{recipient}</strong> within 24 hours. Keep an eye on your inbox.
        </Text>
        <Button style={button} href={siteUrl}>
          Go to Dashboard
        </Button>
        <Text style={footer}>
          Questions? Reply to this email or reach out to our 24/7 support team.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default PurchaseConfirmationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Space Grotesk', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { marginBottom: '24px' }
const logoStyle = { borderRadius: '12px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#0d0d0d',
  margin: '0 0 16px',
  fontFamily: "'Space Grotesk', Arial, sans-serif",
}
const text = {
  fontSize: '15px',
  color: '#666666',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const orderBox = {
  backgroundColor: '#f8f8f8',
  borderRadius: '12px',
  padding: '20px 24px',
  margin: '0 0 24px',
}
const orderRow = {
  fontSize: '14px',
  color: '#333333',
  lineHeight: '1.8',
  margin: '0',
}
const button = {
  backgroundColor: '#0d0d0d',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
