# Vertailuspeksit

Jokainen speksi on oma hakemistonsa. Tiedostot ovat englanniksi, koska ne annetaan sellaisenaan agenteille.

| Tiedosto | Sisältö | Kuka saa |
| --- | --- | --- |
| `prompt.md` | Alkuperäinen prompti muuttamattomana (sama kuin `evals/k1-prompts.md`) | A, B, C |
| `interface.md` | Kiinnitetty ulkoinen rajapinta: käynnistys, komennot tai reitit ja tulostemuoto. Ei sisällä vastauksia epäselviin kohtiin | A, B, C |
| `answers.md` | Valmiit vastaukset intake-kysymyksiin, jotta toistot ovat vertailukelpoisia | C (Spec Intaken vastauksina); B:n `spec.md` on johdettu niistä |
| `spec.md` | Hyväksytty spec haaralle B: prompti ja vastaukset koottuna numeroiduiksi vaatimuksiksi (REQ-n). Piilotettujen testien vaatimus-ID:t viittaavat näihin | B |

**Haarojen syötteet**

- **A:** `prompt.md`, jonka perään liitetään `interface.md`.
- **B:** `spec.md` ja `interface.md` (spec viittaa rajapintaan).
- **C:** `prompt.md` ja `interface.md`. Spec Intaken kysymyksiin vastataan `answers.md`:n perusteella.

Rajapinta ja vaatimukset erotetaan tarkoituksella. `interface.md` kertoo vain sen, mitä mustan laatikon testi tarvitsee toteutuksen kutsumiseen. Epäselvien kohtien oikeat vastaukset (esim. desimaalipilkku, poisto avoimilla lainoilla) ovat vain `answers.md`:ssä ja `spec.md`:ssä. Niistä syntyvä ero mittaa Spec Intaken hyötyä (A vs. B).

Piilotetut testisarjat ovat hakemistossa `evals/hidden/<speksi>/`. Mikään haara ei näe niitä.
