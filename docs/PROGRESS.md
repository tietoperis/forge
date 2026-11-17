# Forge: edistyminen

## Tila

- **Versio:** v0.0 (havainnot ja ohut versio, ei Engineä)
- **Valmiit virstanpylväät:** K1, K2
- **Seuraava:** K3 (ohut versio: roolitiedostot Claude Code -agentteina, polkuhookit, porttiskripti ja ajoskripti; DoD: ohut versio vie CLI-speksin alusta loppuun ilman käsin tehtyjä korjauksia). CLAUDE.md:n "Nykyinen virstanpylväs" on päivitettävä K3:ksi ennen aloitusta.

## K2: vertailuspeksit ja piilotetut testisarjat (valmis 2026-11-17)

**DoD:** "Testisarjat ajettu yhtä käsin tarkistettua toteutusta vasten; virheelliset testit korjattu" → **täyttyi.** Käsin tarkistuksen teki Claude, ks. avoimet asiat.

| DoD-kohta | Näyttö |
| --- | --- |
| Testisarjat ajettu referenssiä vastaan | `node evals/hidden/validate.mjs cli-bank` → referenssi 35/35, VALID. `node evals/hidden/validate.mjs library-api` → referenssi 31/31, VALID. API-referenssi ajettiin lisäksi 3 kertaa (31/31 joka kerta), jotta rinnakkaisuustestien epävakaus olisi tullut esiin |
| Referenssi käsin tarkistettu | Koodi luettu vaatimus kerrallaan spec.md:tä vasten. Omat yksikkötestit (CLI 5, API 2) menevät läpi. Tarkistuksessa löytyi ja korjattiin yksi bugi CLI-referenssistä |
| Virheelliset testit korjattu | 4 testiä korjattu cli-bankissa: väärä rivinumero, ja kolme testiä, jotka eivät olisi havainneet vikaa. Ne paljastuivat rikotuilla versioilla. Ks. `evals/hidden/cli-bank/VALIDATION.md`. API-sarjasta ei löytynyt virheitä |
| Testit havaitsevat viat | Rikotut versiot: cli-bank 11/11 ja library-api 12/12 kaatuivat vaatimuksensa testeihin. Mukana K1:ssä nähdyt viat (desimaalipilkku, osasanaosumat, `bookId: true`, ISBN `----------`) ja kilpatilanne |

**Tuotokset**

- `evals/specs/{cli-bank,library-api}/`: `prompt.md` (K1:n P1/P2 sellaisenaan), `interface.md`, `answers.md` ja `spec.md` (numeroidut REQ-vaatimukset), lisäksi `evals/specs/README.md`, joka kertoo, mitä kukin haara saa.
- `evals/hidden/`: testit (`node:test`, ei riippuvuuksia), referenssit, rikotut versiot, `score.sh`, `validate.mjs`, `VALIDATION.md` ja README.
- Eval-kuva on siirretty: `evals/runner/Dockerfile` → `forge-eval-runner` (sama kuva kuin K1:n `forge-k1-runner`).

## K1: virheloki (valmis 2026-11-17)

**DoD:** "`evals/failures.md` kirjattu; jokaisesta ajosta tulos ja puutteet" → **täyttyi.**

| DoD-kohta | Näyttö |
| --- | --- |
| `evals/failures.md` kirjattu | Tiedostossa menetelmä, kuusi ajokohtaista osiota ja yhteenveto toistuvista puutteista |
| Jokaisesta ajosta tulos | Joka osiossa kesto, vuorot, kysymysten määrä, tuotos ja tieto siitä, toimiiko se ilman korjauksia; transkriptit `evals/k1-runs/P1`–`P6/turn-*.jsonl`, käyttö `meta.jsonl` |
| Jokaisesta ajosta puutteet | Puutteet on todennettu ajamalla: omat testit, happy path ja vähintään kaksi virhetilannetta. P3 tarkistettiin selaimessa 390 px leveydellä |

**Keskeiset havainnot** (yksityiskohdat tiedostossa `evals/failures.md`)

- 5/6 ajoa tuotti toimivan happy pathin. Yksikään ei läpäissyt tarkistuslistaa ilman löydöksiä.
- Vain P5 (tahallisen epäselvä prompti) kysyi ennen rakentamista. Muut tekivät oletukset itse ja kertoivat niistä vasta lopussa.
- Testit eivät löytäneet yhtään vakavaa tarkistuksessa löytynyttä puutetta. Esimerkkejä: P1 desimaalipilkku → 100-kertainen summa; P2 rinnakkaiset kirjoitukset → 500; P6 olemassa olevaa salasanaa ei voi tallentaa, vaikka kattavuus on 100 %.
- P6:n toista ristiriitaa (150 riviä vs. tuotantovalmis) ei mainittu.

## Päätökset

**K2**

- **Rajapinta on eri asia kuin vaatimukset.** `interface.md` (käynnistys, komento tai reitit, JSON-muoto, virhestatukset) annetaan kaikille haaroille, myös A:lle promptin perään. Epäselvien kohtien vastaukset ovat vain `answers.md`:ssä ja `spec.md`:ssä. Käyttäjä hyväksyi intake-vastaukset 2026-11-17.
- **Haaran B syöte** on valmis `spec.md` + `interface.md`, jotta toistot ovat vertailukelpoisia. Ohut versio (C) tuottaa oman speksinsä intakessa, ja sen kysymyksiin vastataan `answers.md`:n perusteella.
- **Agenteille annettavat speksitiedostot ovat englanniksi**, kuten K1:n promptit. Dokumentaatio (README, VALIDATION) on suomeksi.
- **Testit on kirjoitettu `node:test`-ajurilla ilman riippuvuuksia**, joten sama ajuri käy Python-CLI:lle ja TypeScript-API:lle. Testin nimi alkaa REQ-tunnisteilla, ja tulos raportoidaan vaatimuksittain.
- **Testien pätevyys todennetaan rikotuilla versioilla** (`mutants.json`): jokaisen pitää kaatua sen vaatimuksen testiin, jonka se rikkoo.
- **Ei pisteytetä:** REQ-19 (cli-bank) ja REQ-18 (library-api) eli projektin omat testit ja README, koska niitä ei voi testata mustana laatikkona. Ne voidaan arvioida K4:ssä sokkoreviewerillä.

**K1**

- **Ajoympäristö K1:ssä:** haara A ajettiin Docker-kontissa (`evals/k1/runner/Dockerfile`, image `forge-k1-runner`). Kontti ajaa ei-root-käyttäjänä `--cap-drop ALL` -asetuksella, ilman Docker-socketia ja privileged-tilaa. Ajokansio on ainoa liitetty projektikansio. Käyttäjä valitsi Dockerin vaihtoehdoista.
- **Headless-ajo:** käyttäjä hyväksyi `claude -p` -ajot. Kysymyksiin vastattiin jatkamalla samaa sessiota (`--resume`). Vinouma on kirjattu failures.md:hen. Käytännössä se ei estänyt kysymistä (P5).
- **Malli:** `claude-sonnet-5-5`, CLI:n oletus tilauksella. Claude Code 2.1.311.
- **Token:** `claude setup-token` → `~/.forge/oauth_token` (chmod 600). Ajoskripti välittää tokenin ympäristömuuttujana, eikä sitä tallenneta repoon. Transkriptit on tarkistettu, eikä niissä ole tokenia.
- **Rinnakkaisuus:** ajoja ajettiin kaksi kerrallaan. Käyttörajaa ei tullut vastaan.

## Työkalut

- `evals/k1/run.sh P<n>` ajaa promptin `evals/k1-prompts.md`:stä muuttamattomana kontissa. `evals/k1/run.sh P<n> --answer "…"` jatkaa samaa sessiota vastauksella. Koodi jää kansioon `~/forge-runs/k1/P<n>/work` (repon ulkopuolelle), transkriptit tallentuvat kansioon `evals/k1-runs/P<n>/`.
- Rakennuskomento: `docker build -t forge-eval-runner evals/runner` (siirretty K2:ssa).
- Ajoskriptiä voi käyttää pohjana K4:n haaroille A ja B. Piilotettua testisarjaa ei saa liittää konttiin.

## Avoimet asiat

- **K3–K4** ovat tekemättä. Käyttäjä on aiemmin pyytänyt koko v0.0:n oikeine ajoineen, mutta CLAUDE.md:n mukaan tehdään yksi virstanpylväs kerrallaan.
- **Piilotettujen sarjojen ihmistarkistus:** referenssit ja testit on kirjoittanut sama tekijä (Claude), joten yhteinen väärintulkinta ei näy. Käyttäjän kannattaa lukea `answers.md` ja testien nimet ennen K4:n ensimmäistä vertailuajoa. Sen jälkeen sarjaa ei saa muuttaa ilman hyväksyntää.
- **Rajapinnan noudattaminen K4:ssä:** K1:n tuotokset saivat 0 pistettä, koska rajapintaa ei ollut annettu. K4:ssä jokainen haara saa `interface.md`:n. Jos haara silti rikkoo rajapinnan, tulos on 0, ja se on kirjattava erikseen, jotta rajapintavirhettä ei tulkita toiminnalliseksi virheeksi.
- **K4:n käyttö:** täysi vertailu on 3 haaraa × 2 speksiä × 3 toistoa = 18 ajoa, ja lisäksi ohuen version ajot ovat monivaiheisia. K1:n ajot olivat lyhyitä (37–187 s), mutta haaran C ajot ovat pidempiä. Ajomäärä on hyväksytettävä etukäteen.
- **SQLite bind-mountilla:** SQLite:n WAL-tila ei toimi macOS:n bind-mount-levyllä (`disk I/O error`). K2:n pisteytysskriptin on ajettava tietokantaa käyttävät toteutukset (esim. CRUD-API) kontin omalla levyllä.
- **Mekanismikandidaatit** (toistuvat puutteet, failures.md:n yhteenveto) tulkitaan vasta K4:ssä `evals/mechanisms.md`:ssä.
