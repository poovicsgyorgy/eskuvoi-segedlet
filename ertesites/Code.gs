/**
 * Esküvői segédlet – e-mail értesítések (Google Apps Script)
 *
 * Mit csinál:
 *  - Neked ír, ha egy pár befejez egy fejezetet, vagy az egész segédletet,
 *    illetve ha a pár válaszol a megjegyzésedre.
 *  - A párnak ír, ha megjegyzést hagysz neki az admin oldalon.
 *
 * Az e-maileket a te Gmail-fiókodból küldi. Beállítás: README.md, „Értesítések beállítása”.
 */

var ADMIN_EMAIL = 'eskuvo.popovicsgyorgy@gmail.com';
var FIREBASE_API_KEY = 'AIzaSyA93rr7tUuXiqlkUpBR_B-ZhzEDXD7TEXs';
var FELADO_NEV = 'Popovics György – Esküvői segédlet';

/* ---------- belépési pontok ---------- */

function doGet() { return json({ ok: true, szolgaltatas: 'Esküvői segédlet értesítések' }); }

function doPost(e) {
  var b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json({ ok: false, hiba: 'Hibás kérés' }); }
  var u = ellenoriz(b.token);
  if (!u) return json({ ok: false, hiba: 'Érvénytelen belépés' });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (b.action === 'allapot') return json(allapot(b, u));
    if (b.action === 'megjegyzes') {
      if (u.email !== ADMIN_EMAIL.toLowerCase() || !u.verified) return json({ ok: false, hiba: 'Nincs jogosultság' });
      return json(megjegyzes(b));
    }
    return json({ ok: false, hiba: 'Ismeretlen művelet' });
  } catch (err) {
    return json({ ok: false, hiba: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Egyszer futtasd le kézzel: engedélyezi az e-mail-küldést, és küld egy próba e-mailt. */
function beallitas() {
  MailApp.sendEmail({ to: ADMIN_EMAIL, subject: 'Esküvői segédlet – az értesítések be vannak kapcsolva', name: FELADO_NEV,
    htmlBody: level('Az értesítések működnek', ['Mostantól ide kapod az értesítéseket a párok haladásáról.', 'Ezt az e-mailt a beállítás próbájaként kaptad.'], null, null) });
}

/* ---------- segédek ---------- */

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function ellenoriz(token) {
  if (!token) return null;
  var r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: token }), muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) return null;
  var u = (JSON.parse(r.getContentText()).users || [])[0];
  if (!u || !u.email) return null;
  return { email: String(u.email).toLowerCase(), verified: !!u.emailVerified };
}

function tiszta(s, max) { return String(s == null ? '' : s).slice(0, max || 500); }
function kodOk(k) { return /^[A-Za-z0-9_-]{4,40}$/.test(String(k || '')); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function emailOk(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '')); }

var P = PropertiesService.getScriptProperties();
function olvas(kod) { try { return JSON.parse(P.getProperty('par:' + kod) || 'null'); } catch (e) { return null; } }
function ir(kod, rec) { P.setProperty('par:' + kod, JSON.stringify(rec)); }

function level(cim, bekezdesek, gombSzoveg, gombLink) {
  return '<div style="background:#EAEAE4;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#5B3416">' +
    '<div style="max-width:520px;margin:0 auto;background:#F7F5F0;border:1px solid #DCD6CA;border-radius:16px;padding:24px">' +
    '<div style="font-size:12px;letter-spacing:2px;color:#6B4A2E">ESKÜVŐI SEGÉDLET</div>' +
    '<h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:8px 0 14px">' + esc(cim) + '</h1>' +
    bekezdesek.map(function (p) { return '<p style="font-size:15px;line-height:1.55;margin:0 0 12px">' + p + '</p>'; }).join('') +
    (gombLink ? '<p style="margin:20px 0 0"><a href="' + esc(gombLink) + '" style="display:inline-block;background:#5B3416;color:#F7F3EC;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">' + esc(gombSzoveg) + '</a></p>' : '') +
    '</div></div>';
}

function kuld(to, targy, html) {
  if (!to || (Array.isArray(to) && !to.length)) return false;
  if (MailApp.getRemainingDailyQuota() < 1) return false;
  MailApp.sendEmail({ to: Array.isArray(to) ? to.join(',') : to, subject: targy, htmlBody: html, name: FELADO_NEV, replyTo: ADMIN_EMAIL });
  return true;
}

/* ---------- a pár állapota (a pár alkalmazása küldi) ---------- */

function allapot(b, u) {
  var kod = String(b.p || '');
  if (!kodOk(kod)) return { ok: false, hiba: 'Hibás kód' };
  var rec = olvas(kod) || { emails: [], keszFej: [], mindKesz: false };
  var nev = tiszta(b.nev, 80) || rec.nev || 'Egy pár';
  rec.nev = nev;
  rec.datum = tiszta(b.datum, 10);
  if (b.link && /^https:\/\//.test(b.link)) rec.link = tiszta(b.link, 300);
  if (rec.emails.indexOf(u.email) === -1 && rec.emails.length < 3) rec.emails.push(u.email);
  rec.kesz = Number(b.kesz) || 0;
  rec.osszes = Number(b.osszes) || 0;
  rec.megNem = Number(b.megNem) || 0;
  rec.aktiv = Date.now();

  var most = (Array.isArray(b.keszFejezetek) ? b.keszFejezetek : []).map(function (x) { return tiszta(x, 80); });
  var ujak = most.filter(function (c) { return rec.keszFej.indexOf(c) === -1; });
  rec.keszFej = most;
  ujak.forEach(function (c) {
    kuld(ADMIN_EMAIL, nev + ' befejezte: ' + c,
      level(nev + ' befejezett egy fejezetet', ['A(z) <b>' + esc(c) + '</b> fejezet minden kérdésére válaszoltak.', 'Összesen: ' + rec.kesz + ' / ' + rec.osszes + ' kérdés.'], null, null));
  });
  if (rec.osszes && rec.kesz >= rec.osszes && !rec.mindKesz) {
    rec.mindKesz = true;
    kuld(ADMIN_EMAIL, nev + ' kitöltötte a teljes segédletet',
      level(nev + ' végzett', ['Mind a ' + rec.osszes + ' kérdésre válaszoltak. A válaszokat az admin oldalon, a „Válaszok” gombbal nézheted meg.'], null, null));
  }
  (Array.isArray(b.valaszok) ? b.valaszok.slice(0, 5) : []).forEach(function (v) {
    kuld(ADMIN_EMAIL, nev + ' válaszolt a megjegyzésedre',
      level(nev + ' válaszolt', [
        v.kerdes ? 'Kérdés: <i>' + esc(tiszta(v.kerdes, 300)) + '</i>' : '',
        v.megjegyzes ? 'A megjegyzésed: „' + esc(tiszta(v.megjegyzes, 600)) + '”' : '',
        'A válaszuk: <b>„' + esc(tiszta(v.szoveg, 1500)) + '”</b>'
      ].filter(Boolean), null, null));
  });
  ir(kod, rec);
  return { ok: true };
}

/* ---------- megjegyzés a párnak (az admin oldal küldi) ---------- */

function megjegyzes(b) {
  var kod = String(b.p || '');
  if (!kodOk(kod)) return { ok: false, hiba: 'Hibás kód' };
  var rec = olvas(kod) || { emails: [], keszFej: [] };
  var cimzettek = (Array.isArray(b.cimzettek) ? b.cimzettek : []).concat(rec.emails || [])
    .map(function (e) { return String(e || '').toLowerCase(); })
    .filter(function (e, i, a) { return emailOk(e) && a.indexOf(e) === i; }).slice(0, 3);
  if (!cimzettek.length) return { ok: false, hiba: 'Nincs e-mail-cím' };
  var link = (b.link && /^https:\/\//.test(b.link)) ? b.link : rec.link;
  var ok = kuld(cimzettek, 'Popovics György üzenetet írt az esküvői segédletetekhez',
    level('Új üzenet a ceremóniamestertől', [
      b.kerdes ? 'A következő kérdéshez: <i>' + esc(tiszta(b.kerdes, 300)) + '</i>' : '',
      '„' + esc(tiszta(b.szoveg, 2000)) + '”',
      'Az alkalmazásban válaszolhattok is rá.'
    ].filter(Boolean), 'Megnyitom a segédletet', link));
  return { ok: ok };
}
