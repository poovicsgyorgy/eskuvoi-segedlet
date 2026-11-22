/*
  Firebase réteg: belépés (Google, e-mail + jelszó) és Firestore.
  Csak akkor töltődik be, ha a config.js-ben ki van töltve a firebase blokk.
*/
(function () {
  'use strict';
  var V = '10.12.2';
  var BASE = 'https://www.gstatic.com/firebasejs/' + V + '/';

  window.SegedletFB = function (cfg) {
    return Promise.all([
      import(BASE + 'firebase-app.js'),
      import(BASE + 'firebase-auth.js'),
      import(BASE + 'firebase-firestore.js')
    ]).then(function (m) {
      var app = m[0].initializeApp(cfg), A = m[1], F = m[2];
      var auth = A.getAuth(app), db = F.getFirestore(app);
      A.setPersistence(auth, A.browserLocalPersistence).catch(function () {});
      var ref = function (kod) { return F.doc(db, 'parok', kod); };
      var google = function () {
        var prov = new A.GoogleAuthProvider();
        prov.setCustomParameters({ prompt: 'select_account' });
        return A.signInWithPopup(auth, prov).catch(function (e) {
          if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return A.signInWithRedirect(auth, prov);
          throw e;
        });
      };
      A.getRedirectResult(auth).catch(function () {});
      return {
        onUser: function (fn) { return A.onAuthStateChanged(auth, fn); },
        user: function () { return auth.currentUser; },
        google: google,
        login: function (e, p) { return A.signInWithEmailAndPassword(auth, e, p); },
        register: function (e, p) { return A.createUserWithEmailAndPassword(auth, e, p); },
        reset: function (e) { return A.sendPasswordResetEmail(auth, e); },
        logout: function () { return A.signOut(auth); },
        claim: function (kod) {
          var u = auth.currentUser;
          return F.updateDoc(ref(kod), { tagok: F.arrayUnion(u.uid), tagEmailek: F.arrayUnion(u.email || u.uid) });
        },
        watch: function (kod, next, err) {
          return F.onSnapshot(ref(kod), function (s) { next(s.exists() ? s.data() : null, s.metadata); }, err);
        },
        update: function (kod, fields) { return F.updateDoc(ref(kod), fields); },
        myCouples: function () {
          var u = auth.currentUser;
          return F.getDocs(F.query(F.collection(db, 'parok'), F.where('tagok', 'array-contains', u.uid)))
            .then(function (s) { return s.docs.map(function (d) { return Object.assign({ p: d.id }, d.data()); }); });
        },
        all: function () {
          return F.getDocs(F.collection(db, 'parok')).then(function (s) { return s.docs.map(function (d) { return Object.assign({ p: d.id }, d.data()); }); });
        },
        create: function (kod, data) { return F.setDoc(ref(kod), data); },
        remove: function (kod) { return F.deleteDoc(ref(kod)); },
        resetMembers: function (kod) { return F.updateDoc(ref(kod), { tagok: [], tagEmailek: [] }); },
        now: function () { return F.serverTimestamp(); }
      };
    });
  };

  var HIBA = {
    'auth/invalid-credential': 'Hibás e-mail-cím vagy jelszó.',
    'auth/wrong-password': 'Hibás jelszó.',
    'auth/user-not-found': 'Ezzel az e-mail-címmel még nincs fiók. Válaszd a „Regisztráció” lehetőséget.',
    'auth/email-already-in-use': 'Ezzel az e-mail-címmel már van fiók. Lépj be vele.',
    'auth/weak-password': 'A jelszó legalább 6 karakter legyen.',
    'auth/invalid-email': 'Ez nem tűnik érvényes e-mail-címnek.',
    'auth/missing-password': 'Add meg a jelszót.',
    'auth/too-many-requests': 'Túl sok próbálkozás. Várj pár percet, és próbáld újra.',
    'auth/network-request-failed': 'Nincs internetkapcsolat.',
    'auth/unauthorized-domain': 'Ez a webcím nincs engedélyezve a Firebase-ben (Authentication → Settings → Authorized domains).',
    'auth/popup-closed-by-user': '',
    'auth/cancelled-popup-request': ''
  };
  window.segedletHiba = function (e) {
    var c = e && e.code;
    if (c && Object.prototype.hasOwnProperty.call(HIBA, c)) return HIBA[c];
    return 'Hiba történt: ' + ((e && (e.code || e.message)) || 'ismeretlen');
  };

  var G = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* Belépőűrlap: el = konténer, api = SegedletFB példány */
  window.segedletLogin = function (el, api, opts) {
    opts = opts || {};
    var mode = 'login', msg = '', busy = false;
    function draw() {
      el.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:360px;text-align:left">' +
        (opts.cim ? '<div class="disp" style="font-size:28px;line-height:1.1;text-align:center">' + esc(opts.cim) + '</div>' : '') +
        (opts.szoveg ? '<p class="small center" style="margin:0">' + esc(opts.szoveg) + '</p>' : '') +
        '<button class="btn w" data-l="google" style="background:#fff;border-color:var(--line)"' + (busy ? ' disabled' : '') + '>' + G + 'Belépés Google-fiókkal</button>' +
        '<div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink2)"><span style="flex:1;height:1px;background:var(--line)"></span>vagy e-maillel<span style="flex:1;height:1px;background:var(--line)"></span></div>' +
        '<form data-l="form" style="display:flex;flex-direction:column;gap:10px" novalidate>' +
        '<label class="f">E-mail-cím<input id="l-email" type="email" autocomplete="email" inputmode="email" required></label>' +
        '<label class="f">Jelszó' + (mode === 'register' ? ' (legalább 6 karakter)' : '') + '<input id="l-pass" type="password" autocomplete="' + (mode === 'register' ? 'new-password' : 'current-password') + '" required></label>' +
        '<button class="btn p w" type="submit"' + (busy ? ' disabled' : '') + '>' + (mode === 'register' ? 'Regisztráció' : 'Belépés') + '</button></form>' +
        '<p class="small center" role="status" style="margin:0;min-height:20px;color:var(--blushink)">' + esc(msg) + '</p>' +
        '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">' +
        '<button class="btn mini" style="border:none;text-decoration:underline" data-l="mode">' + (mode === 'register' ? 'Van már fiókom – belépés' : 'Még nincs fiókom – regisztráció') + '</button>' +
        '<button class="btn mini" style="border:none;text-decoration:underline" data-l="reset">Elfelejtett jelszó</button></div></div>';
    }
    function fail(e) { busy = false; msg = window.segedletHiba(e); keep(draw); }
    function keep(fn) {
      var em = el.querySelector('#l-email'), v = em ? em.value : '';
      fn(); var n = el.querySelector('#l-email'); if (n) n.value = v;
    }
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-l]'); if (!b || b.tagName === 'FORM') return;
      var a = b.getAttribute('data-l');
      if (a === 'google') { busy = true; msg = ''; keep(draw); api.google().then(function () { busy = false; }, fail); }
      else if (a === 'mode') { mode = mode === 'login' ? 'register' : 'login'; msg = ''; keep(draw); }
      else if (a === 'reset') {
        var e = (el.querySelector('#l-email').value || '').trim();
        if (!e) { msg = 'Írd be fent az e-mail-címed, és nyomd meg újra.'; keep(draw); return; }
        api.reset(e).then(function () { msg = 'Elküldtük a jelszó-visszaállító e-mailt (nézd meg a spam mappát is).'; keep(draw); }, fail);
      }
    });
    el.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var e = el.querySelector('#l-email').value.trim(), p = el.querySelector('#l-pass').value;
      busy = true; msg = ''; keep(draw);
      (mode === 'register' ? api.register(e, p) : api.login(e, p)).then(function () { busy = false; }, fail);
    });
    draw();
  };
})();
