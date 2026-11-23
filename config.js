/*
  Beállítások – ezt a fájlt nyugodtan szerkesztheted a GitHubon (ceruza ikon).
*/
window.SEGEDLET_CONFIG = {
  // A ceremóniamester neve és e-mail címe (az "E-mail Györgynek" gombhoz).
  ceremoniamester: 'Popovics György',
  megszolitas: 'György',
  megszolitasNek: 'Györgynek',
  megszolitasHoz: 'Györgyhöz',
  megszolitasTol: 'Györgytől',
  email: 'eskuvo.popovicsgyorgy@gmail.com',

  // BELÉPÉS ÉS KÖZPONTI MENTÉS (Firebase) – README, „Firebase beállítása”.
  // Ha ki van töltve, a párok Google-fiókkal vagy e-mail + jelszóval lépnek be,
  // és minden válasz a Firebase-be mentődik (a Google Táblázat ilyenkor nem kell).
  firebase: {
    apiKey: 'AIzaSyA93rr7tUuXiqlkUpBR_B-ZhzEDXD7TEXs',
    authDomain: 'eskuvoi-segedlet.firebaseapp.com',
    projectId: 'eskuvoi-segedlet',
    storageBucket: 'eskuvoi-segedlet.firebasestorage.app',
    messagingSenderId: '639640734054',
    appId: '1:639640734054:web:7e5c1f2380e267fe02e0a7'
  },
  // Ezzel az e-mail-címmel lépsz be az admin oldalra (a firestore.rules fájlban is ez szerepel).
  adminEmail: 'eskuvo.popovicsgyorgy@gmail.com',

  // E-MAIL ÉRTESÍTÉSEK (Google Apps Script webalkalmazás címe) – README, „Értesítések beállítása”.
  // Üresen hagyva minden működik, csak e-mail nem megy ki.
  ertesitesUrl: '',

  // (Régi, opcionális mód Firebase nélkül.) A Google Táblázat háttér címe (Apps Script webalkalmazás URL).
  // Amíg üres, a párok válaszai csak a saját telefonjukon mentődnek,
  // és e-mailben tudják elküldeni neked. Beállítás: README.md
  szolgaltatasUrl: '',

  // true: a következő fejezet csak az előző befejezése után nyílik meg.
  // false: a fejezetek bármilyen sorrendben kitölthetők
  //        (a kérdések fejezeten belül mindig sorban nyílnak).
  fejezetekSorban: false
};
