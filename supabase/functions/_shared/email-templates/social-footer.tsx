/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Section, Text, Link } from 'npm:@react-email/components@0.0.22'

export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/funding_pulze?igsh=MXZnd2J3dGp6ZGxkbw==',
  twitter: 'https://x.com/fundingpulze?s=21&t=HnmtAeK4eOjcPiFqGHz5lw',
  discord: 'https://discord.gg/YgWhnxNewG',
}

export const SocialFooter = () => (
  <Section style={socialSection}>
    <Text style={socialText}>Follow us</Text>
    <Text style={socialLinks}>
      <Link href={SOCIAL_LINKS.instagram} style={socialLink}>Instagram</Link>
      {' · '}
      <Link href={SOCIAL_LINKS.twitter} style={socialLink}>Twitter</Link>
      {' · '}
      <Link href={SOCIAL_LINKS.discord} style={socialLink}>Discord</Link>
    </Text>
    <Text style={copyright}>© {new Date().getFullYear()} Funding Pulze. All rights reserved.</Text>
  </Section>
)

const socialSection = { borderTop: '1px solid #e5e5e5', marginTop: '32px', paddingTop: '20px', textAlign: 'center' as const }
const socialText = { fontSize: '12px', color: '#999999', margin: '0 0 8px', fontWeight: '600' as const }
const socialLinks = { fontSize: '13px', margin: '0 0 12px', lineHeight: '1.5' }
const socialLink = { color: '#0d0d0d', textDecoration: 'none', fontWeight: '500' as const }
const copyright = { fontSize: '11px', color: '#bbbbbb', margin: '0' }
