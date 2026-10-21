# BioSens frontend

Preprosta Astro stran z velikimi črkami. Prikazuje podatke z naprave (UG65 → Cloudflare). Dokler jih ni (ali v `npm run dev`, kjer ni API-ja), pokaže simulirane podatke in to napiše v nogi.

## Zagon

```sh
npm install
npm run dev        # astro dev --host → http://<ip>:4321
npm run build      # statična stran v dist/
```

## Objava na Cloudflare Workers

Astro zgradi `dist/`, Worker (`worker/index.mjs`) streže stran in API `/api/*`. Podatki so v bazi D1 `biosens`; ob prvi objavi jo wrangler ustvari sam, tabela se ustvari ob prvi uporabi.

```sh
npx wrangler login                    # enkrat
npx wrangler secret put UPLINK_TOKEN  # enkrat: dolg naključen niz, npr. openssl rand -hex 24
npm run preview:worker                # lokalno, kot na Cloudflare (lokalna D1)
npm run deploy                        # zgradi in objavi
```

Za samodejno objavo ob vsakem pushu povežite repozitorij v Cloudflare (Workers Builds): ukaz za gradnjo `npm run build`, ukaz za objavo `npx wrangler deploy`.

## Podatki z naprave (UG65 → Cloudflare)

Naprava (FW2, `#define USE_LORA`) vsako meritev pošlje kot 50-bajtni LoRa paket. UG65 ga s svojim strežnikom LoRaWAN sprejme in po HTTP pošlje Workerju:

```
naprava ──LoRa──▶ UG65 (vgrajen Network Server) ──HTTPS POST──▶ /api/uplink ──▶ D1: uplinks (surovo) + hours (vsote po urah)
stran ◀── /api/readings (do 7 dni) ali /api/hours (dlje) ◀── Worker
```

- **`POST /api/uplink`** – JSON iz UG65 (`devEUI`, `data` v base64, `rxInfo[].rssi`, `rxInfo[].loRaSNR`). Žeton v glavi `Authorization: Bearer …` ali v naslovu `?token=…`. Shrani čas prejema, devEUI, RSSI, SNR in surove bajte. Paket, ki nima 50 bajtov, zavrne (400).
- **`GET /api/readings?from=&to=`** (ms) – posamezne meritve, največ 8 dni naenkrat. Brez parametrov: teden do zadnje meritve. Vrne `{ start, end, rows }`; `start`/`end` sta prva in zadnja meritev sploh.
- **`GET /api/hours?from=&to=`** (ms) – povprečja za katerokoli obdobje, v celih urah, največ 1000 točk (leto ≈ po 9 ur). Vrne `{ bucket, rows }`; vrstice imajo `count` = koliko meritev je povprečenih.
- Tabela `hours` hrani vsote po urah (`src/lib/hourly.mjs`); vsak paket se ob prejemu prišteje k svoji uri. Leto je ~8.800 vrstic namesto ~105.000 meritev, zato je dolgo obdobje poceni za branje (D1 brezplačno: 5 milijonov prebranih vrstic na dan).
- Shranjeno ostane vse, nič se ne briše (~50 KB na dan pri meritvi na 5 min).
- Stran se osvežuje sama: vsako minuto vpraša samo po meritvah, novejših od zadnje (ko je zavihek skrit, počaka). Podatki sledijo novim meritvam pri izbiri do 7 dni (npr. »Zadnjih 24 ur«); izbrano obdobje in urna povprečja ostanejo, kot so.
- Voda in Naprava uporabljata teden do zadnje meritve. Podatki naložijo izbrano obdobje, ko ga izberete: do 7 dni posamezne meritve skupaj s tednom pred koncem obdobja (»običajno« spektrometra = mediana tega tedna), dlje urna povprečja (»običajno« = mediana obdobja). Dogodki pri povprečjih so grobi.
- Dekodiranje je v `src/lib/payload.mjs` po `compressor()` iz firmware: 18 kanalov (A…L, ×10), motnost ×100, EC25 ×10, temperatura ×1000, fluorescenca ×10, fluorescenčni signal ×10000 – vse uint16, little-endian; nato temperature čipov 3, 2, 1 in ID naprave. Shranjeni so surovi bajti, zato popravek dekoderja velja tudi za stare meritve. Urne vsote pa se ne popravijo same: po spremembi dekoderja jih je treba preračunati iz `uplinks`.

### Nastavitev UG65

1. **Network Server → General**: vklopi, regija EU868.
2. **Profiles**: dodaj profil OTAA, razred A.
3. **Applications → Add**: ime `BioSens`, Payload Codec **None** (dekodira Worker). Data Transmission **HTTP(S)**, Uplink data: `https://<worker>.workers.dev/api/uplink?token=<UPLINK_TOKEN>`. Če firmware omogoča glave HTTP, lahko namesto `?token=` doda `Authorization: Bearer <UPLINK_TOKEN>`.
4. **Device → Add**: DevEUI naprave (izpiše ga ob zagonu na serijskih vratih), AppEUI in AppKey kot v `arduino_secrets.h`, aplikacija `BioSens`, zgornji profil.
5. Preverite: **Packets** v UG65 kaže prejete pakete, `https://<worker>.workers.dev/api/readings` pa vrne meritve.

Opombe:
- Firmware negativne vrednosti pošlje kot 0 (tudi temperaturo pod 0 °C), kanali spektra pa so omejeni na 6553,5 (uint16/10).
- Stran prikaže eno napravo; več naprav bi se na grafih pomešalo.
- Branje `/api/readings` je javno, kot stran. Zaprete ju lahko s Cloudflare Access.

## Pogledi

- **Voda** – za vsakogar: en velik odgovor (OK / nenavadno), štiri kartice in posebni dogodki.
- **Podatki** – za strokovnjaka: pet grafov (temperatura, motnost, prevodnost, fluorescenca, umerjena fluorescenca) z isto časovno osjo (6 ur / 24 ur / 7 dni), skupna kazalka čez vse grafe, običajno območje in posebni dogodki na grafu, vrzeli v podatkih ostanejo vidne; spektrometer; tabela vseh meritev; prenos CSV.
- **Naprava** – za vzdrževanje: povezava, zadnji paket, signal, temperature čipov, zadnji paketi.
- **Nastavitve** – običajna območja in prag hitre spremembe za vsako meritev, meje za opozorila spektrometra, čas brez povezave in meje signala. Shranijo se v brskalnik (`localStorage`).

## Izbira časa (Podatki)

Kot v orodjih za spremljanje (Grafana, Datadog), logika v `src/lib/timerange.mjs`:

- Gumb s časom odpre seznam: zadnja ura, 6 ur, 12 ur, 24 ur, 2 dneva, 7 dni, vse, in polji **Od / Do** za obdobje po meri.
- **‹ ›** premakneta obdobje za polovico nazaj ali naprej, **lupa** ga podaljša na dvojno dolžino.
- Z miško **povlecite čez graf**, da povečate izbrani del.
- Obdobje je v naslovu strani (`?obdobje=24h` ali `?od=…&do=…`), zato se ga da deliti ali shraniti kot zaznamek. Taka povezava odpre pogled Podatki.
- Obdobje velja za vse: grafe, spektrometer, tabelo in prenos CSV.
- Nazaj se da do prve meritve (**Vse**). Obdobja nad 7 dni kažejo urna povprečja; tabela in CSV takrat tudi (stolpec `st_meritev`).

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
- `src/lib/app.mjs` – polja, demo podatki in CSV
- `src/lib/payload.mjs` – dekodiranje paketa FW2 in sporočila UG65
- `src/lib/hourly.mjs` – urne vsote: SQL in povprečja
- `worker/index.mjs` – Worker: sprejem paketov, branje iz D1
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
