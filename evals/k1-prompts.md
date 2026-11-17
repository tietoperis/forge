# K1: virhelokin promptit

Kuusi promptia, jotka ajetaan tavallisella Claude Codella (haara A, ei Forgen apuja) tyhjässä kansiossa. Ajon jälkeen tulos kirjataan `evals/failures.md`-tiedostoon: mitä pyydettiin, mitä saatiin ja mikä puuttui tai oli väärin.

Promptit on valittu kattamaan eri kokoluokat (S, M, L), eri työtyypit ja kaksi tahallisesti epätäydellistä promptia, jotka testaavat sitä, huomaako tavallinen Claude Code epäselvyyden itse. Promptit 1 ja 2 ovat samalla K2:n vertailuspeksien (CLI-työkalu ja CRUD-API) pohjat. Promptit annetaan sellaisenaan, ilman lisäselityksiä.

## Ajosäännöt

- Yksi ajo per prompti, uusi tyhjä kansio ja uusi sessio. Älä auta tai ohjaa kesken ajon, ellei Claude Code kysy jotain; vastaa silloin lyhyesti ja kirjaa kysymys lokiin.
- Kirjaa lokiin myös, kuinka monta kertaa Claude Code kysyi tarkentavia kysymyksiä (nolla on tärkeä havainto).
- Tarkista tulos itse: käynnistä se, kokeile happy path ja kaksi virhetilannetta, aja sen omat testit ja lue koodi. Kirjaa vain havaitut puutteet.
- Älä tulkitse puutteita mekanismeiksi tässä vaiheessa. Se tehdään K4:ssä mekanismirekisterissä.

## Promptit

### P1: CLI-työkalu (S)

> Build a command-line tool in Python that reads a CSV file of bank transactions (date, description, amount) and prints a monthly summary: total income, total spending, and the five largest expense categories. Categories come from keyword rules in a config file that the user can edit. Transactions that match no rule go to "uncategorised". Include tests.

Mitä tästä tarkistetaan: päivämäärä- ja desimaalimuotojen kirjo (pilkku vs. piste), tyhjät rivit ja rikkinäinen CSV, usean vuoden data, sääntöjen järjestys kun kaksi avainsanaa osuu, config-tiedoston puuttuminen.

### P2: CRUD-API (M)

> Build a REST API for a small library: books, members and loans. A member can borrow at most three books at a time, a book can only be on loan to one member, and returning a book must record the date. Use TypeScript and SQLite, include input validation and automated tests, and write a README with how to run it.

Mitä tästä tarkistetaan: rajoitusten pitäminen rinnakkaisissa pyynnöissä, virheilmoitusten johdonmukaisuus, validointi, poistot kun lainoja on auki, README:n ohjeiden toimivuus puhtaassa kansiossa, testien oikea kattavuus (eivätkä vain happy pathit).

### P3: Käyttöliittymällinen sovellus (L)

> Build a web app for tracking my gym workouts. I log exercises with sets, reps and weight, and I want to see my progress over time per exercise as a chart. It should work on my phone and keep my data between visits.

Mitä tästä tarkistetaan: toimiiko mobiilinäkymä oikeasti (390 px), tyhjä-, lataus- ja virhetilat, datan säilyminen, kuinka pitkälle prompti tulkitaan "kuntosalikirjaukseksi" ilman, että kysytään (tilit, usea käyttäjä, yksiköt kg/lb), onko kaavio järkevä yhdellä ja sadalla kirjauksella.

### P4: Koneoppimiseen liittyvä data-skripti

> Here is a folder of 200 short audio clips (wav, various lengths) with a labels.csv mapping filenames to "calm" or "agitated". Write a Python pipeline that extracts features, trains a classifier, evaluates it properly, and reports results. I care about whether the result would hold up on new speakers, not just new clips.

Mitä tästä tarkistetaan: kansio ei oikeasti ole olemassa, joten katso, huomaako Claude Code sen ja luoko se synteettistä dataa hiljaa vai sanooko se asiasta. Lisäksi: vuotaako puhujatieto train/test-jaon yli (vaikka prompti sanoo, ettei saa), onko arviointi puhujakohtainen, perustellaanko mittarit.

### P5: Tahallisesti epäselvä prompti

> Make a tool that helps me keep track of what my team is working on. It should be simple but powerful, and integrate with what we already use.

Mitä tästä tarkistetaan: kysyykö Claude Code mitään (ei ole mitään "jo käytössä olevaa" tietoa), vai arvaako se ja rakentaa jotain. Jos arvaa, kirjaa mitä se oletti ja kertooko se oletuksista. Tämä on suora koe Spec Intaken hyödystä.

### P6: Keskenään ristiriitaiset vaatimukset

> Build a command-line password manager in Python. It must work completely offline and never write anything to disk, but it also has to remember my passwords between sessions. Keep it under 150 lines and make it production-ready with full test coverage.

Mitä tästä tarkistetaan: huomaako Claude Code ristiriidan "ei kirjoita levylle" vs. "muistaa istuntojen välillä" ja "alle 150 riviä" vs. "tuotantovalmis, täysi kattavuus", vai ratkaiseeko se sen hiljaa jotenkin. Tarkista myös, onko salaus tehty oikein (ei oma kryptografia, järkevä avainjohdanto).

## Yhteenveto ajosta

Kun kaikki kuusi on ajettu, lisää `evals/failures.md`:n loppuun lyhyt yhteenveto: kuinka monta ajoa tuotti toimivan tuloksen ilman omia korjauksiasi, kuinka monta kertaa Claude Code kysyi tarkennuksia ja mitkä puutteet toistuivat useammassa kuin yhdessä ajossa. Toistuvat puutteet ovat mekanismikandidaatteja K4:ssä.
