import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'

interface Props {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: Props) => (
  <Html lang="lt" dir="ltr">
    <Head />
    <Preview>Patvirtinkite savo el. paštą {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Patvirtinkite el. paštą</Heading>
        <Text style={text}>
          Ačiū, kad prisiregistravote{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
        </Text>
        <Text style={text}>
          Patvirtinkite savo adresą (<Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>)
          paspausdami mygtuką:
        </Text>
        <Button style={button} href={confirmationUrl}>Patvirtinti el. paštą</Button>
        <Text style={signature}>Su šiluma,<br /><strong>Laura Borusaitė</strong></Text>
        <Text style={footer}>Jei paskyros nekūrėte, šį laišką galite ignoruoti.</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', color: '#1a1a1a' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '40px 28px' }
const h1 = { fontSize: '24px', fontWeight: 500, color: '#2b2b2b', margin: '0 0 20px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '24px', margin: '0 0 18px' }
const link = { color: '#6b5d3f', textDecoration: 'underline' }
const button = { backgroundColor: '#2b2b2b', color: '#ffffff', fontSize: '15px', fontWeight: 500, borderRadius: '999px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const signature = { fontSize: '15px', color: '#3a3a3a', margin: '32px 0 8px', lineHeight: '24px' }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
