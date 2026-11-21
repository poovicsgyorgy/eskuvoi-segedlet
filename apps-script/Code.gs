/**
 * Esküvői segédlet – Google Táblázat háttér
 *
 * Ide érkeznek a párok válaszai. Minden pár kap egy saját fület
 * (Fejezet | Rész | Kérdés | Válasz | Jegyzet), a "Párok" fülön pedig
 * egy sorban látod mindenki haladását.
 *
 * Beállítás: README.md, "Google Táblázat beállítása" rész.
 */

// Ezt a jelszót írod be az admin oldalon. Változtasd meg valami csak általad ismertre!
var ADMIN_KULCS = 'ide-irj-egy-jelszot';

var PAROK = 'Párok';
var FEJLEC = ['Kód', 'Pár', 'Esküvő napja', 'Kész', 'Összes', 'Haladás', 'Utolsó mentés', 'Létrehozva', 'Adat (ne szerkeszd)'];

function doGet(e) {
  var p = e.parameter || {};
  try {
    if (p.action === 'load') return json(betolt(p.p));
    if (p.action === 'list') return json(p.key === ADMIN_KULCS ? lista() : { ok: false, hiba: 'Hibás jelszó' });
    return json({ ok: true, szolgaltatas: 'Esküvői segédlet' });
  } catch (err) {
    return json({ ok: false, hiba: String(err) });
  }
}

function doPost(e) {
  var b = JSON.parse(e.postData.contents || '{}');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (b.action === 'save') return json(ment(b));
    if (b.action === 'register') return json(b.key === ADMIN_KULCS ? regisztral(b) : { ok: false, hiba: 'Hibás jelszó' });
    if (b.action === 'remove') return json(b.key === ADMIN_KULCS ? torol(b.p) : { ok: false, hiba: 'Hibás jelszó' });
    return json({ ok: false, hiba: 'Ismeretlen művelet' });
  } catch (err) {
    return json({ ok: false, hiba: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function lap() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PAROK);
  if (!sh) {
    sh = ss.insertSheet(PAROK, 0);
    sh.appendRow(FEJLEC);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, FEJLEC.length).setFontWeight('bold');
  }
  return sh;
}

function tisztaKod(k) { return String(k || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40); }

function sorKeres(sh, kod) {
  var n = sh.getLastRow();
  if (n < 2) return 0;
  var kodok = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < kodok.length; i++) if (String(kodok[i][0]) === kod) return i + 2;
  return 0;
}

function betolt(k) {
  var kod = tisztaKod(k);
  if (!kod) return { ok: false, hiba: 'Hiányzó kód' };
  var sh = lap(), r = sorKeres(sh, kod);
  if (!r) return { ok: true, data: null };
  var raw = sh.getRange(r, 9).getValue();
  var data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
  if (data && !data.nev) data.nev = sh.getRange(r, 2).getValue();
  return { ok: true, data: data, nev: sh.getRange(r, 2).getValue() };
}

function ment(b) {
  var kod = tisztaKod(b.p);
  if (!kod) return { ok: false, hiba: 'Hiányzó kód' };
  var sh = lap(), r = sorKeres(sh, kod), most = new Date();
  var nev = String(b.nev || '').slice(0, 80);
  var kesz = Number(b.kesz) || 0, osszes = Number(b.osszes) || 0;
  var adat = JSON.stringify(b.data || {});
  if (adat.length > 45000) return { ok: false, hiba: 'Túl hosszú adat' };
  var sor = [kod, nev, b.datum || '', kesz, osszes, osszes ? Math.round(kesz / osszes * 100) + '%' : '', most, null, adat];
  if (r) {
    var regi = sh.getRange(r, 1, 1, FEJLEC.length).getValues()[0];
    sor[7] = regi[7] || most;
    if (!nev) sor[1] = regi[1];
    sh.getRange(r, 1, 1, FEJLEC.length).setValues([sor]);
  } else {
    sor[7] = most;
    sh.appendRow(sor);
  }
  parLap(kod, sor[1], b.sorok || []);
  return { ok: true };
}

function parLap(kod, nev, sorok) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cim = (String(nev || 'Pár').replace(/[\[\]\*\?\/\\:]/g, ' ').slice(0, 60) + ' (' + kod.slice(0, 6) + ')').trim();
  var sh = null;
  ss.getSheets().forEach(function (s) { if (s.getName().indexOf('(' + kod.slice(0, 6) + ')') !== -1) sh = s; });
  if (!sh) sh = ss.insertSheet(cim);
  else if (sh.getName() !== cim) { try { sh.setName(cim); } catch (e) {} }
  sh.clearContents();
  var adat = [['Fejezet', 'Rész', 'Kérdés', 'Válasz', 'Jegyzet']].concat(
    sorok.map(function (s) { return [s[0], s[1], s[2], s[3], s[4]].map(function (x) { return String(x || '').slice(0, 2000); }); })
  );
  sh.getRange(1, 1, adat.length, 5).setValues(adat);
  sh.getRange(1, 1, 1, 5).setFontWeight('bold');
  sh.setFrozenRows(1);
}

function regisztral(b) {
  var kod = tisztaKod(b.p);
  if (!kod) return { ok: false, hiba: 'Hiányzó kód' };
  var sh = lap(), r = sorKeres(sh, kod);
  if (r) {
    sh.getRange(r, 2).setValue(String(b.nev || '').slice(0, 80));
    sh.getRange(r, 3).setValue(b.datum || '');
  } else {
    sh.appendRow([kod, String(b.nev || '').slice(0, 80), b.datum || '', 0, '', '', '', new Date(), '']);
  }
  return { ok: true };
}

function torol(k) {
  var kod = tisztaKod(k), sh = lap(), r = sorKeres(sh, kod);
  if (r) sh.deleteRow(r);
  return { ok: true };
}

function lista() {
  var sh = lap(), n = sh.getLastRow();
  if (n < 2) return { ok: true, parok: [] };
  var v = sh.getRange(2, 1, n - 1, 8).getValues();
  return {
    ok: true,
    parok: v.map(function (r) {
      return {
        p: String(r[0]), nev: r[1], datum: r[2] instanceof Date ? Utilities.formatDate(r[2], 'Europe/Budapest', 'yyyy-MM-dd') : String(r[2] || ''),
        kesz: Number(r[3]) || 0, osszes: Number(r[4]) || 0,
        mentve: r[6] instanceof Date ? r[6].toISOString() : '', letrehozva: r[7] instanceof Date ? r[7].toISOString() : ''
      };
    })
  };
}
