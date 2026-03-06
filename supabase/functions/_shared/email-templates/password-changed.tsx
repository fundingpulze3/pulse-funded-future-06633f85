/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface PasswordChangedEmailProps {
  siteName: string
  recipient: string
}

const logoUrl = 'https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const PasswordChangedEmail = ({
  siteName = 'Funding Pulze',
  recipient,
}: PasswordChangedEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Funding Pulze password was changed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Img src={logoUrl} width="48" height="48" alt="Funding Pulze" style={logoStyle} />
        </Section>
        <Heading style={h1}>Password changed</Heading>
        <Text style={text}>
          The password for your Funding Pulze account ({recipient}) was recently changed.
        </Text>
        <Section style={alertBox}>
          <Text style={alertText}>
            ⚠️ If you didn't make this change, your account may be compromised. Please reset your password immediately and contact our support team.
          </Text>
        </Section>
        <Text style={text}>
          If you made this change, no further action is needed. You can safely ignore this email.
        </Text>
        <Text style={footer}>
          This is an automated security notification from Funding Pulze.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default PasswordChangedEmail

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
const alertBox = {
  backgroundColor: '#FFF3CD',
  border: '1px solid #FFECB5',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '0 0 24px',
}
const alertText = {
  fontSize: '14px',
  color: '#664D03',
  lineHeight: '1.6',
  margin: '0',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
