import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  sessionUrl?: string;
  scheduledAt?: string | null;
}

const ClarityBookingConfirmation = ({ name, sessionUrl, scheduledAt }: Props) => {
  const displayName = name?.trim() || "Sveiki";
  const link = sessionUrl || "https://mentor.lauraborusaite.lt";
  const when = scheduledAt
    ? new Date(scheduledAt).toLocaleString("lt-LT", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : null;

  return (
    <Html lang="lt" dir="ltr">
      <Head />
      <Preview>Jūsų aiškumo sesijos nuoroda</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Ačiū, {displayName} 🌿</Heading>
          <Text style={text}>
            Jūsų 15 minučių aiškumo sesija patvirtinta. Bet kada galite pradėti pokalbį
            paspaudę žemiau esančią nuorodą — ji priklauso tik Jums.
          </Text>

          {when && (
            <Section style={infoBox}>
              <Text style={infoLabel}>Pageidaujamas laikas</Text>
              <Text style={infoValue}>{when}</Text>
            </Section>
          )}

          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Link href={link} style={button}>
              Pradėti sesiją
            </Link>
          </Section>

          <Text style={textSmall}>
            Arba nukopijuokite šią nuorodą į naršyklę:
            <br />
            <Link href={link} style={linkStyle}>
              {link}
            </Link>
          </Text>

          <Text style={textSmall}>
            Jei sesijos metu jausite, kad reikia gyvo pokalbio, galėsite pasirinkti
            susitikimą su Laura tiesiog sesijos lange.
          </Text>

          <Text style={signature}>
            Su šiluma,
            <br />
            <strong>Laura Borusaitė</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: ClarityBookingConfirmation,
  subject: "Jūsų aiškumo sesijos nuoroda",
  displayName: "Aiškumo sesijos patvirtinimas",
  previewData: {
    name: "Vardas",
    sessionUrl: "https://mentor.lauraborusaite.lt/sesija/abc123",
    scheduledAt: new Date().toISOString(),
  },
} satisfies TemplateEntry;

export default ClarityBookingConfirmation;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  color: "#1a1a1a",
};

const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 28px",
};

const h1 = {
  fontSize: "26px",
  fontWeight: 500,
  color: "#2b2b2b",
  margin: "0 0 20px",
  letterSpacing: "-0.01em",
};

const text = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#3a3a3a",
  margin: "0 0 16px",
};

const textSmall = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#6a6a6a",
  margin: "24px 0 12px",
};

const infoBox = {
  backgroundColor: "#f7f4ef",
  borderRadius: "12px",
  padding: "16px 20px",
  margin: "20px 0",
};

const infoLabel = {
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#8a7a5c",
  margin: "0 0 4px",
};

const infoValue = {
  fontSize: "16px",
  color: "#2b2b2b",
  margin: 0,
};

const button = {
  backgroundColor: "#2b2b2b",
  color: "#ffffff",
  padding: "14px 32px",
  borderRadius: "999px",
  textDecoration: "none",
  fontSize: "15px",
  fontWeight: 500,
  display: "inline-block",
};

const linkStyle = {
  color: "#6b5d3f",
  wordBreak: "break-all" as const,
};

const signature = {
  fontSize: "15px",
  color: "#3a3a3a",
  marginTop: "32px",
  lineHeight: "24px",
};
