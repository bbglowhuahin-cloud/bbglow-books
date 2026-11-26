// BB Glow Books — จุดเริ่มแอป
import { initStore, store, DEMO, COLLS } from './store.js';
import { S, ACTIONS, setRender, nav, closeModal, openModal, modalEl, formData, reg } from './core.js';
import { DEFAULT_SETTINGS, ROLES } from './model.js';
import { esc, toast } from './util.js';
import * as dashboard from './views/dashboard.js';
import * as receipts from './views/receipts.js';
import * as expenses from './views/expenses.js';
import * as contacts from './views/contacts.js';
import * as finance from './views/finance.js';
import * as recon from './views/recon.js';
import * as reports from './views/reports.js';
import * as settings from './views/settings.js';

const VIEWS = { dashboard, receipts, expenses, contacts, finance, recon, reports, settings };
const NAV = [
  ['dashboard', '🏠', 'หน้าหลัก'], ['receipts', '🧾', 'ใบเสร็จ'], ['expenses', '💸', 'รายจ่าย'], ['finance', '🏦', 'การเงิน'],
  ['recon', '🔁', 'กระทบยอด'], ['contacts', '👥', 'ผู้ติดต่อ'], ['reports', '📊', 'รายงาน'], ['settings', '⚙️', 'ตั้งค่า'],
];
const MOBILE_NAV = ['dashboard', 'receipts', 'expenses', 'finance', 'reports'];
const root = document.getElementById('root');

function shell() {
  const r = S.route;
  const links = NAV.map(([k, ic, t]) => `<a href="#/${k}" class="${r === k ? 'active' : ''}"><span class="ic">${ic}</span>${t}</a>`).join('');
  const mob = NAV.filter(([k]) => MOBILE_NAV.includes(k)).map(([k, ic, t]) => `<a href="#/${k}" class="${r === k ? 'active' : ''}"><span class="ic">${ic}</span>${t}</a>`).join('')
    + `<a href="#/settings" class="${['settings', 'recon', 'contacts'].includes(r) ? 'active' : ''}"><span class="ic">⋯</span>อื่น ๆ</a>`;
  return `<div id="app">
    <aside class="side">
      <div class="brand">BB <span>GLOW</span> <small>Books · ระบบบัญชี บีบี โกลว์ หัวหิน</small></div>
      <nav class="nav">${links}</nav>
      <div class="foot"><b>${esc(S.userLabel)}</b>${ROLES[S.role] || ''}${DEMO ? ' · <span style="color:#F3DDA8">โหมดทดลอง</span>' : ''}<br><a href="#" data-act="logout" style="color:#F3DDA8">ออกจากระบบ</a></div>
    </aside>
    <main class="main" id="view"></main>
    <nav class="bottomnav">${mob}</nav>
  </div>`;
}

function render() {
  if (!S.ready || !S.role) return;
  if (!document.getElementById('app')) root.innerHTML = shell();
  else { document.querySelectorAll('.nav a, .bottomnav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#/' + S.route)); }
  const v = VIEWS[S.route] || dashboard;
  try { document.getElementById('view').innerHTML = v.render(); if (v.after) v.after(); }
  catch (err) { console.error(err); document.getElementById('view').innerHTML = `<div class="alert red">หน้านี้แสดงผลไม่ได้: ${esc(err.message)}</div>`; }
}
setRender(render);

function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/');
  S.route = VIEWS[h[0]] ? h[0] : 'dashboard'; S.param = h.slice(1).join('/');
  render(); window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

/* ---------- event delegation ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACTIONS[el.dataset.act]; if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('change', e => { const el = e.target.closest('[data-on]'); if (el && ACTIONS[el.dataset.on]) ACTIONS[el.dataset.on](el, e); });
document.addEventListener('input', e => { const el = e.target.closest('[data-input]'); if (el && ACTIONS[el.dataset.input]) ACTIONS[el.dataset.input](el, e); });
document.addEventListener('submit', e => { const f = e.target.closest('form[data-submit]'); if (f && ACTIONS[f.dataset.submit]) { e.preventDefault(); ACTIONS[f.dataset.submit](f, e); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- login ---------- */
function loginScreen(msg = '') {
  const st = S.settings || DEFAULT_SETTINGS;
  const roles = Object.entries(ROLES).map(([k, v]) => `<button type="button" data-role="${k}">${v}</button>`).join('');
  root.innerHTML = `<div class="login"><div class="box">
    <div class="logo">BB <span>GLOW</span></div>
    <p class="center muted small" style="margin-bottom:6px">ระบบบัญชี บีบี โกลว์ หัวหิน${DEMO ? ' · โหมดทดลอง (ข้อมูลสมมติ)' : ''}</p>
    ${msg ? `<div class="alert red">${esc(msg)}</div>` : ''}
    ${st.requireAuth && !DEMO ? `
      <form id="loginForm"><div class="field"><label class="f">อีเมล</label><input name="email" type="email" required></div>
      <div class="field"><label class="f">รหัสผ่าน</label><input name="pw" type="password" required></div>
      <button class="btn btn-gold" style="width:100%">เข้าสู่ระบบ</button></form>`
      : `<p class="small muted">เลือกผู้ใช้งาน</p><div class="roles">${roles}</div>
      <div class="field hide" id="pinBox"><label class="f">รหัส PIN</label><input id="pin" type="password" inputmode="numeric" placeholder="••••"></div>
      <button class="btn btn-gold" id="enterBtn" style="width:100%" disabled>เข้าใช้งาน</button>`}
  </div></div>`;
  let role = null;
  root.querySelectorAll('[data-role]').forEach(b => b.onclick = () => {
    role = b.dataset.role; root.querySelectorAll('[data-role]').forEach(x => x.classList.toggle('on', x === b));
    const needPin = !!(st.pins && st.pins[role]);
    document.getElementById('pinBox').classList.toggle('hide', !needPin);
    document.getElementById('enterBtn').disabled = false;
  });
  const enter = root.querySelector('#enterBtn');
  if (enter) enter.onclick = () => {
    const needPin = st.pins && st.pins[role];
    if (needPin && document.getElementById('pin').value !== String(needPin)) return toast('PIN ไม่ถูกต้อง');
    S.role = role; S.userLabel = ROLES[role]; sessionStorage.setItem('bbbooks:role', role); start();
  };
  const form = root.querySelector('#loginForm');
  if (form) form.onsubmit = async e => {
    e.preventDefault(); const d = formData(form);
    try { await store.auth().signIn(d.email, d.pw); } catch (err) { loginScreen('เข้าสู่ระบบไม่สำเร็จ: ' + err.message); }
  };
}
reg({
  logout() { sessionStorage.removeItem('bbbooks:role'); S.role = null; S.user = null; store.auth().signOut().catch(() => {}); root.innerHTML = ''; loginScreen(); },
});

/* ---------- เริ่มทำงาน ---------- */
function start() {
  if (!document.getElementById('app')) root.innerHTML = shell();
  S.ready = true; route();
}

async function boot() {
  await initStore();
  // ตั้งค่า
  await new Promise(res => {
    let first = true;
    store.listen('acc_settings', docs => {
      const m = docs.find(d => d.id === 'main');
      S.settings = m ? { ...DEFAULT_SETTINGS, ...m, company: { ...DEFAULT_SETTINGS.company, ...(m.company || {}) }, opening: { ...DEFAULT_SETTINGS.opening, ...(m.opening || {}), balances: { ...DEFAULT_SETTINGS.opening.balances, ...((m.opening || {}).balances || {}) } }, director: { ...DEFAULT_SETTINGS.director, ...(m.director || {}) } } : { ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), _unsaved: true };
      if (first) { first = false; res(); } else if (S.ready) render();
    });
  });
  const sorters = { acc_receipts: (a, b) => b.date > a.date ? 1 : -1, acc_expenses: (a, b) => b.date > a.date ? 1 : b.date < a.date ? -1 : (b.no > a.no ? 1 : -1), acc_transfers: (a, b) => b.date > a.date ? 1 : -1, acc_statements: (a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : (a.time > b.time ? 1 : -1), acc_contacts: (a, b) => a.name.localeCompare(b.name, 'th') };
  const map = { acc_receipts: 'receipts', acc_expenses: 'expenses', acc_contacts: 'contacts', acc_transfers: 'transfers', acc_statements: 'statements' };
  Object.entries(map).forEach(([coll, k]) => store.listen(coll, docs => { S[k] = docs.sort(sorters[coll]); if (S.ready) render(); }));

  if (S.settings.requireAuth && !DEMO) {
    store.auth().onChange(u => {
      if (!u) { S.role = null; loginScreen(); return; }
      const role = (S.settings.users || {})[u.email];
      if (!role) { store.auth().signOut(); loginScreen('อีเมลนี้ยังไม่ได้รับสิทธิ์ ให้เจ้าของเพิ่มในตั้งค่า > ผู้ใช้'); return; }
      S.user = u; S.role = role; S.userLabel = u.email; start();
    });
  } else {
    const saved = sessionStorage.getItem('bbbooks:role');
    if (saved && ROLES[saved]) { S.role = saved; S.userLabel = ROLES[saved]; start(); } else loginScreen();
  }
}
boot().catch(err => { console.error(err); root.innerHTML = `<div class="login"><div class="box"><div class="alert red">เปิดระบบไม่ได้: ${esc(err.message)}</div><p class="small muted">ตรวจอินเทอร์เน็ต หรือเปิดโหมดทดลองด้วย ?demo=1</p></div></div>`; });
