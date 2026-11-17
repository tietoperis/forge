# Validointi: cli-bank

**Tila:** validoitu 2026-11-17. Vertailuajoja ei ole vielä tehty, joten sarjaa saa vielä muuttaa.

## Sarja

- 35 testiä tiedostossa `tests/cli.test.mjs`. Ne kattavat spec.md:n vaatimukset REQ-1–REQ-18 (testien määrä vaatimuksittain: REQ-3 5, REQ-5 6, REQ-15 4, muut 1–3).
- REQ-19 (projektissa on omat testit) ei ole mustan laatikon testattavissa, eikä sitä pisteytetä.

## Referenssitoteutus

`reference/banksummary`: Python 3.11, vain standardikirjasto. Lisäksi `categories.toml` ja yksikkötestit `reference/tests/`.

Tarkistus käsin: koodi luettiin vaatimus kerrallaan spec.md:tä vasten, ja referenssin omat 5 yksikkötestiä ajettiin. Ne löysivät yhden bugin, jonka korjasin: tyhjä summa kaatoi `parse_amount`-funktion, koska `"" in "+-"` on Pythonissa tosi. Tarkistuksen teki Claude, ei ihminen. Ks. avoimet asiat.

## Ajot

| Ajo | Tulos |
| --- | --- |
| Referenssi | 35/35 |
| K1:n P1-tuotos (ei noudata rajapintaa: ei `banksummary`-tiedostoa, eri konfiguraatiomuoto) | 0/35. Pisteytys ei kaadu rajapintaa noudattamattomaan toteutukseen |

## Rikotut versiot (`mutants.json`)

Jokaisen rikotun version pitää kaatua vähintään yhteen testiin, joka on merkitty sen rikkomalla vaatimuksella. `node evals/hidden/validate.mjs cli-bank`: **VALID**, kaikki 11 kaatuivat.

| Versio | Mistä | Kaatui vaatimuksen testeihin |
| --- | --- | --- |
| decimal-comma-as-thousands | K1 P1 | REQ-3 (4 testiä) |
| substring-keywords | K1 P1 | REQ-8 |
| abort-on-bad-row | K1 P1 | REQ-5 (6 testiä) |
| us-dates-month-first | K1 P1 | REQ-4 |
| last-rule-wins | | REQ-9 |
| missing-default-config-is-fatal | | REQ-10 |
| no-two-decimal-rounding | | REQ-16 |
| ties-not-alphabetical | | REQ-15 |
| top-six | | REQ-15 |
| bom-not-stripped | | REQ-1 |
| refund-nets-spending | | REQ-14 |

## Korjatut testit

| Testi | Vika | Korjaus |
| --- | --- | --- |
| REQ-5: empty lines … line numbers stay physical | Testi odotti riviä 7, oikea fyysinen rivinumero on 6. Löytyi referenssiajosta | Odotus muutettu riviksi 6, ja laskenta kirjoitettu kommenttiin |
| REQ-15: … ties alphabetical | Tasatilanteen rivit olivat valmiiksi aakkosjärjestyksessä, joten testi ei olisi havainnut syöttöjärjestyksen käyttöä | Rivien järjestys käännetty (D ennen C:tä). Rikottu versio `ties-not-alphabetical` kaatuu |
| REQ-16: arithmetic is exact … | Kaikki syötteet olivat kaksidesimaalisia, joten pyöristämätön tuloste läpäisi testin (`no-two-decimal-rounding` säilyi) | Syötteinä nyt `-0.1`, `100` ja `0.2`. Rikottu versio kaatuu |
| REQ-12: example categories.toml | Testi tarkisti vain tiedoston olemassaolon, ja K1:n P1 läpäisi sen väärällä konfiguraatiomuodolla | Testi ajaa työkalun esimerkkitiedostolla ja odottaa onnistumista |

## Avoimet asiat

- Testit ja referenssi on kirjoittanut sama tekijä, joten yhteinen väärintulkinta spec.md:stä ei näy referenssiajossa. Rikotut versiot pienentävät riskiä mutta eivät poista sitä. **Suositus:** käyttäjä lukee answers.md:n ja testien nimet ennen ensimmäistä vertailuajoa.
