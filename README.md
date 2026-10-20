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
- **Podatki** – za strokovnjaka: pet grafov (temperatura, motnost, prevodnost, fluorescenca, umerjena fluorescenca) z isto časovno osjo (6 ur / 24 ur / 7 dni), skupna kazalka čez vse grafe, običajno območje in posebni dogodki na grafu, vrzeli v podatkih ostanejo vidne; spektrometer; tabela vseh meritev; prenos CSV.
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

## Pomen meritev za laike

Pogled **Voda** vsako meritev prevede v preprost odgovor (`src/lib/plain.mjs`):

| Meritev | Naslov kartice | Odgovori | Vir referenčnih vrednosti |
|---|---|---|---|
| Temperatura | Temperatura | samo številka v °C | – |
| Motnost | Bistrost | bistra < 1 NTU, rahlo motna < 5, motna < 50, zelo motna | smernice SZO za pitno vodo (5 NTU, idealno < 1) |
| Prevodnost | Minerali | malo < 100 µS/cm, zmerno < 800, veliko < 2000, zelo veliko | tipične vrednosti: destilirana ~1, pipa/reke 50–800, morje ~50.000 |
| Fluorescenca | Organsko onesnaženje | manj / kot običajno / več kot običajno (glede na nastavljeno območje) | poročilo WaQuMoS: UV fluorescenca, podobna triptofanu, kot kazalnik fekalnega onesnaženja (E. coli) |

Fluorescenca je v voltih in ni umerjena, zato se primerja samo z običajnim območjem naprave. Ne šteje bakterij.
Spektrometer bi po poročilu lahko prepoznal alge (680 nm), mulj in železo (350–400 nm), vendar to še ni umerjeno, zato ga pogled Voda ne prikazuje.

Viri: poročilo WaQuMoS (TLF, alge, mulj, železo); [WEDC: merjenje motnosti](https://wedc-knowledge.lboro.ac.uk/resources/booklets/G031-Measuring-turbidity-in-water-supplies-online.pdf); [Atlas Scientific: prevodnost vode](https://atlas-scientific.com/blog/water-conductivity-range/); [BGS: TLF in fekalno onesnaženje](https://www.bgs.ac.uk/news/real-time-detection-of-faecally-contaminated-drinking-water/).
