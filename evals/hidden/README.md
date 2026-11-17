# Piilotetut hyväksymistestisarjat

**Tätä hakemistoa ei koskaan anneta vertailtavalle haaralle.** Sitä ei liitetä haarojen kontteihin, ei kopioida ajohakemistoon eikä mainita prompteissa. Pisteytys ajetaan erikseen ajon jälkeen.

## Rakenne

```
hidden/
  score.sh                 # pisteyttää yhden toteutuksen kontissa
  validate.mjs             # validoi testisarjan: referenssi + rikotut versiot
  lib/score.mjs            # kontin sisäinen ajuri: asennus, testit, koonti
  lib/reporter.mjs         # node:test-raportoija (JSON-rivit)
  <speksi>/tests/*.test.mjs   # mustan laatikon testit; nimi alkaa REQ-tunnisteilla
  <speksi>/reference/         # käsin tarkistettu referenssitoteutus
  <speksi>/mutants.json       # tahallisesti rikotut versiot referenssistä
  <speksi>/VALIDATION.md      # validointiloki ja korjatut testit
```

## Käyttö

```bash
evals/hidden/score.sh cli-bank <toteutuksen-hakemisto> evals/results/<ajo>/cli-bank.json
evals/hidden/score.sh library-api <toteutuksen-hakemisto> evals/results/<ajo>/library-api.json
node evals/hidden/validate.mjs cli-bank        # referenssi + kaikki rikotut versiot
```

`score.sh` liittää toteutuksen konttiin vain luku -tilassa ja kopioi sen kontin omalle levylle (SQLite:n WAL ei toimi macOS:n bind-mountilla). Toteutuksen hakemisto ei siis muutu. Asennus tehdään vain niillä askeleilla, jotka `interface.md` lupaa: `requirements.txt` virtuaaliympäristöön tai `npm install` ja `npm run build`.

Tulos on JSON-tiedosto, jossa ovat `totals` (passed, failed, passRate), `perRequirement` (REQ → passed/total), `tests` (nimi, tila, virhe) ja `setup` (asennusaskeleiden onnistuminen).

## Mittari

Ensisijainen mittari on läpäistyjen testien osuus (`totals.passRate`). `perRequirement` kertoo, mitkä vaatimukset jäivät täyttämättä. Testejä ei painoteta.

## Muutossääntö

CLAUDE.md:n mukaan testisarjaa ei saa muuttaa ensimmäisen vertailuajon jälkeen ilman käyttäjän hyväksyntää, koska muutos mitätöi aiemmat tulokset. Ennen sitä tehdyt muutokset kirjataan tiedostoon `<speksi>/VALIDATION.md`.
