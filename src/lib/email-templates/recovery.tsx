import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface Props { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ siteName, confirmationUrl }: Props) => (
  <Html lang="lt" dir="ltr">
    <Head />
    <Preview>Slaptažodžio atkūrimas — {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Atkurti slaptažodį</Heading>
        <Text style={text}>Gavome prašymą atkurti Jūsų slaptažodį {siteName}. Paspauskite mygtuką, kad nustatytumėte naują slaptažodį.</Text>
        <Button style={button} href={confirmationUrl}>Atkurti slaptažodį</Button>
        <Text style={signature}>Su šiluma,<br /><strong>Laura Borušaitė</strong></Text>
        <Text style={footer}>Jei prašymo nekūrėte, laišką galite ignoruoti — slaptažodis nebus pakeistas.</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', color: '#1a1a1a' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '40px 28px' }
const h1 = { fontSize: '24px', fontWeight: 500, color: '#2b2b2b', margin: '0 0 20px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '24px', margin: '0 0 18px' }
const button = { backgroundColor: '#2b2b2b', color: '#ffffff', fontSize: '15px', fontWeight: 500, borderRadius: '999px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const signature = { fontSize: '15px', color: '#3a3a3a', margin: '32px 0 8px', lineHeight: '24px' }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
