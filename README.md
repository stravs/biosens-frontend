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

## Izbira časa (Podatki)

Kot v orodjih za spremljanje (Grafana, Datadog), logika v `src/lib/timerange.mjs`:

- Gumb s časom odpre seznam: zadnja ura, 6 ur, 12 ur, 24 ur, 2 dneva, 7 dni, in polji **Od / Do** za obdobje po meri.
- **‹ ›** premakneta obdobje za polovico nazaj ali naprej, **lupa** ga podaljša na dvojno dolžino.
- Z miško **povlecite čez graf**, da povečate izbrani del.
- Obdobje je v naslovu strani (`?obdobje=24h` ali `?od=…&do=…`), zato se ga da deliti ali shraniti kot zaznamek. Taka povezava odpre pogled Podatki.
- Obdobje velja za vse: grafe, spektrometer, tabelo in prenos CSV.

## Spektrometer

Kot v poročilu WaQuMoS: naprava meri, koliko svetlobe halogenske žarnice pride skozi vodo na 18 kanalih (AS7265x, 410–940 nm, vsak širok ~20 nm). Vzorec se primerja s čisto (deionizirano) vodo = 100 % prepustnosti (`src/lib/spectrum.mjs`).

- **Spekter**: prepustnost v % po valovni dolžini, zdaj in na začetku obdobja, z barvnim trakom kanalov.
- **Kazalniki skozi čas** (odstotne točke izgubljene svetlobe): vsi kanali (mulj, delci), modri del 410–435 nm (železo, mangan), alge = dodatna izguba pri 680 nm nad črto med 645 in 705 nm (klorofil; kot metoda FLH).
- **Toplotna karta**: vsi kanali skozi čas na eni skupni lestvici.

`DEMO_REFERENCE` (odčitek čiste vode po kanalih) je izmišljen. Za pravo uporabo ga je treba izmeriti z deionizirano vodo ob umerjanju.
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
