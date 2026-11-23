(function () {
  'use strict';
  var C = window.SEGEDLET_CONFIG || {};
  var DATA = window.SEGEDLET || [];
  var CM = C.megszolitas || 'György';
  var CM_NEK = C.megszolitasNek || (CM + 'nek');
  var CM_HOZ = C.megszolitasHoz || (CM + 'höz');
  var CM_TOL = C.megszolitasTol || (CM + 'től');

  /* ---------- segédek ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  var LS = {
    get: function (k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var VALASZ = [
    ['kesz', 'Igen, kész'],
    ['folyamatban', 'Folyamatban'],
    ['meg_nem', 'Még nem'],
    ['nem_rel', 'Nem releváns']
  ];
  var CIMKE = { kesz: 'Kész', folyamatban: 'Folyamatban', meg_nem: 'Még nem', nem_rel: 'Nem releváns' };
  var IC = {
    back: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    lock: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    home: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    list: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg>',
    msg: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
  };

  /* ---------- kérdések felépítése ---------- */
  var FEJ = DATA.map(function (f, fi) {
    var list = [];
    f.reszek.forEach(function (r, ri) {
      r.kerdesek.forEach(function (q, qi) {
        list.push({ id: hash(f.cim + '|' + q), q: q, resz: r.cim, tipp: qi === 0 ? (r.tipp || '') : '', ri: ri, fi: fi });
      });
    });
    return { cim: f.cim, idx: fi, kerdesek: list };
  });
  var OSSZES = FEJ.reduce(function (s, f) { return s + f.kerdesek.length; }, 0);

  /* ---------- pár azonosítása ---------- */
  var params = new URLSearchParams(location.search);
  var kod = (params.get('p') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  var KEY = 'segedlet:' + kod;
  var st = LS.get(KEY) || { nev: '', datum: '', valaszok: {}, kezdve: false, frissitve: 0 };
  if (!st.valaszok) st.valaszok = {};
  if (params.get('n') && !st.nev) st.nev = params.get('n');
  if (params.get('d') && !st.datum) st.datum = params.get('d');

  var ui = { edit: null, syncText: '', scrollTo: null };
  var FBM = !!(C.firebase && C.firebase.apiKey) && kod !== 'minta';
  var fb = null, fbUser = null, fbState = FBM ? 'tolt' : 'kesz', fbHiba = '', unwatch = null, claimTried = false, pendingRender = false;

  /* ---------- mentés ---------- */
  var timer = null, busy = false, again = false, lastSync = 0;
  function save(fields) {
    st.frissitve = Date.now();
    LS.set(KEY, st);
    if (FBM) {
      if (!fb || !fbUser) return;
      var f = Object.assign({}, fields || {}, { kesz: valaszolt(), osszes: OSSZES, frissitve: st.frissitve });
      setSync('Mentés…');
      fb.update(kod, f).then(function () { setSync('Elmentve, ' + CM + ' is látja'); }, function () { setSync('Nem sikerült menteni. Van internet?'); });
      return;
    }
    if (!C.szolgaltatasUrl || kod === 'minta') return;
    clearTimeout(timer);
    timer = setTimeout(push, 1200);
  }
  function sorok() {
    var out = [];
    FEJ.forEach(function (f) {
      f.kerdesek.forEach(function (k) {
        var v = st.valaszok[k.id];
        out.push([f.cim, k.resz, k.q, v ? CIMKE[v.a] : '', v ? (v.n || '') : '']);
      });
    });
    return out;
  }
  function push() {
    if (busy) { again = true; return; }
    busy = true; setSync('Mentés…');
    var body = { action: 'save', p: kod, nev: st.nev, datum: st.datum, data: st, kesz: valaszolt(), osszes: OSSZES, sorok: sorok() };
    fetch(C.szolgaltatasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j || !j.ok) throw new Error('hiba'); lastSync = Date.now(); setSync('Elmentve, ' + CM + ' is látja'); })
      .catch(function () { setSync('Most nem sikerült elküldeni – a telefonodon megvan, később újra próbálom'); })
      .then(function () { busy = false; if (again) { again = false; push(); } });
  }
  function load() {
    if (FBM || !C.szolgaltatasUrl || !kod || kod === 'minta') return;
    var ctl = new AbortController(); var t = setTimeout(function () { ctl.abort(); }, 10000);
    fetch(C.szolgaltatasUrl + '?action=load&p=' + encodeURIComponent(kod), { signal: ctl.signal })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        clearTimeout(t);
        if (j && j.ok && j.data && (j.data.frissitve || 0) > (st.frissitve || 0)) {
          st = j.data; if (!st.valaszok) st.valaszok = {}; LS.set(KEY, st); render();
        } else if (j && j.ok && !j.data && valaszolt() > 0) { push(); }
        setSync('Szinkronban');
      })
      .catch(function () { clearTimeout(t); setSync('Offline – a válaszaid a telefonodon mentődnek'); });
  }
  function setSync(t) { ui.syncText = t; var el = document.getElementById('sync'); if (el) el.textContent = t; }

  /* ---------- számolás ---------- */
  function valaszolt(f) {
    var list = f ? f.kerdesek : FEJ.reduce(function (a, x) { return a.concat(x.kerdesek); }, []);
    return list.filter(function (k) { return st.valaszok[k.id]; }).length;
  }
  function aktualis(f) { for (var i = 0; i < f.kerdesek.length; i++) if (!st.valaszok[f.kerdesek[i].id]) return i; return f.kerdesek.length; }
  function fejezetNyitva(fi) {
    if (!C.fejezetekSorban || fi === 0) return true;
    var e = FEJ[fi - 1]; return aktualis(e) >= e.kerdesek.length;
  }
  function napok() {
    if (!st.datum) return null;
    var d = new Date(st.datum + 'T12:00:00'); if (isNaN(d)) return null;
    return Math.ceil((d - new Date()) / 86400000);
  }

  /* ---------- nézetek ---------- */
  var deco = function (which) {
    var m = { tl: 'virag-bal-fent', tr: 'virag-jobb-fent', bl: 'virag-bal-lent', br: 'virag-jobb-lent' };
    return which.map(function (w) { return '<img class="deco ' + w + '" src="img/' + m[w] + '.png" alt="">'; }).join('');
  };
  function nav(active) {
    var items = [['kezdolap', 'Kezdőlap', IC.home], ['osszesito', 'Összesítő', IC.list]];
    var h = items.map(function (x) { return '<a href="#' + x[0] + '"' + (active === x[0] ? ' aria-current="page"' : '') + '>' + x[2] + x[1] + '</a>'; }).join('');
    h += '<a href="mailto:' + esc(C.email || '') + '?subject=' + encodeURIComponent('Kérdés az esküvői segédletről – ' + (st.nev || '')) + '">' + IC.msg + 'Kérdezz</a>';
    return '<nav class="tabs" aria-label="Fő menü"><div>' + h + '</div></nav>';
  }

  function vNincsKod() {
    return deco(['tl', 'tr', 'bl', 'br']) + '<div class="cover"><div class="disp big">ESKÜVŐI<br>SEGÉDLET</div><div class="rule"></div>' +
      '<p class="small" style="max-width:320px">Ehhez az oldalhoz saját link kell. Kérd el ' + esc(C.ceremoniamester || 'a ceremóniamestertől') + ', hogy elküldje a ti linketeket.</p>' +
      '<a class="btn" href="?p=minta&n=' + encodeURIComponent('Minta pár') + '">Megnézem a mintát</a></div>';
  }

  function vBelepes() {
    return deco(['tl', 'tr', 'bl', 'br']) + '<div class="cover">' +
      '<div class="disp big" style="font-size:clamp(40px,12vw,52px)">ESKÜVŐI<br>SEGÉDLET</div><div class="rule"></div>' +
      (params.get('n') ? '<div class="disp" style="font-size:26px">' + esc(params.get('n')) + '</div>' : '') +
      '<p class="small" style="max-width:330px;margin:0">Lépjetek be, hogy a válaszaitok elmentődjenek, és bármelyik telefonon vagy gépen folytatni tudjátok. A pár mindkét tagja beléphet a saját fiókjával.</p>' +
      '<div id="login" style="width:100%;display:flex;justify-content:center"></div></div>';
  }
  function vUzenet(cim, szoveg, extra) {
    return deco(['tl', 'tr', 'bl', 'br']) + '<div class="cover"><div class="disp" style="font-size:34px;line-height:1.1">' + esc(cim) + '</div><div class="rule"></div>' +
      '<p class="small" style="max-width:330px;margin:0">' + szoveg + '</p>' + (extra || '') + '</div>';
  }
  function kilepGomb() { return fbUser ? '<button class="btn mini" style="border:none;text-decoration:underline;align-self:center" data-act="logout">Kijelentkezés (' + esc(fbUser.email || '') + ')</button>' : ''; }

  function vNyito() {
    return deco(['tl', 'tr', 'bl', 'br']) + '<div class="cover">' +
      '<div class="disp big">ESKÜVŐI<br>SEGÉDLET</div><div class="rule"></div>' +
      '<div><div class="spaced">KÉSZÍTETTE:</div><div class="spaced">' + esc((C.ceremoniamester || '').toUpperCase()) + '</div></div>' +
      '<div style="width:100%;max-width:340px;display:flex;flex-direction:column;gap:12px;margin-top:18px;text-align:left">' +
      '<label class="f">A nevetek<input id="f-nev" value="' + esc(st.nev) + '" placeholder="pl. Réka &amp; Bence" autocomplete="off"></label>' +
      '<label class="f">Az esküvő napja<input id="f-datum" type="date" value="' + esc(st.datum) + '"></label>' +
      '<button class="btn p w" data-act="start">Kezdjük</button>' +
      '<p class="small center" style="margin:0">' + OSSZES + ' kérdés, ' + FEJ.length + ' fejezetben. A kérdések egyenként nyílnak meg, bármikor abbahagyhatjátok és folytathatjátok.</p>' +
      '</div></div>';
  }

  function vKezdolap() {
    var v = valaszolt(), pct = Math.round(v / OSSZES * 100), n = napok();
    var h = deco(['tr']) + '<main>';
    h += '<div style="padding-right:96px"><div class="eyebrow">ESKÜVŐI SEGÉDLET</div><div class="disp" style="font-size:36px;line-height:1.05">' + esc(st.nev || 'Üdv!') + '</div></div>';
    h += '<div class="card" style="display:flex;gap:18px;align-items:center"><div class="ring" style="background:conic-gradient(var(--ink) 0 ' + pct + '%, #E4DDD0 ' + pct + '% 100%)"><div><span class="disp" style="font-size:28px;line-height:1">' + pct + '%</span><span class="small" style="font-size:11px;font-weight:600">kész</span></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:4px">' + (n != null && n >= 0 ? '<div class="disp" style="font-size:30px;line-height:1">' + n + ' nap</div><div class="small">van hátra a nagy napig</div>' : '') +
      '<div style="font-size:14px;font-weight:600">' + v + ' / ' + OSSZES + ' kérdés megválaszolva</div></div></div>';
    var folyt = FEJ.filter(function (f) { var a = aktualis(f); return a > 0 && a < f.kerdesek.length; })[0] || FEJ.filter(function (f, i) { return aktualis(f) < f.kerdesek.length && fejezetNyitva(i); })[0];
    if (folyt) h += '<a class="btn p w" href="#fejezet-' + folyt.idx + '">Folytatás: ' + esc(folyt.cim) + '</a>';
    h += '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px"><span class="eyebrow">FEJEZETEK</span><span class="small">' + FEJ.length + ' téma</span></div>';
    h += FEJ.map(function (f, i) {
      var d = valaszolt(f), t = f.kerdesek.length, open = fejezetNyitva(i);
      var inner = '<span class="row"><span class="nm">' + esc(f.cim) + '</span><span class="ct">' + (open ? d + ' / ' + t : 'Zárva') + '</span></span><span class="bar"><i style="width:' + Math.round(d / t * 100) + '%;background:' + (d === t ? 'var(--sage)' : 'var(--gold)') + '"></i></span>';
      return open ? '<a class="chap" href="#fejezet-' + i + '">' + inner + '</a>' : '<div class="chap locked" aria-disabled="true">' + inner + '</div>';
    }).join('');
    h += '<p class="sync" id="sync">' + esc(ui.syncText) + '</p>' + kilepGomb() + '</main>' + nav('kezdolap');
    return h;
  }

  function vFejezet(fi) {
    var f = FEJ[fi]; if (!f || !fejezetNyitva(fi)) { location.hash = 'kezdolap'; return ''; }
    var cur = aktualis(f), t = f.kerdesek.length;
    var h = deco(['tl', 'tr']).replace(/class="deco /g, 'class="deco sm ') + '<a class="icon-btn" href="#kezdolap" aria-label="Vissza a kezdőlapra">' + IC.back + '</a><main>';
    h += '<h1 class="disp title">' + esc(f.cim).replace(' &amp; ', ' &amp;<br>') + '</h1>';
    h += '<div style="width:220px;margin:0 auto;display:flex;flex-direction:column;gap:6px;align-items:center"><span class="small" style="font-weight:600">' + Math.min(cur, t) + ' / ' + t + ' kérdés</span><span class="bar" style="width:100%"><i style="width:' + Math.round(Math.min(cur, t) / t * 100) + '%"></i></span></div>';
    var lastSec = -1;
    f.kerdesek.forEach(function (k, i) {
      if (i > cur) return;
      if (k.ri !== lastSec) { lastSec = k.ri; h += '<div class="sec">' + esc(k.resz) + '</div>'; }
      var v = st.valaszok[k.id];
      if (i < cur && ui.edit !== k.id) {
        h += '<button class="done" data-act="edit" data-id="' + k.id + '" aria-label="' + (i + 1) + '. kérdés módosítása"><span class="n">' + (i + 1) + '.</span><span class="q">' + esc(k.q) + (v && v.n ? '<span class="nt">' + esc(v.n) + '</span>' : '') + '</span><span class="chip a-' + v.a + '">' + CIMKE[v.a] + '</span></button>';
      } else {
        if (k.tipp && i === cur) h += '<div class="tip"><b>' + esc(CM.toUpperCase()) + ' TANÁCSA</b><p>' + esc(k.tipp) + '</p></div>';
        var editing = i < cur;
        h += '<section class="cur" id="cur"><span class="lab">' + (editing ? 'VÁLASZ MÓDOSÍTÁSA · ' : '') + (i + 1) + '. KÉRDÉS</span><div class="q">' + esc(k.q) + '</div>' +
          '<div class="opts">' + VALASZ.map(function (o) { return '<button class="opt" data-act="answer" data-id="' + k.id + '" data-a="' + o[0] + '" aria-pressed="' + (v && v.a === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
          '<label class="f">Jegyzet (nem kötelező)<textarea id="note-' + k.id + '" placeholder="Pl. ki intézi, mikorra, mi a kérdésetek…">' + esc(v ? v.n : '') + '</textarea></label>' +
          (editing ? '<button class="btn" data-act="canceledit">Mégse</button>' : '') + '</section>';
      }
    });
    if (cur < t - 1) {
      h += '<div class="lock"><span class="ic">' + IC.lock + '</span><span><b style="display:block;font-size:15px">Még ' + (t - cur - 1) + ' kérdés vár</b><span class="small">A következő kérdés akkor nyílik meg, ha erre válaszoltatok.</span></span></div>';
    } else if (cur >= t) {
      var next = FEJ[fi + 1];
      h += '<div class="fin"><div class="disp" style="font-size:30px">Fejezet kész!</div>' +
        (next ? '<div style="color:#EADFCF;font-size:14px">Jöhet a következő téma: ' + esc(next.cim) + '</div><a class="btn" href="#fejezet-' + (fi + 1) + '">Tovább</a>' : '<div style="color:#EADFCF;font-size:14px">Ez volt az utolsó fejezet. Nézzétek meg az összesítőt!</div><a class="btn" href="#osszesito">Összesítő</a>') + '</div>';
    }
    h += '<p class="sync" id="sync">' + esc(ui.syncText) + '</p></main>' + nav('');
    return h;
  }

  function osszefoglalo() {
    var lines = ['Esküvői segédlet – ' + (st.nev || '') + (st.datum ? ' (' + st.datum + ')' : ''), 'Megválaszolva: ' + valaszolt() + ' / ' + OSSZES, ''];
    FEJ.forEach(function (f) {
      var nyitott = f.kerdesek.filter(function (k) { var v = st.valaszok[k.id]; return v && (v.a === 'folyamatban' || v.a === 'meg_nem'); });
      var jegyzet = f.kerdesek.filter(function (k) { var v = st.valaszok[k.id]; return v && v.n; });
      if (!nyitott.length && !jegyzet.length) return;
      lines.push('■ ' + f.cim + ' (' + valaszolt(f) + '/' + f.kerdesek.length + ')');
      f.kerdesek.forEach(function (k) { var v = st.valaszok[k.id]; if (v && (v.a === 'folyamatban' || v.a === 'meg_nem' || v.n)) lines.push('  – ' + k.q + ' → ' + CIMKE[v.a] + (v.n ? ' | ' + v.n : '')); });
      lines.push('');
    });
    return lines.join('\n');
  }

  function vOsszesito() {
    var cnt = { kesz: 0, folyamatban: 0, meg_nem: 0, nem_rel: 0 };
    FEJ.forEach(function (f) { f.kerdesek.forEach(function (k) { var v = st.valaszok[k.id]; if (v && cnt[v.a] != null) cnt[v.a]++; }); });
    var sz = ui.szuro || 'meg_nem';
    var h = deco(['tl']) + '<main><h1 class="disp title">Összesítő</h1><p class="small center" style="margin:0">Koppints egy gombra, és megmutatjuk, mely kérdéseknél adtátok ezt a választ.</p>';
    h += '<div class="opts szuro" role="group" aria-label="Szűrés válasz szerint">' + VALASZ.map(function (o) {
      return '<button class="opt" data-act="szuro" data-a="' + o[0] + '" aria-pressed="' + (sz === o[0]) + '"><span class="db">' + cnt[o[0]] + '</span>' + o[1] + '</button>';
    }).join('') + '</div>';
    var talalt = 0;
    FEJ.forEach(function (f) {
      var lista = [];
      f.kerdesek.forEach(function (k, i) { var v = st.valaszok[k.id]; if (v && v.a === sz) lista.push({ k: k, v: v, n: i + 1 }); });
      if (!lista.length) return;
      talalt += lista.length;
      h += '<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><a class="disp" style="font-size:22px;text-decoration:none" href="#fejezet-' + f.idx + '">' + esc(f.cim) + '</a><span class="small" style="font-weight:700;white-space:nowrap">' + lista.length + ' kérdés</span></div><ul class="open">' +
        lista.map(function (x) {
          return '<li><button class="olink" data-act="goto" data-id="' + x.k.id + '" data-fi="' + f.idx + '"><span>' + esc(x.k.q) + '</span>' + (x.v.n ? '<span class="nt">' + esc(x.v.n) + '</span>' : '') + '<span class="mod">Válasz módosítása ›</span></button></li>';
        }).join('') + '</ul></div>';
    });
    if (!talalt) h += '<div class="card center"><div class="disp" style="font-size:24px">Nincs ilyen válasz</div><div class="small">' + (sz === 'meg_nem' || sz === 'folyamatban' ? 'Ebben a kategóriában most nincs teendőtök.' : 'Még egyik kérdésnél sem ezt választottátok.') + '</div></div>';
    var hatra = FEJ.map(function (f) { return { f: f, n: f.kerdesek.length - valaszolt(f) }; }).filter(function (x) { return x.n > 0; });
    if (hatra.length) {
      h += '<div class="card"><div style="font-weight:700;margin-bottom:6px">Még előttetek álló kérdések</div>' + hatra.map(function (x) {
        return '<a class="row-link" href="#fejezet-' + x.f.idx + '"><span>' + esc(x.f.cim) + '</span><span class="small" style="font-weight:600;white-space:nowrap">' + x.n + ' kérdés ›</span></a>';
      }).join('') + '</div>';
    }
    if (C.szolgaltatasUrl || FBM) h += '<p class="small center" style="margin:0">A válaszaitok automatikusan eljutnak ' + esc(CM_HOZ) + '.</p>';
    h += '<button class="btn p w" data-act="mail">E-mail küldése ' + esc(CM_NEK) + '</button><button class="btn w" data-act="copy">Összefoglaló másolása</button>';
    h += '<p class="sync" id="sync">' + esc(ui.syncText) + '</p></main>' + nav('osszesito');
    return h;
  }

  /* ---------- megjelenítés ---------- */
  function route() { return (location.hash || '#kezdolap').slice(1); }
  function render() {
    var app = document.getElementById('app'), r = route(), h;
    if (FBM && fbState !== 'kesz') {
      if (fbState === 'tolt') h = vUzenet('Betöltés…', 'Egy pillanat.');
      else if (fbState === 'ki') h = vBelepes();
      else if (fbState === 'hiba') h = vUzenet('Ez a link nem nyílik meg', esc(fbHiba), '<a class="btn" href="mailto:' + esc(C.email || '') + '?subject=' + encodeURIComponent('Segédlet link') + '">Írok ' + esc(CM_NEK) + '</a>' + kilepGomb());
      else if (fbState === 'nincs') h = vUzenet('Esküvői segédlet', 'Ehhez a fiókhoz még nem tartozik segédlet. Nyissátok meg a ' + esc(CM_TOL) + ' kapott saját linketeket.', kilepGomb());
      app.innerHTML = h;
      if (fbState === 'ki') window.segedletLogin(document.getElementById('login'), fb, {});
      return;
    }
    if (!kod) h = vNincsKod();
    else if (!st.kezdve) h = vNyito();
    else if (r.indexOf('fejezet-') === 0) h = vFejezet(parseInt(r.slice(8), 10));
    else if (r === 'osszesito') h = vOsszesito();
    else h = vKezdolap();
    app.innerHTML = h;
    if (ui.scrollTo) { var el = document.getElementById(ui.scrollTo); ui.scrollTo = null; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
  function toast(t) { var el = document.getElementById('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2600); }
  function copy(text) {
    var done = function () { toast('Kimásolva'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Nem sikerült másolni'); } ta.remove(); }
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'start') {
      st.nev = document.getElementById('f-nev').value.trim() || st.nev;
      st.datum = document.getElementById('f-datum').value || st.datum;
      st.kezdve = true; save({ nev: st.nev, datum: st.datum, kezdve: true }); location.hash = 'kezdolap'; render(); window.scrollTo(0, 0);
    } else if (act === 'answer') {
      var id = b.getAttribute('data-id'), note = document.getElementById('note-' + id);
      st.valaszok[id] = { a: b.getAttribute('data-a'), n: note ? note.value.trim() : '', t: Date.now() };
      var wasEdit = ui.edit === id; ui.edit = null; var fld = {}; fld['valaszok.' + id] = st.valaszok[id]; save(fld);
      ui.scrollTo = wasEdit ? null : 'cur'; render();
    } else if (act === 'edit') { ui.edit = b.getAttribute('data-id'); render(); var c = document.getElementById('cur'); if (c) c.scrollIntoView({ block: 'center' }); }
    else if (act === 'canceledit') { ui.edit = null; render(); }
    else if (act === 'copy') copy(osszefoglalo());
    else if (act === 'szuro') { ui.szuro = b.getAttribute('data-a'); render(); }
    else if (act === 'goto') { ui.gotoEdit = b.getAttribute('data-id'); ui.scrollTo = 'cur'; location.hash = 'fejezet-' + b.getAttribute('data-fi'); }
    else if (act === 'logout') { if (fb) fb.logout().then(function () { location.hash = ''; }); }
    else if (act === 'mail') {
      var body = osszefoglalo(); if (body.length > 1800) body = body.slice(0, 1800) + '\n…(a teljes összefoglalót a „Másolás” gombbal tudjátok bemásolni)';
      location.href = 'mailto:' + (C.email || '') + '?subject=' + encodeURIComponent('Esküvői segédlet – ' + (st.nev || '')) + '&body=' + encodeURIComponent(body);
    }
  });
  window.addEventListener('hashchange', function () {
    ui.edit = ui.gotoEdit || null; ui.gotoEdit = null;
    var keep = !!ui.scrollTo;
    if (!keep) window.scrollTo(0, 0);
    render();
  });

  if (!C.szolgaltatasUrl) ui.syncText = 'A válaszaitok ezen a készüléken mentődnek.';
  else if (kod === 'minta') ui.syncText = 'Minta mód – a válaszok csak itt mentődnek.';
  if (FBM) ui.syncText = '';
  render();
  load();
  if (FBM) startFB();

  function startFB() {
    if (!window.SegedletFB) { fbState = 'hiba'; fbHiba = 'Nem sikerült betölteni a belépést. Frissítsd az oldalt.'; render(); return; }
    window.SegedletFB(C.firebase).then(function (api) {
      fb = api;
      fb.onUser(function (u) {
        fbUser = u;
        if (unwatch) { unwatch(); unwatch = null; }
        if (!u) { fbState = 'ki'; render(); return; }
        fbState = 'tolt'; render();
        if (!kod) {
          fb.myCouples().then(function (list) {
            if (list.length) location.replace('?p=' + encodeURIComponent(list[0].p) + '#kezdolap');
            else { fbState = 'nincs'; render(); }
          }, function () { fbState = 'nincs'; render(); });
          return;
        }
        claimTried = false; figyel();
      });
    }, function () { fbState = 'hiba'; fbHiba = 'Nem sikerült betölteni a belépést. Van internet? Frissítsd az oldalt.'; render(); });
  }
  function figyel() {
    unwatch = fb.watch(kod, function (data) {
      if (!data) { fbState = 'hiba'; fbHiba = 'Ez a link érvénytelen vagy törölve lett.'; render(); return; }
      st = { nev: data.nev || '', datum: data.datum || '', kezdve: !!data.kezdve, valaszok: data.valaszok || {}, frissitve: data.frissitve || 0 };
      LS.set(KEY, st);
      fbState = 'kesz';
      var a = document.activeElement;
      if (a && /^(TEXTAREA|INPUT)$/.test(a.tagName) && document.getElementById('app').contains(a)) { pendingRender = true; return; }
      render();
    }, function () {
      if (unwatch) { unwatch(); unwatch = null; }
      if (claimTried) { fbState = 'hiba'; fbHiba = 'Ezt a linket már két fiók használja, vagy érvénytelen. Ha a párod lépett be vele, ő látja. Szólj ' + CM_NEK + ', és újra megnyitja.'; render(); return; }
      claimTried = true;
      fb.claim(kod).then(figyel, function (e) {
        fbState = 'hiba';
        fbHiba = e && e.code === 'not-found' ? 'Ez a link érvénytelen vagy törölve lett.' : 'Ezt a linket már két fiók használja. Ha a párod lépett be vele, ő látja a segédletet. Szólj ' + CM_NEK + ', és újra megnyitja.';
        render();
      });
    });
  }
  document.addEventListener('focusout', function () { if (pendingRender) setTimeout(function () { var a = document.activeElement; if (!(a && /^(TEXTAREA|INPUT)$/.test(a.tagName))) { pendingRender = false; render(); } }, 0); });
})();
