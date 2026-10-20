# BioSens frontend

Preprosta Astro stran z velikimi črkami. **Vsi podatki so simulirani.**

## Zagon

```sh
cd frontend
npm install
npm run dev        # astro dev --host → http://<ip>:4321
npm run build      # statična stran v dist/
```

## Trije pogledi

- **Voda** – za vsakogar: en velik odgovor (OK / nenavadno), štiri kartice in posebni dogodki.
- **Podatki** – za strokovnjaka: graf (24 ur / 7 dni), posebnosti, zadnje meritve, prenos CSV.
- **Naprava** – za vzdrževanje: povezava, zadnji paket, signal, temperature čipov, zadnji paketi.

Meje v `demo-rules.mjs` so izmišljene, samo za prikaz.

## Datoteke

- `src/pages/index.astro` – stran
- `src/styles.css` – videz
- `src/lib/ui.mjs` – izris pogledov
- `src/lib/app.mjs` – demo podatki in CSV
- `src/lib/monitoring.mjs` – ocena stanja in zaznavanje dogodkov
- `src/lib/demo-rules.mjs` – izmišljene meje

## Testi

```sh
cd frontend && npm test
```
