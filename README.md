# BioSens frontend

Preprosta Astro stran z velikimi črkami. **Vsi podatki so simulirani.**

## Zagon

```sh
npm install
npm run dev        # astro dev --host → http://<ip>:4321
npm run build      # statična stran v dist/
```

## Objava na Cloudflare Workers

Statična stran: Astro zgradi `dist/`, Worker te datoteke streže (`wrangler.jsonc`, brez lastne kode).

```sh
npx wrangler login       # enkrat
npm run preview:worker   # lokalno, kot na Cloudflare
npm run deploy           # zgradi in objavi
```

Za samodejno objavo ob vsakem pushu povežite repozitorij v Cloudflare (Workers Builds): ukaz za gradnjo `npm run build`, ukaz za objavo `npx wrangler deploy`.

## Pogledi

- **Voda** – za vsakogar: en velik odgovor (OK / nenavadno), štiri kartice in posebni dogodki.
- **Podatki** – za strokovnjaka: pet grafov (temperatura, motnost, prevodnost, fluorescenca, umerjena fluorescenca) z isto časovno osjo (6 ur / 24 ur / 7 dni), skupna kazalka čez vse grafe, običajno območje in posebni dogodki na grafu, vrzeli v podatkih ostanejo vidne; spektrometer; tabela vseh meritev; prenos CSV.
- **Naprava** – za vzdrževanje: povezava, zadnji paket, signal, temperature čipov, zadnji paketi.
- **Nastavitve** – običajna območja in prag hitre spremembe za vsako meritev, meje za opozorila spektrometra, čas brez povezave in meje signala. Shranijo se v brskalnik (`localStorage`).

## Izbira časa (Podatki)

Kot v orodjih za spremljanje (Grafana, Datadog), logika v `src/lib/timerange.mjs`:

- Gumb s časom odpre seznam: zadnja ura, 6 ur, 12 ur, 24 ur, 2 dneva, 7 dni, in polji **Od / Do** za obdobje po meri.
- **‹ ›** premakneta obdobje za polovico nazaj ali naprej, **lupa** ga podaljša na dvojno dolžino.
- Z miško **povlecite čez graf**, da povečate izbrani del.
- Obdobje je v naslovu strani (`?obdobje=24h` ali `?od=…&do=…`), zato se ga da deliti ali shraniti kot zaznamek. Taka povezava odpre pogled Podatki.
- Obdobje velja za vse: grafe, spektrometer, tabelo in prenos CSV.

## Spektrometer

Naprava je poceni: ne meri koncentracij, ampak zazna **spremembe**. Svetloba žarnice gre skozi vodo, 18 kanalov (AS7265x, 410–940 nm) izmeri, koliko je pride skozi. Vsak odčitek se primerja z **običajnim stanjem te naprave** = mediana po kanalih v zadnjem tednu (100 %). Umerjanje s čisto vodo ni potrebno (`src/lib/spectrum.mjs`).

- **Spekter**: prepustnost v % običajnega po valovni dolžini, zdaj in na začetku obdobja.
- **Kazalniki skozi čas** – za koliko % več svetlobe se izgubi kot običajno (0 = kot običajno, manj od 0 = manj kot običajno):
  - **Mulj in delci** – vsi kanali;
  - **Rjava barva** – modri del (410–435 nm) minus 860 nm. Pri 860 nm svetlobo zadržijo samo delci, zato se mulj odšteje;
  - **Alge** – dodatna izguba pri 680 nm glede na sosednja kanala (645, 705 nm);
  - **Modrozelene alge** – dodatna izguba pri 610 nm glede na sosednja kanala (585, 645 nm).
- **Opozorila**: rjava barva, alge in modrozelene alge sprožijo dogodek (in stanje »Nenavadno«), ko presežejo mejo v Nastavitvah. Mulj ne, ker ga že pokriva senzor motnosti.
- **Toplotna karta**: vsi kanali skozi čas na eni skupni lestvici.

Če je voda dalj časa drugačna, se ji »običajno« sčasoma prilagodi.

Privzete meje v `demo-rules.mjs` so izmišljene, samo za prikaz.

## Datoteke

- `src/pages/index.astro` – stran
- `src/styles.css` – videz
- `src/lib/ui.mjs` – izris pogledov
- `src/lib/app.mjs` – demo podatki in CSV
- `src/lib/monitoring.mjs` – ocena stanja in zaznavanje dogodkov
- `src/lib/demo-rules.mjs` – izmišljene meje
- `src/lib/settings.mjs` – nastavitve: privzete vrednosti, preverjanje, nalaganje

## Testi

```sh
npm test
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
Spektrometer na pogledu Voda nima kartice; njegove spremembe (rjava barva, alge, modrozelene alge) se pokažejo med posebnimi dogodki.

Viri: poročilo WaQuMoS (TLF, alge, mulj, železo); [WEDC: merjenje motnosti](https://wedc-knowledge.lboro.ac.uk/resources/booklets/G031-Measuring-turbidity-in-water-supplies-online.pdf); [Atlas Scientific: prevodnost vode](https://atlas-scientific.com/blog/water-conductivity-range/); [BGS: TLF in fekalno onesnaženje](https://www.bgs.ac.uk/news/real-time-detection-of-faecally-contaminated-drinking-water/).
