(function () {
  'use strict';
  var C = window.SEGEDLET_CONFIG || {};
  var DATA = window.SEGEDLET || [];
  var OSSZES = DATA.reduce(function (s, f) { return s + f.reszek.reduce(function (a, r) { return a + r.kerdesek.length; }, 0); }, 0);
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var CIMKE = { kesz: 'Kész', folyamatban: 'Folyamatban', meg_nem: 'Még nem', nem_rel: 'Nem releváns' };

  var FBM = !!(C.firebase && C.firebase.apiKey);
  var fb = null, fbUser = null;
  var parok = FBM ? [] : LS.get('segedlet-admin-parok', []);
  var kulcs = LS.get('segedlet-admin-kulcs', '');
  var confirmId = null;
  var DEF_SABLON = 'Kedves {nev}!\n\nKüldöm az esküvői segédleteteket. A saját linketeken, a telefonotokon tudjátok kitölteni:\n{link}\n\n' +
    (FBM ? 'Először lépjetek be Google-fiókkal vagy e-mail-címmel (mindketten beléphettek). ' : '') +
    'A kérdések egyenként nyílnak meg, bármikor abbahagyhatjátok és később folytathatjátok.\n\nÜdv,\n' + (C.ceremoniamester || '');
  $('sablon').value = LS.get('segedlet-admin-sablon', DEF_SABLON);
  $('sablon').addEventListener('input', function () { LS.set('segedlet-admin-sablon', $('sablon').value); });

  var base = location.href.split('#')[0].split('?')[0].replace(/admin\.html$/, '');
  function link(p) {
    // Firebase módban a név és a dátum az adatbázisban van, ezért elég a kód.
    if (FBM) return base + '?p=' + encodeURIComponent(p.p);
    return base + '?p=' + encodeURIComponent(p.p) + '&n=' + encodeURIComponent(p.nev || '') + (p.datum ? '&d=' + encodeURIComponent(p.datum) : '');
  }
  function uzenet(p) { return $('sablon').value.replace(/\{nev\}/g, p.nev).replace(/\{link\}/g, link(p)); }
  function ujKod() {
    var abc = 'abcdefghjkmnpqrstuvwxyz23456789', a = new Uint32Array(8), s = '';
    crypto.getRandomValues(a); for (var i = 0; i < a.length; i++) s += abc[a[i] % abc.length]; return s;
  }
  function mentes() { if (!FBM) LS.set('segedlet-admin-parok', parok); }
  function toast(t) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2800); }
  function copy(text, msg) {
    var done = function () { toast(msg || 'Kimásolva'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Nem sikerült másolni'); } ta.remove(); }
  }
  function datumSzoveg(v) {
    if (!v) return '—';
    var d = new Date(v); if (isNaN(d)) return '—';
    return d.toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function letolt(nev, tartalom, tipus) {
    var blob = new Blob([tartalom], { type: tipus });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nev; document.body.appendChild(a); a.click(); a.remove();
  }
  function allapot(t) { var el = $('allapot'); if (el) el.textContent = t; }

  /* ---------- Google Táblázat háttér (régi mód) ---------- */
  var vanSzolg = !FBM && !!C.szolgaltatasUrl;
  function post(body) {
    body.key = kulcs;
    return fetch(C.szolgaltatasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }

  /* ---------- lista betöltése ---------- */
  function frissit() {
    if (FBM) {
      if (!fb || !fbUser) return;
      allapot('Frissítés…');
      fb.all().then(function (list) {
        parok = list.map(function (d) {
          return { p: d.p, nev: d.nev, datum: d.datum, kesz: d.kesz || 0, osszes: d.osszes || OSSZES, mentve: d.frissitve, tagok: d.tagEmailek || [], valaszok: d.valaszok || {}, megj: d.megjegyzesek || {} };
        });
        rajz(); allapot('Frissítve: ' + new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }));
      }, function (e) { allapot(e && e.code === 'permission-denied' ? 'Ehhez a fiókhoz nincs ceremóniamesteri jogosultság (lásd firestore.rules).' : 'Nem sikerült betölteni: ' + (e.code || e.message)); });
      return;
    }
    if (!vanSzolg || !kulcs) return;
    allapot('Frissítés…');
    fetch(C.szolgaltatasUrl + '?action=list&key=' + encodeURIComponent(kulcs))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) { allapot(j.hiba || 'Hiba'); return; }
        j.parok.forEach(function (rp) {
          var p = parok.filter(function (x) { return x.p === rp.p; })[0];
          if (!p) { p = { p: rp.p, nev: rp.nev, datum: rp.datum }; parok.push(p); }
          p.kesz = rp.kesz; p.osszes = rp.osszes || OSSZES; p.mentve = rp.mentve;
          if (rp.nev) p.nev = rp.nev; if (rp.datum) p.datum = rp.datum;
        });
        mentes(); rajz();
        allapot('Frissítve: ' + new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }));
      })
      .catch(function () { allapot('Nem érem el a Google Táblázatot. Jó a cím a config.js-ben?'); });
  }

  function kapcsolat() {
    var h;
    if (FBM) {
      if (!fbUser) h = '<div id="login" style="display:flex;justify-content:center"></div>';
      else h = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><div style="font-weight:700">Belépve: ' + esc(fbUser.email || '') + '</div><p class="small" id="allapot" style="margin:2px 0 0"></p></div><button class="btn mini" id="kilep">Kijelentkezés</button></div>';
    } else if (!vanSzolg) {
      h = '<div style="font-weight:700">Nincs bekötve tárhely</div><p class="small" style="margin:4px 0 0">A párok linkjei így is működnek: a válaszaik a saját telefonjukon mentődnek, és e-mailben elküldhetik neked. Belépéshez és központi mentéshez állítsd be a Firebase-t (README).</p>';
    } else {
      h = '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap"><label class="f" style="flex:1;min-width:200px">Admin jelszó (az Apps Script kódban megadott)<input id="kulcs" type="password" value="' + esc(kulcs) + '" autocomplete="current-password"></label><button class="btn p" id="kulcsment">Mentés</button></div><p class="small" id="allapot" style="margin:6px 0 0">' + (kulcs ? '' : 'Add meg a jelszót, hogy lásd a párok haladását.') + '</p>';
    }
    $('kapcsolat').innerHTML = h;
    if (FBM && !fbUser && fb) window.segedletLogin($('login'), fb, { cim: 'Ceremóniamesteri belépés', szoveg: C.adminEmail ? 'Lépj be ezzel a fiókkal: ' + C.adminEmail : 'Lépj be a ceremóniamesteri fiókoddal.' });
    var km = $('kulcsment');
    if (km) km.onclick = function () { kulcs = $('kulcs').value.trim(); LS.set('segedlet-admin-kulcs', kulcs); frissit(); };
    var kl = $('kilep');
    if (kl) kl.onclick = function () { fb.logout(); };
    document.querySelectorAll('[data-csak-belepve]').forEach(function (el) { el.hidden = FBM && !fbUser; });
  }

  function rajz() {
    parok.sort(function (a, b) { return String(a.datum || '9999').localeCompare(String(b.datum || '9999')) || String(a.nev).localeCompare(String(b.nev), 'hu'); });
    $('db').textContent = parok.length;
    $('ures').hidden = parok.length > 0;
    $('lista').innerHTML = parok.map(function (p) {
      var o = p.osszes || OSSZES;
      var hal = p.kesz != null ? p.kesz + ' / ' + o + ' (' + Math.round(p.kesz / o * 100) + '%)' : (vanSzolg || FBM ? '—' : 'nincs bekötve');
      var mi = FBM ? megjInfo(p) : null;
      var tag = FBM ? '<div class="small" style="margin-top:2px">' + (p.tagok && p.tagok.length ? esc(p.tagok.join(', ')) : 'Még senki nem lépett be') + '</div>' +
        (mi.db ? '<div class="small" style="margin-top:2px">' + mi.db + ' megjegyzés' + (mi.uj ? ' · <b style="color:var(--blushink)">' + mi.uj + ' új válasz a pártól</b>' : '') + '</div>' : '') : '';
      return '<tr><td><b>' + esc(p.nev) + '</b>' + tag + '</td><td data-l="Esküvő">' + esc(p.datum || '—') + '</td><td class="num" data-l="Haladás">' + hal + '</td><td data-l="Utolsó mentés">' + datumSzoveg(p.mentve) + '</td>' +
        '<td><div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="btn mini p" data-act="uzenet" data-p="' + esc(p.p) + '">Üzenet másolása</button>' +
        '<button class="btn mini" data-act="link" data-p="' + esc(p.p) + '">Link</button>' +
        (FBM ? '<button class="btn mini" data-act="valaszok" data-p="' + esc(p.p) + '">Válaszok</button>' : '<a class="btn mini" href="' + esc(link(p)) + '" target="_blank" rel="noopener">Megnyitás</a>') +
        (FBM && p.tagok && p.tagok.length ? '<button class="btn mini" data-act="reset" data-p="' + esc(p.p) + '">' + (confirmId === 'r' + p.p ? 'Biztos?' : 'Belépések törlése') + '</button>' : '') +
        '<button class="btn mini danger" data-act="torol" data-p="' + esc(p.p) + '">' + (confirmId === p.p ? 'Biztos? A válaszai is törlődnek' : 'Törlés') + '</button>' +
        '</div></td></tr>';
    }).join('');
  }

  /* ---------- válaszok megtekintése ---------- */
  function sorok(p) {
    var out = [];
    DATA.forEach(function (f) {
      f.reszek.forEach(function (r) {
        r.kerdesek.forEach(function (q) {
          var v = (p.valaszok || {})[hash(f.cim + '|' + q)];
          var id = hash(f.cim + '|' + q), c = (p.megj || {})[id];
          out.push({ id: id, f: f.cim, r: r.cim, q: q, a: v ? CIMKE[v.a] || '' : '', n: v ? v.n || '' : '', aKod: v ? v.a : '', m: c && c.s ? c.s : '', pv: v && v.r ? v.r : '' });
        });
      });
    });
    return out;
  }
  function csv(p) {
    var c = function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; };
    return '﻿' + [['Fejezet', 'Rész', 'Kérdés', 'Válasz', 'Jegyzet', 'Megjegyzésed', 'A pár válasza']].concat(sorok(p).map(function (s) { return [s.f, s.r, s.q, s.a, s.n, s.m, s.pv]; }))
      .map(function (r) { return r.map(c).join(';'); }).join('\r\n');
  }
  function ujValasz(p, id) {
    var c = (p.megj || {})[id], v = (p.valaszok || {})[id];
    return !!(c && c.s && v && v.rt && v.rt > (c.t || 0) && v.rt > (c.latta || 0));
  }
  function megjInfo(p) {
    var ids = Object.keys(p.megj || {}).filter(function (id) { return p.megj[id] && p.megj[id].s; });
    return { db: ids.length, uj: ids.filter(function (id) { return ujValasz(p, id); }).length };
  }
  function ertesitPart(p, kerdes, szoveg) {
    if (!C.ertesitesUrl || !p.tagok || !p.tagok.length) return Promise.resolve(false);
    return fb.token().then(function (token) {
      return fetch(C.ertesitesUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({
        action: 'megjegyzes', token: token, p: p.p, nev: p.nev, link: link(p), cimzettek: p.tagok, kerdes: kerdes, szoveg: szoveg }) });
    }).then(function (r) { return r.json(); }).then(function (j) { return !!(j && j.ok); }, function () { return false; });
  }
  function reszletek(p) {
    var szuro = 'mind', nyitott = null;
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(40,25,10,.45);z-index:20;display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:20px 12px';
    var box = document.createElement('div');
    box.className = 'card'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', (p.nev || '') + ' válaszai');
    box.style.cssText = 'width:100%;max-width:780px';
    ov.appendChild(box);
    var latta = {};
    Object.keys(p.megj || {}).forEach(function (id) { if (ujValasz(p, id)) latta['megjegyzesek.' + id + '.latta'] = Date.now(); });
    function szerk(id, cimke) {
      var c = (p.megj || {})[id] || {};
      return '<div class="madmin"><label class="f">' + esc(cimke) + '<textarea data-m="' + id + '" rows="3">' + esc(c.s || '') + '</textarea></label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn mini p" data-x="ment" data-id="' + id + '">Mentés és értesítés</button>' +
        (c.s ? '<button class="btn mini danger" data-x="torol" data-id="' + id + '">Megjegyzés törlése</button>' : '') +
        '<button class="btn mini" data-x="megse">Mégse</button></div></div>';
    }
    function megjNezet(id) {
      var c = (p.megj || {})[id], v = (p.valaszok || {})[id] || {};
      if (nyitott === id) return szerk(id, id === '_altalanos' ? 'Általános üzenet a párnak' : 'Megjegyzésed ehhez a kérdéshez');
      var h = '';
      if (c && c.s) h += '<div class="mshow"><b>Megjegyzésed:</b> ' + esc(c.s) + '</div>';
      if (v.r) h += '<div class="mshow pr' + (ujValasz(p, id) ? ' uj' : '') + '"><b>A pár válasza' + (ujValasz(p, id) ? ' (új)' : '') + ':</b> ' + esc(v.r) + '</div>';
      h += '<button class="btn mini" data-x="nyit" data-id="' + id + '">' + (c && c.s ? 'Megjegyzés szerkesztése' : 'Megjegyzés írása') + '</button>';
      return h;
    }
    function epit() {
      var szurok = [['mind', 'Mind'], ['meg_nem', 'Még nem'], ['folyamatban', 'Folyamatban'], ['kesz', 'Kész'], ['nem_rel', 'Nem releváns'], ['megj', 'Megjegyzéssel']];
      var h = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><div class="disp" style="font-size:30px">' + esc(p.nev) + '</div><div class="small">' + (p.kesz || 0) + ' / ' + (p.osszes || OSSZES) + ' kérdés' + (p.datum ? ' · ' + esc(p.datum) : '') + '</div></div>' +
        '<div style="display:flex;gap:8px"><button class="btn mini" data-x="csv">Letöltés (Excel)</button><button class="btn mini p" data-x="close">Bezárás</button></div></div>';
      h += '<div class="card" style="background:#fff;margin-top:12px"><div style="font-weight:700;margin-bottom:6px">Általános üzenet a párnak</div>' + megjNezet('_altalanos') + '</div>';
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">' + szurok.map(function (x) { return '<button class="btn mini' + (szuro === x[0] ? ' p' : '') + '" data-x="szuro" data-s="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
      var last = '', db = 0;
      sorok(p).forEach(function (s) {
        if (!s.a) return;
        var vanM = !!((p.megj || {})[s.id] && p.megj[s.id].s) || !!((p.valaszok || {})[s.id] || {}).r;
        if (szuro === 'megj' ? !vanM : (szuro !== 'mind' && s.aKod !== szuro)) return;
        db++;
        if (s.f !== last) { last = s.f; h += '<h2 class="disp" style="font-size:24px;margin:18px 0 6px">' + esc(s.f) + '</h2>'; }
        h += '<div style="padding:10px 0;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:6px"><div style="display:flex;gap:10px;justify-content:space-between"><div><div style="font-size:14px">' + esc(s.q) + '</div>' + (s.n ? '<div class="small" style="margin-top:2px">Jegyzet: ' + esc(s.n) + '</div>' : '') + '</div><span class="chip a-' + esc(s.aKod) + '" style="align-self:flex-start">' + esc(s.a) + '</span></div>' + megjNezet(s.id) + '</div>';
      });
      if (!db) h += '<p class="small" style="margin-top:14px">Nincs ilyen válasz.</p>';
      box.innerHTML = h;
      var ta = box.querySelector('textarea[data-m]'); if (ta) ta.focus();
    }
    function zar() { ov.remove(); document.removeEventListener('keydown', k); frissit(); }
    function k(e) { if (e.key === 'Escape') zar(); }
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { zar(); return; }
      var x = e.target.closest('[data-x]'); if (!x) return;
      var a = x.getAttribute('data-x'), id = x.getAttribute('data-id');
      if (a === 'close') zar();
      else if (a === 'csv') letolt('segedlet-' + String(p.nev || p.p).replace(/[^\wáéíóöőúüűÁÉÍÓÖŐÚÜŰ]+/g, '-') + '.csv', csv(p), 'text/csv;charset=utf-8');
      else if (a === 'szuro') { szuro = x.getAttribute('data-s'); nyitott = null; epit(); }
      else if (a === 'nyit') { nyitott = id; epit(); }
      else if (a === 'megse') { nyitott = null; epit(); }
      else if (a === 'ment') {
        var txt = (box.querySelector('textarea[data-m="' + id + '"]').value || '').trim();
        if (!txt) { toast('Írj be egy megjegyzést'); return; }
        x.disabled = true;
        var c = { s: txt, t: Date.now() }, f = {}; f['megjegyzesek.' + id] = c;
        fb.update(p.p, f).then(function () {
          p.megj = p.megj || {}; p.megj[id] = c; nyitott = null; epit();
          var kerdes = id === '_altalanos' ? '' : (sorok(p).filter(function (s) { return s.id === id; })[0] || {}).q || '';
          return ertesitPart(p, kerdes, txt).then(function (ok) {
            toast(ok ? 'Elmentve, a pár e-mailt is kapott' : (C.ertesitesUrl ? 'Elmentve. Az e-mail most nem ment ki, de a pár az alkalmazásban látja.' : 'Elmentve – a pár az alkalmazásban látja'));
          });
        }, function (er) { x.disabled = false; toast('Hiba: ' + (er.code || er.message)); });
      } else if (a === 'torol') {
        fb.torolMezo(p.p, 'megjegyzesek.' + id).then(function () { delete p.megj[id]; nyitott = null; epit(); toast('Megjegyzés törölve'); }, function (er) { toast('Hiba: ' + (er.code || er.message)); });
      }
    });
    document.addEventListener('keydown', k);
    document.body.appendChild(ov);
    epit();
    if (Object.keys(latta).length) fb.update(p.p, latta).then(function () {
      Object.keys(latta).forEach(function (key) { var id = key.split('.')[1]; if (p.megj[id]) p.megj[id].latta = latta[key]; });
    }, function () {});
  }

  /* ---------- műveletek ---------- */
  function ujDoc(nev, datum, valaszok, kesz) {
    return { nev: nev || '', datum: datum || '', tagok: [], tagEmailek: [], valaszok: valaszok || {}, kesz: kesz || 0, osszes: OSSZES, kezdve: false, frissitve: 0, letrehozva: fb.now() };
  }
  $('letrehoz').onclick = function () {
    var sz = $('uj').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!sz.length) { toast('Írj be legalább egy párt'); return; }
    var ujak = sz.map(function (s) {
      var parts = s.split(';'), nev = parts[0].trim(), d = (parts[1] || '').trim();
      var m = d.match(/(\d{4})[.\-\/ ]+(\d{1,2})[.\-\/ ]+(\d{1,2})/);
      return { p: ujKod(), nev: nev, datum: m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '' };
    });
    if (FBM) {
      if (!fbUser) { toast('Előbb lépj be'); return; }
      var btn = $('letrehoz'); btn.disabled = true;
      Promise.all(ujak.map(function (p) { return fb.create(p.p, ujDoc(p.nev, p.datum)); }))
        .then(function () { $('uj').value = ''; toast(ujak.length + ' link elkészült'); frissit(); }, function (e) { toast('Nem sikerült létrehozni: ' + (e.code || e.message)); })
        .then(function () { btn.disabled = false; });
      return;
    }
    parok = parok.concat(ujak); mentes(); rajz(); $('uj').value = '';
    toast(ujak.length + ' link elkészült');
    if (vanSzolg && kulcs) ujak.forEach(function (p) { post({ action: 'register', p: p.p, nev: p.nev, datum: p.datum }).catch(function () {}); });
  };
  $('frissit').onclick = function () {
    if (FBM) { if (fbUser) frissit(); else toast('Előbb lépj be'); }
    else if (!vanSzolg) toast('Előbb állítsd be a tárhelyet (README)'); else if (!kulcs) toast('Add meg a jelszót'); else frissit();
  };
  $('osszesmasol').onclick = function () { copy(parok.map(function (p) { return p.nev + ': ' + link(p); }).join('\n'), 'Az összes link kimásolva'); };
  $('export').onclick = function () { letolt('segedlet-parok.json', JSON.stringify(parok, null, 2), 'application/json'); };
  $('import').onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    f.text().then(function (t) {
      var arr = JSON.parse(t), uj = arr.filter(function (x) { return x && x.p && !parok.some(function (y) { return y.p === x.p; }); });
      if (FBM) {
        if (!fbUser) { toast('Előbb lépj be'); return; }
        return Promise.all(uj.map(function (x) { return fb.create(x.p, ujDoc(x.nev, x.datum, x.valaszok, x.kesz)); }))
          .then(function () { toast(uj.length + ' pár betöltve'); frissit(); });
      }
      parok = parok.concat(uj); mentes(); rajz(); toast(uj.length + ' pár betöltve');
    }).catch(function () { toast('Ez nem a segédlet mentésfájlja'); });
  };
  $('lista').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var p = parok.filter(function (x) { return x.p === b.getAttribute('data-p'); })[0]; if (!p) return;
    var act = b.getAttribute('data-act');
    function megerosit(id) {
      if (confirmId === id) { confirmId = null; return true; }
      confirmId = id; rajz(); setTimeout(function () { if (confirmId === id) { confirmId = null; rajz(); } }, 4000); return false;
    }
    if (act === 'uzenet') copy(uzenet(p), 'Üzenet kimásolva – illeszd be e-mailbe vagy Messengerbe');
    else if (act === 'link') copy(link(p), 'Link kimásolva');
    else if (act === 'valaszok') reszletek(p);
    else if (act === 'reset') {
      if (!megerosit('r' + p.p)) return;
      fb.resetMembers(p.p).then(function () { toast('Belépések törölve – a pár újra beléphet a linkkel'); frissit(); }, function (er) { toast('Hiba: ' + (er.code || er.message)); });
    } else if (act === 'torol') {
      if (!megerosit(p.p)) return;
      if (FBM) { fb.remove(p.p).then(function () { toast('Törölve'); frissit(); }, function (er) { toast('Hiba: ' + (er.code || er.message)); }); return; }
      parok = parok.filter(function (x) { return x !== p; }); mentes(); rajz();
      if (vanSzolg && kulcs) post({ action: 'remove', p: p.p }).catch(function () {});
      toast('Törölve a listából');
    }
  });

  if (FBM) {
    kapcsolat();
    if (!window.SegedletFB) { $('kapcsolat').innerHTML = '<p class="small">Nem sikerült betölteni a belépést. Frissítsd az oldalt.</p>'; }
    else window.SegedletFB(C.firebase).then(function (api) {
      fb = api;
      fb.onUser(function (u) { fbUser = u; parok = []; rajz(); kapcsolat(); if (u) frissit(); });
    }, function () { $('kapcsolat').innerHTML = '<p class="small">Nem sikerült betölteni a belépést. Van internet? Frissítsd az oldalt.</p>'; });
  } else { kapcsolat(); frissit(); }
  rajz();
})();
