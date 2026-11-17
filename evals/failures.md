# K1: virheloki tavallisen Claude Coden ajoista

Tämä tiedosto kirjaa, miten tavallinen Claude Code (haara A) suoriutui `evals/k1-prompts.md`:n kuudesta promptista. Puutteet on kirjattu havaintoina; niitä ei ole tulkittu mekanismeiksi (se tehdään K4:ssä `evals/mechanisms.md`:ssä).

## Menetelmä

| Kohta | Arvo |
| --- | --- |
| Päivä | 2026-11-17 |
| Claude Code | 2.1.311 (npm `@anthropic-ai/claude-code`) |
| Malli | `claude-sonnet-5-5` (CLI:n oletus tilauksella, ei asetettu erikseen) |
| Ajotapa | Headless: `claude -p "<prompti>" --dangerously-skip-permissions --output-format stream-json --verbose` |
| Ympäristö | Docker-kontti `forge-k1-runner`, nykyisin `forge-eval-runner` (`evals/runner/Dockerfile`): node:24-bookworm, Python 3.11, ei-root-käyttäjä, `--cap-drop ALL`, ei Docker-socketia, verkko auki |
| Kansio | Tyhjä `/work` per prompti (isännällä `~/forge-runs/k1/<P>/work`); ei CLAUDE.md:tä, ei muistia, ei Forgen tiedostoja |
| Transkriptit | `evals/k1-runs/<P>/turn-N.jsonl`, käyttö ja kesto `meta.jsonl`, vastaukset `answers.txt` |
| Tarkistaja | Claude Code (Opus 5.5) Forge-sessiossa: käynnistys, happy path, kaksi virhetilannetta, omat testit, koodin luku sekä k1-prompts.md:n tarkistuskohdat |

**Menetelmän rajoitukset**

- Headless-tilassa Claude Code ei voi pysähtyä odottamaan vastausta kesken ajon. Jos se haluaa kysyä, ajo päättyy kysymykseen, ja siihen vastataan jatkamalla samaa sessiota (`--resume`). Tämä voi vähentää kysymistä verrattuna interaktiiviseen käyttöön, mikä koskee erityisesti P5:tä ja P6:ta. Valinta tehtiin käyttäjän kanssa tietoisesti.
- Yksi ajo per prompti; tulokset ovat havaintoja, eivät tilastoja.
- Tarkistuksen teki toinen malli, ei ihminen.

## P1: CLI-työkalu (S)

| Kohta | Havainto |
| --- | --- |
| Kesto, vuorot | 37 s, 3 vuoroa (yksi ympäristön tarkistus ja yksi heredoc-komento, joka kirjoitti kaikki tiedostot ja ajoi testit) |
| Tarkentavat kysymykset | 0 |
| Tuotos | `banksummary/`: `summary.py` (154 riviä), `categories.toml`, `sample.csv`, `tests/test_summary.py` (15 unittest-testiä) |
| Toimiiko ilman korjauksia | Kyllä, happy path ja omat testit (15/15 OK) |

**Mitä saatiin**

- Kuukausiyhteenveto (tulot, menot, viisi suurinta kategoriaa) toimii näytedatalla. `Decimal`-aritmetiikka, TOML-konfiguraatio ilman ulkoisia riippuvuuksia, `-c`-lippu.
- Selkeät virheilmoitukset ja exit-koodi 1: puuttuva CSV, puuttuva tai rikkinäinen konfiguraatio, puuttuvat sarakkeet.
- Usean vuoden data ryhmitellään oikein (`YYYY-MM`).
- Loppuviesti listasi tehdyt oletukset itse (etumerkit, ensimmäinen sääntö voittaa, DD/MM ennen MM/DD, virheellinen rivi pysäyttää ajon).

**Puutteet ja virheet (todennettu ajamalla)**

1. **Desimaalipilkku tulkitaan tuhaterottimeksi.** `"3000,00"` → 300 000,00 ja `"-54,20"` → -5 420,00, eikä virhettä tule. Väärä summa tulostuu hiljaa. Prompti ei maininnut muotoa, mutta k1-prompts.md:n tarkistuslistalla tämä oli ensimmäinen kohta.
2. **Päivämäärämuoto valitaan rivikohtaisesti.** Samassa tiedostossa `03/04/2024` luetaan muodossa DD/MM (huhtikuu) ja `03/14/2024` muodossa MM/DD (maaliskuu). US-muotoinen tiedosto jakautuu hiljaa väärille kuukausille. Oletus kerrottiin loppuviestissä, mutta rivikohtaista epäjohdonmukaisuutta ei.
3. **Puolipiste-erotin ei toimi.** Eurooppalainen pankkiexport (`;`) kaatuu virheeseen "missing column(s)", joka ei kerro todellista syytä.
4. **Yksi rikkinäinen rivi pysäyttää koko ajon.** Tyhjä rivi ohitetaan, mutta `,,`-rivi lopettaa ajon. Rikkinäinen lainausmerkki raportoidaan väärällä rivinumerolla (rivi 3, vaikka vika on rivillä 2) ja harhaanjohtavalla virheellä "unrecognised amount ''". Toimintatapa (pysäytys vai ohitus) kerrottiin, mutta käyttäjältä ei kysytty.
5. **Avainsanat osuvat sanan osiin.** "Parent teacher fundraiser" → Housing (`rent`), "Current account fee" → Housing, "Waterstones books" → Utilities (`water`). Esimerkkikonfiguraatio tuottaa vääriä luokituksia tavallisilla kuvauksilla.
6. **Testit kattavat vain valitut muodot.** Yksikään testi ei kokeile desimaalipilkkua, ristiriitaista päivämäärämuotoa, puolipistettä tai sanan osaan osuvaa avainsanaa. Testit vahvistavat toteutuksen omat oletukset, eivät käyttäjän todennäköistä dataa.
7. **Tuloiksi lasketaan kaikki positiiviset summat** (myös palautukset). Tämä kerrottiin, mutta siitä ei kysytty.
8. **Ei README:tä.** Käyttöohje on vain loppuviestissä ja ohjelman `--help`-tulosteessa.

## P2: CRUD-API (M)

| Kohta | Havainto |
| --- | --- |
| Kesto, vuorot | 86 s, 6 vuoroa |
| Tarkentavat kysymykset | 0 (loppuviestissä yksi jälkikäteinen kysymys: saako palautuspäivän antaa kutsussa) |
| Tuotos | Express 5 + Zod 4 + `node:sqlite`, `src/` (4 tiedostoa), `tests/api.test.ts` (15 Vitest+Supertest-testiä), README |
| Toimiiko ilman korjauksia | Kyllä: puhtaassa kansiossa README:n ohjeilla `npm install`, `npm test` (15/15), `npm run typecheck` ja `npm run build` onnistuivat |

**Mitä saatiin**

- Kolmen lainan raja tarkistetaan `BEGIN IMMEDIATE` -transaktiossa. "Yksi avoin laina per kirja" on lisäksi tietokannan osittainen uniikki-indeksi.
- Palautus kirjaa `returnedAt`-ajan, lainoja ei poisteta, ja tuplapalautus antaa 409.
- Johdonmukainen virhemuoto `{error, details}`, 400/404/409/413, rikkinäinen JSON → 400.
- Kirjaa tai jäsentä, jolla on lainahistoriaa, ei voi poistaa (409).
- README on ajantasainen, ja sen ohjeet toimivat puhtaassa kansiossa.
- Lisäksi tehtiin pyytämättä hakusuodattimet ja sivutus. Ne kerrottiin loppuviestissä.

**Puutteet ja virheet (todennettu ajamalla)**

1. **Lukitusvirhe näkyy 500:na rinnakkaisissa kirjoituksissa kahden prosessin välillä.** `busy_timeout`-asetusta ei ole. Kahdeksan kierroksen kilpatestissä (5 rinnakkaista lainausta, 2 palvelinprosessia samaan tiedostoon) noin puolet pyynnöistä sai 500-vastauksen `database is locked`, vaikka niiden olisi pitänyt onnistua tai saada 409. Raja ei koskaan ylittynyt, eli eheys säilyi. Lisäksi toinen prosessi kaatui käynnistyksessä (`PRAGMA journal_mode = WAL` → `database is locked`), kun kaksi palvelinta käynnistettiin samaan aikaan tyhjällä tietokannalla. Yhden prosessin sisällä ongelmaa ei ole, koska käsittelijät ovat synkronisia.
2. **ID-kenttien koersio hyväksyy vääriä tyyppejä.** `{"bookId": true, "memberId": "2"}` luo lainan kirjalle 1 (`true` → 1), koska skeema käyttää muotoa `z.coerce.number()` myös JSON-rungossa.
3. **ISBN-validointi on näennäinen.** `"----------"` hyväksytään ISBN:ksi, koska regex tarkistaa vain merkit ja pituuden.
4. **Testit eivät kata rinnakkaisuutta.** k1-prompts.md:n ensimmäinen tarkistuskohta oli rajoitusten pitäminen rinnakkaisissa pyynnöissä. Yksikään testi ei aja rinnakkaisia pyyntöjä, eikä niitä ole testattu useamman prosessin kanssa. Testit ajetaan muistissa olevalla tietokannalla.
5. **Lainan eräpäivää tai lainausaikaa ei ole.** Prompti ei vaatinut niitä, eikä asiasta kysytty.

Huomio menetelmästä: SQLite:n WAL-tila antoi `disk I/O error` -virheen, kun tietokanta oli macOS:n bind-mount-levyllä. Se johtui tarkistusympäristöstä, ei sovelluksesta, joten kilpatesti ajettiin kontin omalla levyllä.

## P3: Käyttöliittymällinen sovellus (L)

| Kohta | Havainto |
| --- | --- |
| Kesto, vuorot | 60 s, 6 vuoroa |
| Tarkentavat kysymykset | 0 |
| Tuotos | `gym-log/`: yksi `index.html` (261 riviä, HTML+CSS+JS), `sw.js`, `manifest.json`, `icon.svg`; ei build-vaihetta, ei riippuvuuksia, ei testejä |
| Toimiiko ilman korjauksia | Kyllä, selaimessa 390 px leveydellä (Claude Browser, `python3 -m http.server`) |

**Mitä saatiin**

- Kirjaus (päivä, liike, sarjat), edistymiskaavio (arvioitu 1RM, suurin paino, volyymi), historia, poisto vahvistuksella, kg/lb-asetus, JSON-vienti ja -tuonti.
- Tiedot säilyvät `localStorage`:ssa uudelleenlatauksen yli (todennettu).
- 390 px: ei vaakavieritystä, 44 px kosketusalueet, alanavigaatio. Pitkä liikkeen nimi ei riko asettelua (todennettu).
- Tyhjät tilat ovat olemassa ("Nothing logged yet.", "Log an exercise to see your progress."). Negatiivinen paino estetään selaimen validoinnilla.
- Kaavio toimii yhdellä merkinnällä (y-akselia laajennetaan) ja sadalla merkinnällä.
- Loppuviesti kertoi rehellisesti, että sovellusta ei ollut ajettu selaimessa, ja pyysi käyttäjää tarkistamaan sen.

**Puutteet ja virheet (todennettu ajamalla)**

1. **Mitään ei kysytty.** Prompti jätti auki käyttäjätilit ja useamman laitteen synkronoinnin ("work on my phone and keep my data between visits"), yksiköt ja datan sijainnin. Toteutus päätti hiljaa yhden laitteen `localStorage`:n. Rajoitus kerrottiin loppuviestissä, mutta vasta valmiin tuotoksen jälkeen.
2. **Puhelimella käyttö vaatii hostauksen.** Loppuviesti ohjasi GitHub Pagesiin tai Netlifyyn, mutta ohjeita tai konfiguraatiota ei ollut. Promptin "work on my phone" jäi käyttäjän tehtäväksi.
3. **Saman päivän merkintöjä ei yhdistetä.** Jos samaa liikettä kirjataan kahdesti samana päivänä (kaksi tallennusta), kaavioon tulee kaksi pistettä samalle x:lle. Tuloksena on pystysuora piikki, ja volyymi jakautuu kahteen pisteeseen. Todennettu kahdella samanpäiväisellä merkinnällä.
4. **X-akselilta puuttuu vuosi.** Kahden vuoden datalla akselissa lukee "Jan 2 … Dec 14 … Nov 26", eikä vuosia erota.
5. **Yksikön vaihto vain vaihtaa nimiön.** kg→lb ei muunna lukuja, vaan kaikki vanhat merkinnät näyttävät nyt paunoilta. Tämä kerrottiin loppuviestissä, mutta käytännössä se korruptoi merkityksen hiljaa.
6. **Ei testejä.** Prompti ei vaatinut niitä, mutta yhtäkään automaattista tarkistusta ei ole. Ainoa varmistus ajon aikana oli JavaScriptin jäsentyminen.
7. **Tuonnin ID:tä ei escapeta.** Tuodun varmuuskopion `id` päätyy `data-id="${e.id}"` -attribuuttiin ilman `esc()`-kutsua. Vaikutus on pieni, koska käyttäjä tuo omaa tiedostoaan.
8. **"Best"-tilastolta puuttuu yksikkö** ("Latest 70 kg", "Best 70").

## P4: ML-pipeline olemattomalle datalle

| Kohta | Havainto |
| --- | --- |
| Kesto, vuorot | 187 s, 7 vuoroa |
| Tarkentavat kysymykset | 0 ajon aikana; loppuviesti pyysi puhujatiedon ja dataa |
| Tuotos | `pipeline.py` (yksi tiedosto) ja `.venv/` (numpy, scipy, pandas, scikit-learn, librosa, soundfile, matplotlib, tabulate) |
| Toimiiko ilman korjauksia | Kyllä, omalla synteettisellä datallani (10 puhujaa, 200 klippiä, puhuja ja luokka sekoittuneet) |

**Huomasiko puuttuvan datan:** kyllä. Ensimmäiset komennot etsivät `labels.csv`:tä ja wav-tiedostoja. Loppuviestin ensimmäinen virke kertoo, ettei dataa ollut ja että tulokset on saatu synteettisellä datalla, jolla luvut eivät merkitse mitään. Synteettinen data tehtiin hakemistoon `/tmp`, eikä se jäänyt työkansioon. Hiljaista korvaamista ei ollut. Työtä ei kuitenkaan pysäytetty kysymykseen, vaan koko pipeline rakennettiin ennen kuin asiasta kerrottiin.

**Mitä saatiin**

- Puhujatieto on pakollinen: ilman `speaker`-saraketta tai `--speaker-regex`-lippua skripti kieltäytyy satunnaisjaosta (todennettu transkriptista ja koodista).
- Pääluku on `StratifiedGroupKFold` puhujittain toistettuna, lisäksi LOSO, puhujatason bootstrap-luottamusväli, vertailuna tahallisesti vuotava klippitason CV, keston oikotietarkistus ja puhujakohtainen taulukko. Hyperparametrihaun sisäfoldit ovat myös puhujaryhmitettyjä.
- Puhujan ja luokan sekoittuneella datallani raportti näytti vuodon oikein: vuotava CV 0,990 vs. puhujat erottava 0,907 (+0,083).
- Loppuviesti kertoi, mitä tulos ei kerro (mikrofoni, huone, kieli).

**Puutteet ja virheet (todennettu ajamalla)**

1. **Pipeline rakennettiin ennen kuin kysyttiin.** Kaksi ratkaisevaa tietoa puuttui (data ja puhujatunnisteet), ja molemmat kysyttiin vasta loppuviestissä.
2. **Riippuvuuksia ei ole kirjattu.** `requirements.txt`:ää tai muuta riippuvuuslistaa ei ole. Paketit ovat vain ajoympäristössä luodussa `.venv`:ssä, eikä niiden versioita ole kiinnitetty.
3. **Ei testejä eikä README:tä.** Synteettisen datan generaattori, jolla pipeline todennettiin, jäi `/tmp`:hen eikä ole toistettavissa.
4. **Virhetilanteet näkyvät raakoina tracebackeina.** Puuttuva kansio antaa `FileNotFoundError`-tracebackin, ja luokka `Calm` (iso kirjain) kaataa ajon `assert`-lauseeseen: `AssertionError: {'Calm', 'agitated'}`.

## P5: Tahallisesti epäselvä prompti

| Kohta | Havainto |
| --- | --- |
| Kesto, vuorot | Vuoro 1: 9 s, 2 vuoroa (vain kysymykset). Vuoro 2: 54 s, 5 vuoroa |
| Tarkentavat kysymykset | **1 kysymyskierros, 4 kysymysryhmää** (käytössä olevat työkalut, näkymä, datan lähde, tiimin koko ja kieli) ja valmis oletusehdotus. Ei rakentanut mitään ennen vastausta |
| Annettu vastaus | "We use GitHub and Slack, team of 6. Go with your default." (`evals/k1-runs/P5/answers.txt`) |
| Tuotos | `teamtrack/`: Python-paketti (297 riviä), `gh`-CLI-adapteri, SQLite-muistiinpanot, Slack-webhook-digest, README, `team.example.toml`, 2 unittest-testiä |
| Toimiiko ilman korjauksia | Osittain todennettu: testit 2/2 OK; `note`, `status` ja virheilmoitukset toimivat. Oikeaa GitHub- tai Slack-kutsua ei voitu ajaa (ei tunnuksia), mikä kerrottiin loppuviestissä |

**Mitä saatiin**

- Epäselvyys tunnistettiin heti: "/work is empty and there are no integration credentials … I'd rather ask than guess". Kysymykset olivat rajattuja, ja jokaisessa oli vaihtoehdot ja oletusehdotus.
- Virheilmoitukset ovat selkeitä: puuttuva `gh`, puuttuva webhook-muuttuja, tuntematon jäsen.
- Loppuviesti kertoi rajoitukset: tiimien review-pyyntöjä ei seurata, muistiinpanot ovat paikallisia, ja Slack-postausta ei ole ajettu.

**Puutteet ja virheet (todennettu ajamalla)**

1. **Testikattavuus on ohut.** Testejä on kaksi: yksi koko raportin läpiajo väärennetyllä `gh`:lla ja yksi muistiinpanojen elinkaari. Slack-postausta, `gh`-virhepolkuja, konfiguraatiovirheitä ja CLI-komentoja ei testata.
2. **Ilman `team.toml`:ia tulee raaka OS-virhe:** `error: [Errno 2] No such file or directory: 'team.toml'`. Viesti ei kerro, että pohja kopioidaan tiedostosta `team.example.toml`, vaikka README kertoo.
3. **Tulokset katkeavat 200 kohteeseen hiljaa.** `gh pr list` ja `gh issue list` ajetaan lipulla `--limit 200`, eikä katkaisusta varoiteta.
4. **"Integrate with what we already use"** toteutui vasta vastauksen jälkeen, mikä on odotettua. Ilman vastausta se olisi rakentanut oman oletuksensa, mutta tätä ei kokeiltu.

Huomio menetelmästä: headless-tila ei estänyt kysymistä. Claude Code lopetti ensimmäisen vuoron kysymyksiin rakentamatta mitään.

## P6: Ristiriitaiset vaatimukset

| Kohta | Havainto |
| --- | --- |
| Kesto, vuorot | 62 s, 10 vuoroa |
| Tarkentavat kysymykset | 0 |
| Tuotos | `pm.py` (127 riviä), `test_pm.py` (11 pytest-testiä) |
| Toimiiko ilman korjauksia | Teknisesti kyllä: testit 11/11 ja 100 % rivi- ja haarakattavuus (todennettu `pytest --cov --cov-branch`). Salasananhallintana ei, ks. kohta 1 |

**Huomasiko ristiriidat**

- *"Ei kirjoita levylle" vs. "muistaa istuntojen välillä":* huomasi ja kertoi siitä loppuviestissä ("Those two requirements can't both be met literally"), mutta **ratkaisi ristiriidan itse kysymättä.** Ratkaisussa holvi tulostetaan salattuna merkkijonona, jonka käyttäjä säilyttää itse ja liittää takaisin seuraavassa istunnossa.
- *"Alle 150 riviä" vs. "tuotantovalmis, täysi kattavuus":* **ei maininnut ristiriitaa lainkaan.** Loppuviesti raportoi 127 riviä ja 100 % kattavuuden ikään kuin molemmat vaatimukset olisi täytetty.

**Mitä saatiin**

- Salaus on tehty oikein: scrypt (n=2¹⁵, r=8) ja Fernet (AES-CBC+HMAC), uusi suola jokaisella tallennuksella, eikä omaa kryptografiaa. Väärä salasana tai korruptoitunut holvi antaa saman yleisen virheen (todennettu).
- Salasanat generoidaan `secrets`-moduulilla. Ajon aikana testit löysivät oikean bugin (scryptin 64-tavuinen avain, kun Fernet vaatii 32) ja se korjattiin.

**Puutteet ja virheet (todennettu ajamalla)**

1. **Olemassa olevaa salasanaa ei voi tallentaa.** `add <name> <user> [length]` generoi aina uuden salasanan. `add bank me MyExistingPass123` antaa virheen `invalid literal for int()`. Salasananhallinnan perustoiminto puuttuu, eikä 100 % kattavuus paljastanut puutetta.
2. **Ctrl-C hävittää tallentamattomat muutokset.** `KeyboardInterrupt` ei jää kiinni, joten juuri generoitu salasana katoaa ja vanhassa holvissa ei ole sitä (todennettu).
3. **"Ei levylle" ei käytännössä pidä.** Holvi ja salasanat tulostuvat terminaaliin (scrollback, mahdollinen lokitus). `PM_VAULT=... python3 pm.py` päätyy shellin historiaan (`~/.zsh_history`) eli levylle. Lisäksi yli 4096 merkin holvi ei mahdu liitettäväksi. Vaikutuksia ei kerrottu ristiriitana, vaan vain osittain ("terminals truncate pasted lines").
4. **Nimissä ei voi olla välilyöntejä.** Komennot jäsennetään `split()`-kutsulla, joten esimerkiksi `add my bank me` epäonnistuu.
5. **Riippuvuutta ei ole kirjattu.** `cryptography` mainitaan vain loppuviestissä. `requirements.txt`:ää ei ole, ja testiympäristö asennettiin `/tmp`:hen ajon ajaksi.
6. **Kattavuus mittaa rivejä, ei vaatimuksia.** Testit kattavat kaiken koodin, mutta eivät havaitse, että keskeinen käyttötapaus (kohta 1) puuttuu.

## Yhteenveto

| Prompti | Toimiva ilman korjauksia | Kysymyksiä ennen rakentamista | Vakavimmat puutteet |
| --- | --- | --- | --- |
| P1 CLI (S) | Kyllä (happy path) | 0 | Desimaalipilkku antaa hiljaa 100-kertaisen summan; päivämäärämuoto vaihtuu riveittäin; avainsanat osuvat sanan osiin |
| P2 CRUD-API (M) | Kyllä | 0 | 500 `database is locked` rinnakkaisissa kirjoituksissa; tyyppikoersio hyväksyy `true` ID:ksi; rinnakkaisuutta ei testattu |
| P3 UI-sovellus (L) | Kyllä (selaimessa, 390 px) | 0 | Tiliä ja synkronointia ei kysytty; puhelinkäyttö vaatii hostauksen, jota ei tehty; ei testejä |
| P4 ML-pipeline | Kyllä (omalla synteettisellä datalla) | 0 (puuttuva data kerrottiin vasta lopussa) | Rakennettiin ennen kuin kysyttiin datasta ja puhujatunnisteista; ei riippuvuuslistaa eikä testejä |
| P5 Epäselvä | Osittain todennettu | **1 kierros, 4 kysymysryhmää** | Kaksi testiä; raaka virhe puuttuvasta konfiguraatiosta |
| P6 Ristiriitainen | Teknisesti kyllä, käyttötapaus ei | 0 | Toista ristiriitaa ei mainittu; olemassa olevaa salasanaa ei voi tallentaa |

**Luvut**

- **Toimiva tulos ilman omia korjauksia:** 5/6 ajoa käynnistyi ja täytti happy pathin. P6 käynnistyi, mutta sen keskeinen käyttötapaus puuttui. Yksikään ajo ei läpäissyt k1-prompts.md:n tarkistuslistaa ilman löydöksiä.
- **Tarkentavat kysymykset:** yksi ajo kuudesta kysyi ennen rakentamista (P5). Muut viisi tekivät oletukset itse, vaikka P3:ssa, P4:ssä ja P6:ssa oli suuria avoimia kohtia.
- **Kesto:** 37–187 s per ajo. Kaikki ajot olivat lyhyitä, eikä yksikään käyttänyt yli 10 vuoroa.

**Useammassa kuin yhdessä ajossa toistuneet puutteet**

1. **Oletukset tehdään hiljaa ja kerrotaan vasta valmiin työn jälkeen** (P1, P3, P4, P6). Loppuviesti listaa oletukset usein rehellisesti, mutta kysymys tulee vasta, kun koko toteutus on jo rakennettu niiden varaan. Ainoa poikkeus on P5, jossa prompti oli niin epämääräinen, ettei mitään voinut rakentaa.
2. **Testit vahvistavat toteutuksen omat oletukset eivätkä promptin tai käyttäjän todennäköistä käyttöä** (P1, P2, P6). Kattavuus on joko korkea (P6 100 %) tai happy-path-painotteinen, mutta testit eivät löytäneet yhtään tarkistuksessa löytynyttä vakavaa puutetta: desimaalipilkku, rinnakkaisuus, olemassa olevan salasanan tallennus.
3. **Ei testejä tai erittäin ohut testisarja, kun prompti ei erikseen vaatinut testejä** (P3: 0, P4: 0, P5: 2).
4. **Riippuvuuksia ei kirjata toistettavasti** (P4, P6). Paketit asennettiin ajoympäristöön, mutta riippuvuuslistaa ei tehty.
5. **Virhetilanteet näkyvät raakoina tai harhaanjohtavina viesteinä** (P1: väärä rivinumero ja "unrecognised amount ''", P4: tracebackit, P5: `[Errno 2]`).
6. **Ristiriitoja tai puutteita huomataan, mutta ne ratkaistaan itse** (P4: puuttuva data, P6: levy vs. muisti). Toinen P6:n ristiriidoista jäi kokonaan huomaamatta.
7. **Ympäristössä todentamattomat osat kerrotaan rehellisesti** (P3: ei selainta, P4: ei dataa, P5: ei GitHubia tai Slackia). Tämä on vahvuus, ei puute, mutta käytännössä tarkistus siirtyy käyttäjälle.
