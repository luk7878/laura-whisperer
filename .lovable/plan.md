
# Augimo Kompasas AI — pilnos platformos karkasas

Pastatysime karkasą (kaip nuotraukoje) ir gyvą sesijos ekraną su realiu „Augimo žemėlapiu". Kiti moduliai (Tikslai, Vizija, Prioritetai, Augimo žurnalas, Įžvalgos, Pažanga, Resursai) atsiras kaip pilni puslapiai su pradine funkcija, kurią po to gilinsime po vieną.

## 1. Vizualinė kryptis

- **Paletė:** švari šviesi paletė kaip nuotraukoje — pilkšvai baltas fonas, mėlyna primary (`#3B82F6` tone), švelnūs pilki tokenai, spalvoti akcentai moduliams (mėlyna — tema, oranžinė — emocinis krūvis, violetinė — aktyvus stulpelis, žalia — progresas).
- **Tipografija:** distinktyvi — `Instrument Serif` display akcentams („Gyva augimo sesija") + `Inter` UI/body. Nesinaudosim generic „Sparkles" logotipo — sugeneruosim mažą kompaso ikoną.
- **Layout:** trys kolonos — kairė nav (`w-64`), centras (chat + pulsas + fokusas), dešinė (`w-80` Augimo žemėlapis). Naudosim shadcn `Sidebar` primityvą su `collapsible="icon"`.

## 2. Duomenų bazė (nauji stulpeliai)

```
sessions
  + status          text (active/closed) default 'active'
  + active_topic    text
  + active_column   text        // pvz. "Paslėptos naudos"
  + emotional_start smallint
  + emotional_end   smallint
  + insights        jsonb       // {patterns:[], values:[]}

messages (esama — nekeičiam)

// nauji moduliai
values              (id, user_id, name, rank, created_at)
goals               (id, user_id, title, description, target_date, linked_value_id, status, progress, created_at, updated_at)
vision              (id, user_id, horizon_years, content, created_at, updated_at)  // 5/10/20
priorities          (id, user_id, title, due_date, done, linked_goal_id, created_at)
journal_entries     (id, user_id, session_id, summary, patterns jsonb, created_at)
progress_snapshots  (id, user_id, session_id, emotional_delta int, created_at)
session_grid        (id, session_id, column_key text, content text, updated_at)
                    // 14 Demartini stulpelių būsena vienai sesijai
```

Visos su RLS `auth.uid() = user_id` + GRANT `authenticated`.

## 3. Karkaso struktūra

```
src/routes/_authenticated/
  route.tsx                       (esamas — sidebar layout)
  index.tsx                       (redirect → /session)
  session.tsx                     (Gyva sesija — dabartinis dashboard, perdarytas)
  session.$id.tsx                 (konkreti sesija)
  goals.tsx                       (Tikslai)
  vision.tsx                      (Vizija 5/10/20)
  priorities.tsx                  (Prioritetai)
  journal.tsx                     (Augimo žurnalas)
  insights.tsx                    (Įžvalgos)
  progress.tsx                    (Pažanga — grafikai)
  resources.tsx                   (Resursai — Demartini medžiaga)
```

Sidebar (kairė) — `src/components/app-sidebar.tsx`:
- Logo „Augimo Kompasas AI" + „Nauja sesija" mygtukas
- **MANO AUGIMAS**: Gyva sesija, Tikslai, Vizija, Prioritetai, Augimo žurnalas, Įžvalgos, Pažanga, Resursai
- **NAUJAUSIOS SESIJOS**: paskutinės 3 su spalvotu tašku
- Profilio kortelė apačioje

## 4. Gyvos sesijos ekranas (centras)

Tabai viršuje: **Sesija · Lentelė · Žemėlapis · Integracija**.

- **Sesijos pulsas** — badge'ai: Klausausi, Aktyvi tema, Emocinis krūvis X/10, Aktyvus modulis (real-time iš `sessions` + paskutinės AI žinutės).
- **Gyvas fokusas** — didelė kortelė su išryškintu paskutiniu kliento „giluminiu sakiniu" (AI ekstraktuoja įsitikinimą) + 3 mygtukai: „Gilinam šią vietą", „Paaiškink paprasčiau", „Eikime toliau".
- **Pokalbis** — kompaktiškos kortelės su ikonomis pagal AI rolę: Klausausi / Veidrodis / Pasitikrinkime / Dabartinis klausimas (parsinam iš `**Etapas:**` markdown'o).
- **Kompozeris** — balso indikatorius („Balso režimas aktyvus" + waveform) + textarea + Siųsti.

## 5. Augimo žemėlapis (dešinė kolona)

Realaus laiko kontekstas, atnaujinamas AI atsakymuose per `session_grid` upsert:

1. **Aktyvi tema** (kortelė su ikona)
2. **Pagrindinis įsitikinimas** (AI išgautas iš „Gyvo fokuso")
3. **Emocinis krūvis** — progress bar 0–10 su spalva (žalia/geltona/oranžinė/raudona)
4. **Ką jau matome** — badge'ų grupė (atpažinti šablonai: baimės, palyginimai, projekcijos)
5. **Aktyvus stulpelis** — kuris iš 14 Demartini stulpelių dabar dirbamas
6. **Lentelės būsena** — mini lentelė su užpildytais/tuščiais stulpeliais (Situacija, Emocija, Problemos sakinys, Naudos, Integracija) + linkas į pilną Lentelės tabą
7. **Progreso pokytis** — mini line chart iš `progress_snapshots` (per 7 d.)

## 6. AI prompt'o papildymas (žemėlapio auto-pildymas)

Sistemos prompt'as jau apibrėžia 11 etapų. Papildysim: kiekviename atsakyme AI grąžins struktūrizuotą markdown'ą + paslėptą JSON bloką ```json ... ``` (`{topic, belief, emotion:0-10, column, patterns:[]}`), kurį server parsina ir upsert'ina į `sessions` + `session_grid`. Front-end'ui markdown lieka toks pat — JSON blokas nuvalomas prieš render'inant.

## 7. Kiti moduliai (pradinės versijos)

- **Tikslai:** sąrašas + „Naujas tikslas" dialog (title, vertybė, terminas, progresas). Prie kiekvieno — „Aptarti su AI" (sukuria naują sesiją su tema „Tikslas: …").
- **Vizija:** trys kortelės (5/10/20 m.), rich text edit + „Palydėti su AI".
- **Prioritetai:** paprastas checklist su vertybės tag'u.
- **Augimo žurnalas:** sesijų santraukos (AI generuoja pabaigus sesiją).
- **Įžvalgos:** pasikartojantys šablonai iš `session_grid.patterns` per paskutinę savaitę.
- **Pažanga:** dideli grafikai iš `progress_snapshots` + sesijų skaičius, vid. emocinis pokytis.
- **Resursai:** statinis puslapis su Demartini metodo trumpais paaiškinimais.

## 8. Techninės detalės

- Font'ai per `@fontsource/instrument-serif` + `@fontsource/inter`.
- `src/styles.css` — atnaujinsim tokenus (paletė iš nuotraukos).
- `AppSidebar` naudos `useRouterState` aktyviam route.
- `useSessionMap(sessionId)` hook — TanStack Query, kas 2 s poll'ina `session_grid` + `sessions` (arba Supabase realtime, jei paprasčiau).
- AI JSON parsing — `src/lib/parse-ai-payload.ts`, iškviečiamas `/api/chat` handler'yje po streamo pabaigos, upsert per `supabaseAdmin` (turim `session_id` + verifikuotą user'į).

## 9. Kas šitame etape

Įgyvendinsiu **1–6 dalis pilnai** + **7 dalies skeletonus** (visi routes egzistuoja su tuščia „soon" būsena, kad navigacija veiktų ir vizualiai atrodytų kaip nuotraukoje). Modulius (Tikslai, Vizija, Prioritetai, Žurnalas, Įžvalgos, Pažanga) toliau pildysim po vieną kitose iteracijose — pasakysi, nuo kurio pradėti.
