# Forge

Forge on henkilökohtainen, autonominen ohjelmistokehityksen harness, joka rakennetaan Claude Agent SDK:n päälle. Tämä repositorio on Forge itse, ei Forgella rakennettu projekti.

## Määrittely

- `docs/SPEC.md` (v1.1) on auktoritatiivinen tekninen määrittely. Lue siitä vain nykyisen virstanpylvään kannalta olennaiset luvut. Luku 20 listaa muutokset v1:stä.
- Älä poikkea määrittelystä hiljaa. Jos toteutus paljastaa määrittelyssä virheen, ristiriidan tai puutteen: pysähdy, kuvaa ongelma ja ehdota muutosta `docs/SPEC.md`:hen. Jatka vasta, kun muutos on hyväksytty.
- `docs/PROGRESS.md` kertoo valmiit virstanpylväät, tehdyt päätökset ja avoimet asiat. Päivitä se jokaisen session lopussa.

## Nykyinen virstanpylväs

Versio: v0.0 (havainnot ja ohut versio, ei Engineä)
Virstanpylväs: K2 (ks. SPEC luku 18, taulukko "v0.0:n virstanpylväät")

Toteuta vain nykyinen virstanpylväs. Älä rakenna myöhempien virstanpylväiden ominaisuuksia "valmiiksi". Rajapinnat saavat kuitenkin varautua niihin siten kuin määrittely kuvaa.

Versiosta toiseen siirrytään vasta, kun edellisen Definition of Done täyttyy ja eval-ajo on tehty. v0.0:n lopussa (K4) käyttäjä päättää eval-tulosten perusteella, rakennetaanko Engine. Älä aloita v0.1:tä ennen tätä päätöstä.

## Työtapa jokaisessa sessiossa

1. Lue virstanpylvään sisältö ja Definition of Done määrittelystä.
2. Esitä lyhyt toteutussuunnitelma: tiedostot, rajapinnat, testit. Odota hyväksyntä.
3. Toteuta pienissä, testattavissa osissa.
4. Aja testit, typecheck ja lint, kun virstanpylväässä on koodia. Kaikkien pitää mennä läpi.
5. Raportoi DoD kohta kohdalta: täyttyikö, ja millä näytöllä (testin nimi, komennon tulos, tiedosto).
6. Päivitä `docs/PROGRESS.md`.

## v0.0: havainnot ja ohut versio

v0.0 ei sisällä TypeScript-monorepoa eikä Engineä. Sen tuotokset ovat:

- `evals/failures.md`: virheloki tavallisen Claude Coden ajoista (K1). Promptit ovat valmiina tiedostossa `evals/k1-prompts.md` (kuusi promptia ja ajosäännöt); älä muuta niitä ajon aikana. Kirjaa jokaisesta ajosta, mitä pyydettiin, mitä saatiin ja mikä puuttui tai oli väärin. Älä kaunistele äläkä tulkitse puutteita mekanismeiksi vielä tässä vaiheessa.
- `evals/specs/<speksi>/`: vertailuspeksi, kiinnitetty ulkoinen rajapinta ja intake-vastaukset (`answers.md`) (K2).
- `evals/hidden/<speksi>/`: piilotettu mustan laatikon hyväksymistestisarja ja pisteytysskripti (K2).
- `thin/`: ohut versio eli roolitiedostot Claude Code -agentteina, polkuhookit, porttiskripti ja ajoskripti (K3). Roolitiedostot kirjoitetaan SPEC luvun 16 muodossa, koska v0.1 käyttää niitä sellaisinaan.
- `evals/results/` ja `evals/mechanisms.md`: kolmen haaran vertailu ja mekanismirekisteri (K4).

## Eval-säännöt (kaikki versiot)

- Piilotettu testisarja on ensisijainen mittari. Vertailtava haara (tavallinen Claude Code, ohut versio tai Forge) ei saa koskaan nähdä `evals/hidden/`-hakemistoa: sitä ei anneta syötteeksi, ei liitetä konttiin eikä kopioida ajohakemistoon. Pisteytys ajetaan erikseen ajon jälkeen.
- Kolme haaraa: (A) tavallinen Claude Code alkuperäisellä promptilla, (B) tavallinen Claude Code hyväksytyllä `spec.md`:llä, (C) ohut versio tai Forge.
- Vähintään 3 toistoa haaraa ja speksiä kohti. Raportoi mediaani ja vaihteluväli. Ero, joka on pienempi kuin haaran oma vaihteluväli, ei ole tulos, äläkä raportoi sitä voittona.
- Älä muuta piilotettua testisarjaa sen jälkeen, kun ensimmäinen vertailuajo on tehty, ilman käyttäjän hyväksyntää. Muutos mitätöi aiemmat tulokset.
- Tallenna jokaiseen tulokseen Forgen versio, promptien versiot, mallit ja mekanismiliput.
- Eval-ajot kuluttavat tilauksen käyttörajoja. Kerro etukäteen ajojen määrä ja odota hyväksyntä.

## Tekniset linjaukset (v0.1:stä alkaen)

- TypeScript (strict), Node.js LTS, pnpm-monorepo. Rakenne: SPEC luku 17.
- Kaikki tietorakenteet määritellään Zod-skeemoina `packages/shared/schemas`-paketissa. Tyypit johdetaan skeemoista.
- Engine on deterministinen koodi. LLM-kutsut kulkevat aina `AgentRuntime`-rajapinnan kautta; mikään muu paketti ei kutsu Agent SDK:ta suoraan.
- Jokainen Engine-logiikan osa testataan `ScriptedRuntime`-vastauksilla ilman oikeita mallikutsuja.
- Oikeita mallikutsuja (tilauksen käyttörajat) tehdään vain, kun DoD sitä vaatii. Kerro etukäteen, mitä ajat.
- Vain `state`-paketti kirjoittaa `.forge/`-tiedostoihin. Kirjoitukset ovat atomisia. Tapahtumaloki ja transkriptit ovat `.forge/log/`-hakemistossa gitin ulkopuolella.
- Jokainen mekanismi on kytkettävissä pois `mechanisms`-lipulla (SPEC luku 14). Turvarajat ja APPROVE eivät ole lippuja.
- Polkurajat valvotaan kolmella kerroksella: tiedosto-oikeudet, `canUseTool` ja ajon jälkeinen diff-tarkistus (SPEC luku 12). Diff-tarkistus on pakollinen jokaisen agenttiajon jälkeen.
- Implementer jatkaa samaa sessiota tehtäväryhmän sisällä. Tarkistavat roolit (Reviewer, Test Author, Critic) aloittavat aina tyhjällä kontekstilla.
- Jokaisella löydöksellä on `mechanism`-kenttä, ja loppuraportissa on Mikä löysi minkä -taulukko.
- Testit: Vitest. Testit sijaitsevat paketin `test/`-hakemistossa tai `tests/scenarios/`-hakemistossa.
- Koodi, tunnisteet ja kommentit englanniksi. Dokumentaatio ja raportit suomeksi.

## Älä

- Älä lisää riippuvuuksia, joita määrittely ei mainitse, kysymättä.
- Älä lisää SQLiteä, HTTP-palvelinta, WebSocketia tai web-UI:ta (rajattu pois v1:stä).
- Älä rakenna ennen niiden versiota: Ink-käyttöliittymää tai PM-sessiota (v0.5), Arenaa tai rinnakkaista buildia (v0.6, ehdollinen), verkkorajausta, nauhoitusta tai tilan rakentamista lokista (v0.3).
- Älä lisää mekanismia, jolla ei ole riviä virhelokissa tai eval-näyttöä (SPEC luku 14).
- Älä jaa Docker-socketia äläkä käytä privileged-tilaa.
- Älä muuta testejä vain siksi, että ne saadaan menemään läpi.

## Komennot

<!-- Täydennä, kun v0.1:n M1 on valmis. v0.0:n skriptit lisätään tähän K2:n ja K3:n jälkeen. -->
v0.0 (vaativat Dockerin):

- `docker build -t forge-eval-runner evals/runner`: eval-kontin kuva
- `evals/k1/run.sh P<n> [--answer "…"]`: K1-prompti tavallisella Claude Codella kontissa
- `evals/hidden/score.sh <cli-bank|library-api> <toteutus> <tulos.json>`: piilotettu testisarja
- `node evals/hidden/validate.mjs <cli-bank|library-api>`: testisarjan validointi (referenssi ja rikotut versiot)

v0.1:stä alkaen:

- `pnpm install`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
