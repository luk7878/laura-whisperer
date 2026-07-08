// „Per sunku" saugiklis — hard triggerai (deterministinės taisyklės).
// Naudojama tiek serveryje (prieš AI kvietimą), tiek kliente rodyti banner'į iškart.

const CRISIS_KEYWORDS = [
  "nusižud",
  "save žalot",
  "susižalo",
  "nebenoriu gyvent",
  "neverta gyvent",
  "noriu numirt",
  "noriu mirt",
  "pabaigti visk",
];

const OVERLOAD_KEYWORDS = [
  "nebegaliu",
  "nebeturiu jėg",
  "niekas nepadės",
  "viskas beprasmiška",
  "beviltiška",
];

const DONT_KNOW = ["nežinau", "nesuprantu", "nesuvokiu"];

export type SafetyCheck = {
  level: "none" | "soft" | "crisis";
  reason: string | null;
};

export function checkSafetyRules(params: {
  latestUserContent: string;
  recentUserMessages: string[]; // last 3 user messages (oldest → newest), including latest
  emotionalStart: number | null;
}): SafetyCheck {
  const text = params.latestUserContent.toLowerCase();

  if (CRISIS_KEYWORDS.some((k) => text.includes(k))) {
    return { level: "crisis", reason: "Užuominos apie savižudybę ar savęs žalojimą." };
  }

  if (OVERLOAD_KEYWORDS.some((k) => text.includes(k))) {
    return { level: "soft", reason: "Stipraus bejėgiškumo signalai." };
  }

  if ((params.emotionalStart ?? 0) >= 9) {
    return { level: "soft", reason: "Labai aukštas emocinis krūvis (≥9/10)." };
  }

  const recent = params.recentUserMessages.slice(-3).map((m) => m.toLowerCase());
  if (recent.length >= 3 && recent.every((m) => DONT_KNOW.some((k) => m.includes(k)))) {
    return { level: "soft", reason: "Kartojasi nezinau/nesuprantu — sunku prisiliesti prie temos." };
  }

  return { level: "none", reason: null };
}
