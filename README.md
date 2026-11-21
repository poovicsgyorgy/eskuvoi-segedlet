# Esküvői segédlet – Popovics György

Telefonos alkalmazás a pároknak. Mindegyik pár **saját linket** kap, és a többiektől teljesen függetlenül tölti ki a segédletet. A kérdések **egyenként, sorban nyílnak meg**: a következőt csak az előző megválaszolása után látják.

- **A párok oldala:** `https://poovicsgyorgy.github.io/eskuvoi-segedlet/?p=<saját kód>`
- **A te oldalad:** `https://poovicsgyorgy.github.io/eskuvoi-segedlet/admin.html`
- **Minta:** `https://poovicsgyorgy.github.io/eskuvoi-segedlet/?p=minta`

## Hogyan küldöd ki a 20 párnak?

1. Nyisd meg az **admin oldalt**.
2. Az „Új párok felvétele” mezőbe írd be a párokat, soronként egyet, pl.:
   ```
   Réka & Bence; 2027-06-12
   Anna & Máté; 2027-07-03
   ```
3. Nyomd meg a **Linkek létrehozása** gombot. Minden pár kap egy saját, kitalálhatatlan kódot.
4. A pár sorában az **Üzenet másolása** gomb kimásolja a kész üzenetet a linkkel. Ezt illeszd be e-mailbe, Messengerbe vagy SMS-be.

A párok listája az admin oldalon a böngésződben mentődik. A **Mentés fájlba** gombbal biztonsági másolatot készíthetsz róla, amit egy másik gépen a **Betöltés fájlból** gombbal tudsz visszatölteni.

## Hol látod a válaszokat?

**Google Táblázat nélkül (alapállapot):** a pár válaszai az ő telefonjukon mentődnek. Az „Összesítő” oldalon egy gombnyomással e-mailt küldhetnek neked, vagy kimásolhatják az összefoglalót.

**Google Táblázattal (ajánlott, kb. 10 perc beállítás):** minden válasz automatikusan bekerül a saját Google Táblázatodba:
- A **„Párok”** fülön soronként egy pár látszik, a haladásával és az utolsó mentés idejével.
- Minden párnak **saját füle** van a kérdésekkel, válaszokkal és jegyzetekkel.
- Az admin oldalon is látod, ki hol tart.
- A pár másik telefonon is folytathatja, ahol abbahagyta.

### Google Táblázat beállítása

1. Hozz létre egy új Google Táblázatot (pl. „Esküvői segédlet – válaszok”).
2. A táblázatban: **Bővítmények → Apps Script**.
3. Töröld ki, ami ott van, és másold be az [`apps-script/Code.gs`](apps-script/Code.gs) teljes tartalmát.
4. A kód elején írd át az `ADMIN_KULCS` értékét egy csak általad ismert jelszóra. Ezt fogod beírni az admin oldalon.
5. **Mentés** (floppy ikon), majd jobb fent **Telepítés → Új telepítés**:
   - Típus (fogaskerék): **Webalkalmazás**
   - Végrehajtás mint: **Én**
   - Hozzáférés: **Bárki**
   - **Telepítés**, majd engedélyezd a hozzáférést a Google-fiókoddal.
6. Másold ki a kapott **webalkalmazás URL-t** (`https://script.google.com/macros/s/.../exec`).
7. A GitHubon nyisd meg a [`config.js`](config.js) fájlt, kattints a ceruzára, és a `szolgaltatasUrl: ''` idézőjelei közé illeszd be az URL-t. **Commit changes**.
8. Pár perc múlva az admin oldalon add meg a jelszót. Kész.

Ha később módosítod a `Code.gs`-t: **Telepítés → Telepítések kezelése → szerkesztés → Verzió: Új verzió**, így az URL nem változik.

## Kérdések szerkesztése

Az összes kérdés a [`kerdesek.js`](kerdesek.js) fájlban van, fejezetenként és részenként. A GitHubon közvetlenül szerkesztheted (ceruza ikon):
- új kérdés: írj be egy új sort a megfelelő listába, idézőjelek közé, a végén vesszővel;
- tipp: a rész `tipp:` sora jelenik meg „György tanácsa” címmel.

A párok már megadott válaszai megmaradnak. Egy kérdés **szövegének átírásakor** viszont az a kérdés újként nyílik meg nekik.

## Beállítások

A [`config.js`](config.js) fájlban:
- `email`: ide mennek a párok e-mailjei;
- `fejezetekSorban`: `true` esetén a következő fejezet is csak az előző befejezése után nyílik meg.

## Adatvédelem

- A párok linkjei véletlenszerű kódot tartalmaznak, ezeket nem lehet kitalálni. Mindenki csak a sajátját látja.
- Google Táblázat nélkül a válaszok csak a pár telefonján vannak.
- Google Táblázattal a válaszok a te Google-fiókodban vannak. A párok listáját csak a jelszóval lehet lekérni.
