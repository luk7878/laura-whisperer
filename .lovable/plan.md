
# Nemokamos aiškumo sesijos srautas

Sukursim naują viešą sluoksnį virš esamos platformos. Dabartinis app'as (sidebar, tikslai, žurnalas, vizija) lieka nepakitęs – jis tampa „pilna prenumeratos programa". Prieš jį atsiranda viešas kelias be prisijungimo.

## 1. Architektūra

```
/                     → NAUJAS: landing „Nemokama aiškumo sesija"
/rezervacija          → forma (vardas, email, tema, laikas, disclaimer)
/sesija/[token]       → vieša 10–20 min AI sesija (be login, minimalus UI)
/sesija/[token]/pabaiga → santrauka + 2 CTA (prenumerata / gyvas žmogus)
/app  (arba /auth → /session)  → esama pilna platforma (dabartinis /session, /goals, /vision ir t.t.)
```

Dabartinis `/` landing (Demartini Coach) tampa `/app` arba pakeičiamas nauju. Esamą prisijungimą (`/auth`) paliekam prenumeratoriams.

## 2. Landing (`/`) – emocinis „terapinis" stilius

- **Paletė:** šilti smėlio/terrakotos tonai (`#faf8f5`, `#f0ebe3`, terrakota akcentas `#c4654a`, gili žalia `#4a6741` CTA), minkšti šešėliai, daug oro.
- **Tipografika:** `Cormorant Garamond` (display, headline) + `Karla` (body) – jautri, ne-korporatyvi.
- **Struktūra:**
  1. Hero: „Kai galvoje per daug, o aiškumo mažai" + subheadline apie 15 min sesiją + CTA „Rezervuoti nemokamą sesiją".
  2. „Kaip tai veikia" – 3 kortelės (Papasakok kas slegia → AI užduoda tikslius klausimus → Išeini su vienu aiškiu žingsniu).
  3. „Kam tai" – 4 skirtingos gyvenimo situacijos (santykiai, karjeros kryžkelė, per didelis krūvis, savivertė).
  4. Švelnus disclaimer: „Tai nėra terapija ar medicininė pagalba".
  5. FAQ (5 klausimai).
  6. Antras CTA.
- Motion: labai švelnus fade-in scroll'inant, jokių purpurinių gradientų.

## 3. Rezervacija (`/rezervacija`)

Trumpa forma:
- Vardas
- El. paštas
- „Kas šiuo metu labiausiai slegia?" (textarea, 300 char)
- Datos+laiko pasirinkimas (laisvas `datetime` picker, ne slotai)
- Checkbox: „Suprantu, kad tai nėra terapija ar medicininė pagalba"

Po submit'o: sukuriam `clarity_bookings` įrašą su unikaliu `access_token` (UUID). Rodom „Ačiū" ekraną su:
- Nuoroda „Pradėti dabar" → `/sesija/[token]`
- Žinutė: „Nuorodą taip pat išsiuntėme el. paštu" (email siuntimas Lovable Emails per server fn; jei per didelis scope – parodom tik ekrane, DB pažymim `email_sent=false` kaip TODO).

## 4. Vieša sesija (`/sesija/[token]`)

Minimalus UI (be sidebar, be app chrome):
- Header: mažas laikmatis (15 min countdown), progreso bar'as.
- Prieš pradžią – „Prieš pradedant, kaip jautiesi 1–10?" slider (išsaugom `emotional_start`).
- Chat pokalbis su AI mentoriumi (tas pats prompt'as kaip `/api/chat`, bet trumpesnis – „Turi 15 minučių. Padėk žmogui atrasti VIENĄ aiškumą ir VIENĄ veiksmą").
- Mygtukas „Užbaigti sesiją" bet kada.
- Kai laikmatis baigiasi arba vartotojas užbaigia → `/sesija/[token]/pabaiga`.

## 5. „Per sunku" saugiklis (abu kartu)

**Hard triggerai (deterministinės taisyklės, klienta pusėje ir serveryje):**
- Emocinis krūvis pradžioje ≥9.
- Raktažodžiai vartotojo žinutėse: `nebegaliu`, `nebenoriu`, `save žalot`, `nusižud`, `neverta gyvent`, `niekas nepadės`, `viskas beprasmiška`.
- 3+ „nežinau" / „nesuprantu" atsakymai iš eilės.

**Soft trigger (AI):** sistemos prompt'e nurodom, kad AI atsakymo pabaigoje gali grąžinti `---SAFETY---\n{"need_human": true, "reason": "..."}` bloką (kaip dabar map payload). Server parsina.

**Reakcija:** virš chat'o atsiranda švelnus banner'is:
> „Atrodo, kad ši tema tau labai jautri. Jei nori, gali pratęsti su žmogumi, kuris padės pereiti procesą saugiau."
> 
> [Rezervuoti sesiją su žmogumi] [Tęsti su AI]

Jei tai suicidal keyword – papildomai rodom krizių linijos numerį (Lietuva: „Jaunimo linija 8 800 28 888, Vilties linija 116 123").

## 6. Sesijos pabaiga (`/sesija/[token]/pabaiga`)

- „Kaip jautiesi dabar 1–10?" slider (`emotional_end`).
- AI generuoja trumpą santrauką (server fn kviečia AI gateway su visa žinučių istorija → 4 blokai: „Pradinė tema", „Naujas suvokimas", „Vienas veiksmas", „Kitas žingsnis").
- Rodom „Pradėjai nuo X/10, baigei ties Y/10" (jei buvo pokytis).
- Trumpas atsiliepimo laukelis (nebūtinas): „Kas buvo naudingiausia?"
- **Du CTA:**
  - Pagrindinis: „Tęsti savarankiškai su virtualiu mentoriumi – 12,99 €/mėn" (kol kas → email registracijos forma, DB įrašom `subscription_interest`).
  - Antrinis: „Rezervuoti gilesnę sesiją su žmogumi" (jei buvo safety trigger – rodom pirmiau ir stipriau).

## 7. Duomenų bazė

```
clarity_bookings
  id uuid pk
  access_token uuid unique          -- viešoji nuoroda
  name text
  email text
  concern text                       -- "kas slegia"
  scheduled_at timestamptz
  consent_accepted bool
  status text                        -- 'booked' | 'started' | 'completed' | 'abandoned'
  emotional_start smallint
  emotional_end smallint
  safety_triggered bool
  safety_reason text
  summary jsonb                      -- {topic, insight, action, next_step}
  feedback text
  wants_subscription bool
  wants_human_session bool
  created_at, updated_at, started_at, completed_at

clarity_messages
  id uuid pk
  booking_id fk
  role text ('user'|'assistant'|'system')
  content text
  created_at
```

RLS: pilnai uždaros lentelės (`TO anon` = jokių policy). Visa prieiga per server funkcijas su `supabaseAdmin`, kurios validuoja `access_token` iš URL. Tai leidžia neprisijungusiam vartotojui naudotis nesukūrus paskyros.

## 8. Server funkcijos ir API

- `POST /api/public/clarity/book` – sukuria bookingą, grąžina `access_token`.
- `POST /api/public/clarity/message` – (booking_id + token) prideda user žinutę, streamina AI atsakymą, tikrina saugiklio taisykles, upsert'ina `emotional_start` jei dar nėra.
- `POST /api/public/clarity/finish` – užbaigia sesiją, generuoja santrauką (AI gateway), išsaugo.
- `POST /api/public/clarity/interest` – įrašo `wants_subscription` arba `wants_human_session` + email.

Visi po `/api/public/*` prefiksu (bypass'ina auth), bet kiekvienas handleris pirmoj eilėj validuoja `access_token` prieš rašydamas.

## 9. Techninės detalės

- Fontai: `bun add @fontsource/cormorant-garamond @fontsource/karla`, importas `src/main.tsx`, atskiri tokenai `src/styles.css` tik viešam sluoksniui (`--font-serif-clarity`, `--font-sans-clarity`).
- Viešas sluoksnis naudoja atskirą layout'ą (be sidebar) – nauji route'ai `src/routes/rezervacija.tsx`, `src/routes/sesija.$token.tsx`, `src/routes/sesija.$token.pabaiga.tsx`.
- Dabartinį `/` (Demartini landing) perkeliam į `/coach-info` arba tiesiog perrašom – jį naudosim tik kaip nuorodą prisijungusiems.
- Prisijungęs vartotojas atėjęs į `/` gali gauti banner'į „Grįžti į savo programą" → `/session`.
- Krizių numeriai – konstanta `src/lib/crisis-resources.ts`.

## 10. Kas šitoje iteracijoje

Įgyvendinu 1–8 dalis pilnai (landing, rezervacija, sesija, saugiklis, pabaiga + CTA email surinkimas + DB + server fn). Mokėjimai (Stripe checkout) NEĮTRAUKIAMI – CTA tik surenka email. Email siuntimas (Resend/Lovable Emails) – jei tilps, įtrauksiu paprastą confirmation email po rezervacijos; jei ne, pažymėsiu kaip TODO ir rodysim tik ekrane.
