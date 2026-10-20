# BioSens frontend

Preprosta stran z velikimi črkami. Brez gradnje in odvisnosti. **Vsi podatki so simulirani.**

## Zagon

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory frontend
```

Odprite http://localhost:8080.

## Trije pogledi

- **Kakšna je voda?** – za vsakogar: en velik odgovor (v redu / nenavadno / pozor) in štiri kartice.
- **Podatki** – za strokovnjaka: graf (24 ur / 7 dni), posebnosti, zadnje meritve, prenos CSV.
- **Naprava** – za vzdrževanje: povezava, zadnji paket, signal, temperature čipov, zadnji paketi.

Meje v `demo-rules.mjs` so izmišljene, samo za prikaz.

## Datoteke

- `ui.mjs` – stran
- `app.mjs` – demo podatki in CSV
- `monitoring.mjs` – ocena stanja in zaznavanje dogodkov
- `demo-rules.mjs` – izmišljene meje

## Testi

```sh
cd frontend && node --test
```
