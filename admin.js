(function () {
  'use strict';
  var C = window.SEGEDLET_CONFIG || {};
  var OSSZES = (window.SEGEDLET || []).reduce(function (s, f) { return s + f.reszek.reduce(function (a, r) { return a + r.kerdesek.length; }, 0); }, 0);
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var parok = LS.get('segedlet-admin-parok', []);
  var kulcs = LS.get('segedlet-admin-kulcs', '');
  var confirmId = null;
  var DEF_SABLON = 'Kedves {nev}!\n\nKüldöm az esküvői segédleteteket. A saját linketeken, a telefonotokon tudjátok kitölteni:\n{link}\n\nA kérdések egyenként nyílnak meg, bármikor abbahagyhatjátok és később folytathatjátok.\n\nÜdv,\n' + (C.ceremoniamester || '');
  $('sablon').value = LS.get('segedlet-admin-sablon', DEF_SABLON);
  $('sablon').addEventListener('input', function () { LS.set('segedlet-admin-sablon', $('sablon').value); });

  var base = location.href.split('#')[0].split('?')[0].replace(/admin\.html$/, '');
  function link(p) { return base + '?p=' + encodeURIComponent(p.p) + '&n=' + encodeURIComponent(p.nev) + (p.datum ? '&d=' + encodeURIComponent(p.datum) : ''); }
  function uzenet(p) { return $('sablon').value.replace(/\{nev\}/g, p.nev).replace(/\{link\}/g, link(p)); }
  function ujKod() {
    var abc = 'abcdefghjkmnpqrstuvwxyz23456789', a = new Uint32Array(10), s = '';
    crypto.getRandomValues(a); for (var i = 0; i < a.length; i++) s += abc[a[i] % abc.length]; return s;
  }
  function mentes() { LS.set('segedlet-admin-parok', parok); }
  function toast(t) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2600); }
  function copy(text, msg) {
    var done = function () { toast(msg || 'Kimásolva'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Nem sikerült másolni'); } ta.remove(); }
  }
  function datumSzoveg(iso) {
    if (!iso) return '—';
    var d = new Date(iso); if (isNaN(d)) return '—';
    return d.toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- háttér ---------- */
  var vanSzolg = !!C.szolgaltatasUrl;
  function post(body) {
    body.key = kulcs;
    return fetch(C.szolgaltatasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  function frissit() {
    if (!vanSzolg || !kulcs) return;
    $('allapot').textContent = 'Frissítés…';
    fetch(C.szolgaltatasUrl + '?action=list&key=' + encodeURIComponent(kulcs))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) { $('allapot').textContent = j.hiba || 'Hiba'; return; }
        j.parok.forEach(function (rp) {
          var p = parok.filter(function (x) { return x.p === rp.p; })[0];
          if (!p) { p = { p: rp.p, nev: rp.nev, datum: rp.datum }; parok.push(p); }
          p.kesz = rp.kesz; p.osszes = rp.osszes || OSSZES; p.mentve = rp.mentve;
          if (rp.nev) p.nev = rp.nev; if (rp.datum) p.datum = rp.datum;
        });
        mentes(); rajz();
        $('allapot').textContent = 'Frissítve: ' + new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
      })
      .catch(function () { $('allapot').textContent = 'Nem érem el a Google Táblázatot. Jó a cím a config.js-ben?'; });
  }

  function kapcsolat() {
    var h;
    if (!vanSzolg) {
      h = '<div style="font-weight:700">Google Táblázat: nincs bekötve</div><p class="small" style="margin:4px 0 0">A párok linkjei így is működnek, a válaszaik a saját telefonjukon mentődnek, és e-mailben tudják elküldeni neked. Ha szeretnéd, hogy minden válasz automatikusan a táblázatodba kerüljön, és itt lásd a haladást, kövesd a README „Google Táblázat beállítása” részét.</p>';
    } else {
      h = '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap"><label class="f" style="flex:1;min-width:200px">Admin jelszó (az Apps Script kódban megadott)<input id="kulcs" type="password" value="' + esc(kulcs) + '" autocomplete="current-password"></label><button class="btn p" id="kulcsment">Mentés</button></div><p class="small" id="allapot" style="margin:6px 0 0">' + (kulcs ? '' : 'Add meg a jelszót, hogy lásd a párok haladását.') + '</p>';
    }
    $('kapcsolat').innerHTML = h;
    var km = $('kulcsment');
    if (km) km.onclick = function () { kulcs = $('kulcs').value.trim(); LS.set('segedlet-admin-kulcs', kulcs); frissit(); };
  }

  function rajz() {
    parok.sort(function (a, b) { return String(a.datum || '9999').localeCompare(String(b.datum || '9999')) || String(a.nev).localeCompare(String(b.nev), 'hu'); });
    $('db').textContent = parok.length;
    $('ures').hidden = parok.length > 0;
    $('lista').innerHTML = parok.map(function (p) {
      var hal = p.kesz != null ? p.kesz + ' / ' + (p.osszes || OSSZES) + ' (' + Math.round(p.kesz / (p.osszes || OSSZES) * 100) + '%)' : (vanSzolg ? '—' : 'nincs bekötve');
      return '<tr><td><b>' + esc(p.nev) + '</b></td><td data-l="Esküvő">' + esc(p.datum || '—') + '</td><td class="num" data-l="Haladás">' + hal + '</td><td data-l="Utolsó mentés">' + datumSzoveg(p.mentve) + '</td>' +
        '<td><div style="display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="btn mini p" data-act="uzenet" data-p="' + esc(p.p) + '">Üzenet másolása</button>' +
        '<button class="btn mini" data-act="link" data-p="' + esc(p.p) + '">Link</button>' +
        '<a class="btn mini" href="' + esc(link(p)) + '" target="_blank" rel="noopener">Megnyitás</a>' +
        '<button class="btn mini danger" data-act="torol" data-p="' + esc(p.p) + '">' + (confirmId === p.p ? 'Biztos?' : 'Törlés') + '</button>' +
        '</div></td></tr>';
    }).join('');
  }

  $('letrehoz').onclick = function () {
    var sorok = $('uj').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!sorok.length) { toast('Írj be legalább egy párt'); return; }
    var ujak = sorok.map(function (s) {
      var parts = s.split(';'), nev = parts[0].trim(), d = (parts[1] || '').trim();
      var m = d.match(/(\d{4})[.\-\/ ]+(\d{1,2})[.\-\/ ]+(\d{1,2})/);
      return { p: ujKod(), nev: nev, datum: m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '' };
    });
    parok = parok.concat(ujak); mentes(); rajz(); $('uj').value = '';
    toast(ujak.length + ' link elkészült');
    if (vanSzolg && kulcs) ujak.forEach(function (p) { post({ action: 'register', p: p.p, nev: p.nev, datum: p.datum }).catch(function () {}); });
  };
  $('frissit').onclick = function () { if (!vanSzolg) toast('Előbb kösd be a Google Táblázatot (README)'); else if (!kulcs) toast('Add meg a jelszót'); else frissit(); };
  $('osszesmasol').onclick = function () { copy(parok.map(function (p) { return p.nev + ': ' + link(p); }).join('\n'), 'Az összes link kimásolva'); };
  $('export').onclick = function () {
    var blob = new Blob([JSON.stringify(parok, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'segedlet-parok.json'; document.body.appendChild(a); a.click(); a.remove();
  };
  $('import').onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    f.text().then(function (t) {
      var arr = JSON.parse(t); var n = 0;
      arr.forEach(function (x) { if (x && x.p && !parok.some(function (y) { return y.p === x.p; })) { parok.push(x); n++; } });
      mentes(); rajz(); toast(n + ' pár betöltve');
    }).catch(function () { toast('Ez nem a segédlet mentésfájlja'); });
  };
  $('lista').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var p = parok.filter(function (x) { return x.p === b.getAttribute('data-p'); })[0]; if (!p) return;
    var act = b.getAttribute('data-act');
    if (act === 'uzenet') copy(uzenet(p), 'Üzenet kimásolva – illeszd be e-mailbe vagy Messengerbe');
    else if (act === 'link') copy(link(p), 'Link kimásolva');
    else if (act === 'torol') {
      if (confirmId !== p.p) { confirmId = p.p; rajz(); setTimeout(function () { if (confirmId === p.p) { confirmId = null; rajz(); } }, 4000); return; }
      confirmId = null; parok = parok.filter(function (x) { return x !== p; }); mentes(); rajz();
      if (vanSzolg && kulcs) post({ action: 'remove', p: p.p }).catch(function () {});
      toast('Törölve a listából');
    }
  });

  kapcsolat(); rajz(); frissit();
})();
