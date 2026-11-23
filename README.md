# Esküvői segédlet – Popovics György

Telefonos alkalmazás a pároknak. Mindegyik pár **saját linket** kap, **belép** Google-fiókkal vagy e-mail-címmel, és a többiektől teljesen függetlenül tölti ki a segédletet. A kérdések **egyenként, sorban nyílnak meg**: a következőt csak az előző megválaszolása után látják.

- **A párok oldala:** `https://poovicsgyorgy.github.io/eskuvoi-segedlet/?p=<saját kód>`
- **A te oldalad:** `https://poovicsgyorgy.github.io/eskuvoi-segedlet/admin.html`
- **Minta (belépés nélkül):** `https://poovicsgyorgy.github.io/eskuvoi-segedlet/?p=minta`

## Hogyan működik?

1. Az **admin oldalon** belépsz, beírod a párokat, és mindegyik kap egy saját linket.
2. A pár megnyitja a linket, és **belép** Google-fiókkal vagy e-mail + jelszóval. Egy linkhez **legfeljebb 2 fiók** (a pár két tagja) csatlakozhat. Ők közösen, valós időben látják ugyanazt.
3. A válaszok azonnal mentődnek. Bármelyik telefonon vagy gépen folytathatják: ha belépnek a főoldalon, a rendszer a saját segédletükhöz viszi őket.
4. Az admin oldalon látod mindenki haladását. A **Válaszok** gombbal megnézheted egy pár összes válaszát és jegyzetét, és letöltheted Excelbe.

Ha egy pár rossz fiókkal lépett be, vagy új telefonszámot és e-mailt használ, a **Belépések törlése** gombbal felszabadítod a linket, és újra csatlakozhatnak. A válaszaik megmaradnak.

## Firebase beállítása (egyszer, kb. 10 perc)

A belépést és a mentést a Google ingyenes Firebase szolgáltatása végzi.

1. **console.firebase.google.com** → *Projekt létrehozása* → név: `eskuvoi-segedlet` → (Analytics kikapcsolható) → Létrehozás.
2. **Build → Authentication → Get started → Sign-in method**:
   - **Google** → Enable → support e-mail: a tiéd → Save.
   - **Email/Password** → az első kapcsoló (Email/Password) be → Save.
3. **Authentication → Settings → Authorized domains → Add domain:** `poovicsgyorgy.github.io`
4. **Build → Firestore Database → Create database** → helyszín: `eur3 (Europe)` → *production mode* → Create.
5. **Firestore Database → Rules**: töröld ki, ami ott van, másold be a [`firestore.rules`](firestore.rules) teljes tartalmát → **Publish**. (Ha a `firestore.rules` fájl később változik, ezt a lépést meg kell ismételni.)
6. **Fogaskerék → Project settings → Your apps → `</>` (Web)** → név: `segedlet` → Register app. Másold ki a `firebaseConfig` értékeit.
7. A GitHubon nyisd meg a [`config.js`](config.js) fájlt (ceruza ikon), és töltsd ki a `firebase: { ... }` blokkot a kapott értékekkel → **Commit changes**.
8. Pár perc múlva nyisd meg az admin oldalt, és lépj be Google-lel az `eskuvo.popovicsgyorgy@gmail.com` fiókkal.

Ha más e-mail-címmel szeretnél adminként belépni, írd át a `config.js` fájlban (`adminEmail`) **és** a `firestore.rules` fájlban is, majd a szabályokat töltsd fel újra (5. lépés).

**Költség:** az ingyenes (Spark) csomag bőven elég 20 párra. Bankkártyát nem kell megadni.

## Megjegyzések a párnak

Az admin oldalon egy pár **Válaszok** gombjával megnyílik az összes válasza. Itt:
- **Általános üzenet a párnak:** ez a pár kezdőlapján jelenik meg.
- **Megjegyzés írása** bármelyik megválaszolt kérdésnél: a pár a kezdőlapján („György üzenetei”) és a kérdésnél is látja, és **válaszolhat** rá.
- A szűrőkkel (Még nem, Folyamatban, Megjegyzéssel…) gyorsan megtalálod, amit keresel.
- Ha a pár válaszolt, a párok listájában „új válasz a pártól” jelzés jelenik meg.

## Értesítések beállítása (egyszer, kb. 10 perc)

Az e-maileket egy ingyenes Google Apps Script küldi a te Gmail-fiókodból:
- **neked:** amikor egy pár befejez egy fejezetet vagy a teljes segédletet, és amikor válaszol a megjegyzésedre;
- **a párnak:** amikor megjegyzést írsz neki, amikor 14 napja nem nyitotta meg a segédletet, és amikor 30 napon belül lesz az esküvő, de még legalább 5 teendője van (hetente legfeljebb egyszer).

1. Menj a **script.google.com** oldalra (az `eskuvo.popovicsgyorgy@gmail.com` fiókkal) → **Új projekt**. Bal fent nevezd el: `Segédlet értesítések`.
2. Töröld ki a szerkesztőben lévő kódot, és másold be az [`ertesites/Code.gs`](ertesites/Code.gs) teljes tartalmát. Mentés (floppy ikon).
3. A felső sávban a függvényválasztóban válaszd a **`beallitas`** függvényt, és nyomd meg a **Futtatás** gombot.
   - Megjelenik az engedélykérés: *Engedélyek áttekintése* → válaszd a fiókodat → *Speciális* → *Ugrás a(z) Segédlet értesítések projektre (nem biztonságos)* → *Engedélyezés*. (Ez a saját szkripted, ezért írja ki, hogy nincs ellenőrizve.)
   - Pár másodperc múlva kapsz egy próba e-mailt: „az értesítések be vannak kapcsolva”.
4. Jobb fent **Telepítés → Új telepítés** → fogaskerék: **Webalkalmazás** → *Végrehajtás mint:* **Én** → *Hozzáférés:* **Bárki** → **Telepítés**.
5. Másold ki a **webalkalmazás URL-t** (`https://script.google.com/macros/s/…/exec`), és küldd el nekem, vagy írd be a [`config.js`](config.js) `ertesitesUrl: ''` idézőjelei közé.

Ha később módosul a kód: *Telepítés → Telepítések kezelése → ceruza → Verzió: Új verzió → Telepítés* (így az URL nem változik).

## Kérdések szerkesztése

Az összes kérdés a [`kerdesek.js`](kerdesek.js) fájlban van, fejezetenként és részenként. A GitHubon közvetlenül szerkesztheted (ceruza ikon):
- új kérdés: új sor a megfelelő listában, idézőjelek között, a végén vesszővel;
- tipp: a rész `tipp:` sora jelenik meg „György tanácsa” címmel.

A párok már megadott válaszai megmaradnak. Egy kérdés **szövegének átírásakor** viszont az a kérdés újként nyílik meg nekik.

## Beállítások ([`config.js`](config.js))

- `email`: a párok „Kérdezz” és „E-mail küldése” gombja ide ír;
- `fejezetekSorban`: `true` esetén a következő fejezet is csak az előző befejezése után nyílik meg;
- `firebase`: belépés és központi mentés (lásd fent). Ha üres, az alkalmazás belépés nélkül működik: a válaszok csak a pár telefonján mentődnek.

## Adatvédelem

- A párok linkjei véletlenszerű, kitalálhatatlan kódot tartalmaznak.
- Egy pár adatait csak a hozzá csatlakozott (legfeljebb 2) fiók és a ceremóniamester láthatja. Ezt a Firestore biztonsági szabályai a szerver oldalon garantálják.
- Az adatok a te Firebase-projektedben, európai szerveren vannak.

---

### Régi, opcionális mód: Google Táblázat (Firebase helyett)

Ha nem szeretnél belépést, a válaszokat egy Google Táblázatba is gyűjtheted: az [`apps-script/Code.gs`](apps-script/Code.gs) kódot a táblázat *Bővítmények → Apps Script* menüjébe másolva, webalkalmazásként telepítve (*Végrehajtás: Én, Hozzáférés: Bárki*), majd az URL-t a `config.js` `szolgaltatasUrl` mezőjébe írva. Ez csak akkor működik, ha a `firebase` blokk üres.
