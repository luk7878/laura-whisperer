import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface Props { token: string }

export const ReauthenticationEmail = ({ token }: Props) => (
  <Html lang="lt" dir="ltr">
    <Head />
    <Preview>Patvirtinimo kodas</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Patvirtinimo kodas</Heading>
        <Text style={text}>Naudokite šį kodą tapatybei patvirtinti:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={signature}>Su šiluma,<br /><strong>Laura Borusaitė</strong></Text>
        <Text style={footer}>Kodas greitai nustos galioti. Jei kodo neprašėte, laišką galite ignoruoti.</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif', color: '#1a1a1a' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '40px 28px' }
const h1 = { fontSize: '24px', fontWeight: 500, color: '#2b2b2b', margin: '0 0 20px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#3a3a3a', lineHeight: '24px', margin: '0 0 18px' }
const codeStyle = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '28px', fontWeight: 600, color: '#2b2b2b', letterSpacing: '0.2em', margin: '0 0 24px' }
const signature = { fontSize: '15px', color: '#3a3a3a', margin: '32px 0 8px', lineHeight: '24px' }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
