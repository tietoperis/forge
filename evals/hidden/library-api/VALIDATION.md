# Validointi: library-api

**Tila:** validoitu 2026-11-17. Vertailuajoja ei ole vielä tehty, joten sarjaa saa vielä muuttaa.

## Sarja

- 31 testiä: 30 tiedostossa `tests/api.test.mjs` (yksi palvelin ja yksi tietokanta koko tiedostolle; jokainen testi luo omat kirjansa ja jäsenensä) ja 1 tiedostossa `tests/persistence.test.mjs` (uudelleenkäynnistys samalla tietokannalla).
- Testit kattavat vaatimukset REQ-1–REQ-17. REQ-18 (omat testit ja README) ei ole mustan laatikon testattavissa, eikä sitä pisteytetä.
- Rinnakkaisuus (REQ-7): 10 samanaikaista lainapyyntöä samasta kirjasta, joista täsmälleen yhden pitää onnistua. Lisäksi 8 samanaikaista pyyntöä samalta jäseneltä, joista täsmälleen kolmen pitää onnistua.

## Referenssitoteutus

`reference/`: TypeScript Node 24:n tyyppien poistolla, `node:http` ja `node:sqlite`. npm-riippuvuuksia ei ole. Poistot ovat pehmeitä (`deleted_at`), joten lainahistoria säilyy (REQ-11). `BEGIN IMMEDIATE` -transaktio ja osittainen uniikki-indeksi pitävät lainasäännöt. Omat testit: `reference/test/app.test.ts` (2 testiä, läpi).

Tarkistus käsin: koodi luettiin vaatimus kerrallaan spec.md:tä vasten. Tarkistuksen teki Claude, ei ihminen.

## Ajot

| Ajo | Tulos |
| --- | --- |
| Referenssi, 4 ajoa (validointi ja 3 toistoa epävakauden tarkistamiseksi) | 31/31 jokaisella kerralla |
| K1:n P2-tuotos (ei noudata rajapintaa: ei `/health`-reittiä eikä `DATABASE_PATH`-muuttujaa, eri kenttien nimet) | 0/31. Asennus onnistui, mutta `/health` ei vastannut |

## Rikotut versiot (`mutants.json`)

`node evals/hidden/validate.mjs library-api`: **VALID**, kaikki 12 kaatuivat.

| Versio | Mistä | Kaatui vaatimuksen testeihin |
| --- | --- | --- |
| limit-four | | REQ-5 |
| returned-loans-count | | REQ-5 |
| check-then-insert-race | Asynkroninen tauko tarkistuksen ja lisäyksen välissä, ilman transaktiota ja indeksiä | REQ-7 (molemmat testit) |
| coerce-ids | K1 P2 (`"bookId": true`) | REQ-14 |
| isbn-without-checksum | K1 P2 (`"----------"`) | REQ-12 |
| delete-with-active-loan | | REQ-10 |
| delete-removes-history | | REQ-11 |
| email-case-sensitive | | REQ-13 |
| client-chosen-return-date | | REQ-8 |
| in-memory-database | | REQ-17 |
| error-body-without-error-field | | REQ-15 |
| unknown-book-is-400 | | REQ-9 |

## Korjatut testit

Ei korjauksia: kaikki testit läpäisivät referenssin ensimmäisellä ajolla, ja jokainen rikottu versio kaatui.

## Rajoitukset

- Rinnakkaisuustesti ajetaan yhdellä palvelinprosessilla, kuten answers.md sallii. K1:n P2:ssa havaittua kahden prosessin `database is locked` -ongelmaa ei mitata.
- Jos toteutus ei käynnisty tai `/health` puuttuu, kaikki testit kaatuvat. Tämä on tarkoituksellista, koska rajapinta on kiinnitetty.
- Testit ja referenssi on kirjoittanut sama tekijä (ks. cli-bank/VALIDATION.md, avoimet asiat).
