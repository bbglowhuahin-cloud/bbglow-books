// โครงข้อมูล ค่าตั้งต้น และการคำนวณ
import { round2, sum, monthKey, groupBy, pad } from './util.js';

export const CHANNELS = [
  { id: 'CSH001', name: 'เงินสด', short: 'เงินสด', type: 'cash' },
  { id: 'BSV001', name: 'กสิกร บัญชีรับ (…1753)', short: 'กสิกร รับ', type: 'bank', mask: 'X1753' },
  { id: 'BSV002', name: 'กสิกร บัญชีจ่าย (…0442)', short: 'กสิกร จ่าย', type: 'bank', mask: 'X0442' },
  { id: 'DIR', name: 'เงินกู้ยืมกรรมการ (อาจารย์)', short: 'กรรมการ', type: 'director' },
];
export const chan = id => CHANNELS.find(c => c.id === id) || { id, name: id, short: id, type: '?' };
export const PAY_CHANNELS = CHANNELS; // ใช้ได้ทุกช่องรวมกรรมการ

export const CATEGORIES = [
  { code: '510104', name: 'ต้นทุนการให้บริการ (ค่ามือช่าง/วัตถุดิบ)', group: 'ต้นทุน' },
  { code: '510103', name: 'ซื้อสินค้าเพื่อขาย (homecare)', group: 'ต้นทุน' },
  { code: '530101', name: 'เงินเดือน ค่าจ้าง', group: 'บุคลากร' },
  { code: '530116', name: 'ค่ามือ ค่าล่วงเวลา ค่าคอม', group: 'บุคลากร' },
  { code: '530117', name: 'เงินเดือนกรรมการ', group: 'บุคลากร' },
  { code: '530104', name: 'ประกันสังคม', group: 'บุคลากร' },
  { code: '530108', name: 'สวัสดิการอาหาร เครื่องดื่ม', group: 'บุคลากร' },
  { code: '520206', name: 'ค่าโฆษณา (บูสต์โพสต์/สื่อ)', group: 'การตลาด' },
  { code: '520210', name: 'ค่าจ้างผลิตสื่อโฆษณา', group: 'การตลาด' },
  { code: '520307', name: 'ค่ารับรอง', group: 'การตลาด' },
  { code: '520304', name: 'ค่าที่พัก/เดินทาง', group: 'การตลาด' },
  { code: '530201', name: 'ค่าเช่าสำนักงาน', group: 'สถานที่' },
  { code: '530202', name: 'ค่าส่วนกลาง', group: 'สถานที่' },
  { code: '530307', name: 'ค่าน้ำ ค่าไฟ', group: 'สถานที่' },
  { code: '530210', name: 'ค่ารักษาความสะอาด/ซักรีด', group: 'สถานที่' },
  { code: '530211', name: 'ค่าซ่อมแซม', group: 'สถานที่' },
  { code: '530206', name: 'เครื่องเขียน วัสดุสิ้นเปลือง', group: 'สำนักงาน' },
  { code: '530303', name: 'ค่าโทรศัพท์/อินเทอร์เน็ต', group: 'สำนักงาน' },
  { code: '530306', name: 'ค่าบริการคลาวด์/ซอฟต์แวร์', group: 'สำนักงาน' },
  { code: '530401', name: 'ค่าบริการบัญชี', group: 'สำนักงาน' },
  { code: '530504', name: 'ค่าธรรมเนียม/ค่าขนส่ง', group: 'สำนักงาน' },
  { code: '530509', name: 'อากรแสตมป์/ค่าปรับ/ภาษีอื่น', group: 'สำนักงาน' },
  { code: '540101', name: 'ค่าใช้จ่ายอื่น', group: 'อื่น' },
  { code: '124106', name: 'ซื้อสินทรัพย์: อุปกรณ์สำนักงาน', group: 'สินทรัพย์ (ไม่ใช่ค่าใช้จ่าย)' },
  { code: '124107', name: 'ซื้อสินทรัพย์: เครื่องตกแต่ง', group: 'สินทรัพย์ (ไม่ใช่ค่าใช้จ่าย)' },
  { code: '215200', name: 'นำส่ง ภ.ง.ด.3/53 ให้สรรพากร', group: 'ชำระหนี้สิน (ไม่ใช่ค่าใช้จ่าย)' },
  { code: '215501', name: 'นำส่งประกันสังคม (ส่วนที่หักจากพนักงาน)', group: 'ชำระหนี้สิน (ไม่ใช่ค่าใช้จ่าย)' },
];
export const cat = code => CATEGORIES.find(c => c.code === code) || { code, name: code || 'ไม่ระบุ', group: 'อื่น' };
export const isExpenseCat = code => /^5/.test(code || '');

export const WHT_RATES = [0, 1, 2, 3, 5];

export const DEFAULT_SETTINGS = {
  id: 'main',
  company: { name: 'บริษัท บีบี โกลว์ หัวหิน จำกัด', taxId: '', address: '11/48 ซ.หมู่บ้านสมอโพรง ต.หัวหิน อ.หัวหิน จ.ประจวบคีรีขันธ์ 77110', phone: '' },
  fiscalStartMonth: 10,
  opening: {
    date: '2026-10-01', balances: { CSH001: 1021319.84, BSV001: 0, BSV002: 29536, DIR: 0 }, cashConfirmed: false, note: '',
    // ยอดยกมาอื่นในงบดุล (จากงบทดลอง PEAK 30 ก.ย. 69) ใช้สร้างรายการยกมาในสมุดรายวัน
    bs: { inventory: 129278.30, equipment: 21220.55, furniture: 19000, accumDep: 0, payables: 64220, pnd3: 1155, pnd53: 4298.41, sso: 0, capital: 1000000, retained: 173638.41 },
  },
  director: { name: '', keywords: [] }, // ตั้งค่าจริงในหน้า ตั้งค่า (เก็บใน Firestore ไม่อยู่ในโค้ด)
  posSyncFrom: '2026-10-01',
  posLastSync: null,
  requireAuth: false,
  users: {},            // email → role
  pins: {},             // role → pin (ถ้าตั้ง)
  lockedThrough: '',    // ปิดงวดถึงเดือน YYYY-MM (เฟส 2)
};

export const ROLES = { owner: 'เจ้าของ', keyer: 'ผู้คีย์ (เจต)', auditor: 'สำนักงานบัญชี (ดูอย่างเดียว)' };
export function can(role, action) {
  if (role === 'owner') return true;
  if (role === 'keyer') return ['add', 'edit', 'sync', 'recon'].includes(action);
  return false; // auditor
}

/* ---------- ยอดคงเหลือแต่ละช่องทาง ---------- */
export function balances(S, upto = null) {
  const bal = {}; CHANNELS.forEach(c => bal[c.id] = Number(S.settings?.opening?.balances?.[c.id]) || 0);
  const ok = d => !upto || (d || '') <= upto;
  S.receipts.forEach(r => { if (!r.voided && ok(r.day)) bal[r.channel] = (bal[r.channel] || 0) + r.total; });
  S.expenses.forEach(e => { if (e.status === 'paid' && e.channel && ok(e.paidDate || e.date)) bal[e.channel] = (bal[e.channel] || 0) - e.paid; });
  S.transfers.forEach(t => { if (ok(t.date)) { bal[t.from] = (bal[t.from] || 0) - t.amount; bal[t.to] = (bal[t.to] || 0) + t.amount; } });
  Object.keys(bal).forEach(k => bal[k] = round2(bal[k]));
  return bal; // DIR ติดลบ = บริษัทติดหนี้กรรมการ
}

/* ---------- สมุดช่องทาง (ledger) ---------- */
export function channelLedger(S, ch, from, to) {
  const rows = [];
  S.receipts.forEach(r => { if (!r.voided && r.channel === ch) rows.push({ date: r.day, ref: r.no, kind: 'receipt', id: r.id, desc: 'ใบเสร็จ ' + r.customerName, inp: r.total, out: 0 }); });
  S.expenses.forEach(e => { if (e.status === 'paid' && e.channel === ch) rows.push({ date: e.paidDate || e.date, ref: e.no, kind: 'expense', id: e.id, desc: e.vendorName + (e.desc ? ' · ' + e.desc : ''), inp: 0, out: e.paid }); });
  S.transfers.forEach(t => {
    if (t.from === ch) rows.push({ date: t.date, ref: t.no || 'โอน', kind: 'transfer', id: t.id, desc: 'โอนไป ' + chan(t.to).short + (t.note ? ' · ' + t.note : ''), inp: 0, out: t.amount });
    if (t.to === ch) rows.push({ date: t.date, ref: t.no || 'โอน', kind: 'transfer', id: t.id, desc: 'รับโอนจาก ' + chan(t.from).short + (t.note ? ' · ' + t.note : ''), inp: t.amount, out: 0 });
  });
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  let bal = Number(S.settings?.opening?.balances?.[ch]) || 0;
  const open = bal;
  const out = [];
  rows.forEach(r => { bal = round2(bal + r.inp - r.out); if ((!from || r.date >= from) && (!to || r.date <= to)) out.push({ ...r, bal }); });
  const openBal = rows.filter(r => from && r.date < from).reduce((a, r) => round2(a + r.inp - r.out), open);
  return { rows: out, open: from ? openBal : open, close: bal };
}

/* ---------- สรุปรายเดือน ---------- */
export function monthly(S, months) {
  return months.map(m => {
    const rc = S.receipts.filter(r => !r.voided && monthKey(r.day) === m);
    const ex = S.expenses.filter(e => monthKey(e.date) === m && isExpenseCat(e.category));
    const gross = sum(rc, r => r.gross), discount = sum(rc, r => r.discount), revenue = sum(rc, r => r.total);
    const service = sum(rc, r => sum(r.items.filter(i => i.kind === 'service'), i => i.total));
    const product = sum(rc, r => sum(r.items.filter(i => i.kind === 'product'), i => i.total));
    const expense = sum(ex, e => e.amount);
    const byCat = {}; ex.forEach(e => byCat[e.category] = round2((byCat[e.category] || 0) + e.amount));
    return { month: m, bills: rc.length, gross, discount, revenue, service, product, expense, profit: round2(revenue - expense), byCat };
  });
}

/* ---------- หัก ณ ที่จ่าย ---------- */
export function whtForm(e, contacts) {
  if (e.whtForm) return e.whtForm;
  const v = contacts.find(c => c.id === e.vendorId || c.name === e.vendorName);
  const juristic = v ? v.juristic : /บริษัท|จำกัด|บจก|หจก|สำนักงาน|มหาชน/.test(e.vendorName || '');
  return juristic ? 'PND53' : 'PND3';
}
export function whtSummary(S, months) {
  const rows = S.expenses.filter(e => e.whtAmount > 0 && months.includes(monthKey(e.date)));
  const g = groupBy(rows, e => monthKey(e.date) + '|' + whtForm(e, S.contacts));
  return Object.entries(g).map(([k, list]) => { const [month, form] = k.split('|'); return { month, form, count: list.length, base: sum(list, e => e.whtBase || e.amount), wht: sum(list, e => e.whtAmount), list }; })
    .sort((a, b) => a.month < b.month ? -1 : a.month > b.month ? 1 : a.form < b.form ? -1 : 1);
}

/* ---------- เลขที่เอกสาร ---------- */
export function nextNo(list, prefix, day) {
  const ym = String(day).slice(0, 7).replace('-', '');
  const pre = `${prefix}-${ym}-`;
  const max = list.reduce((m, x) => { if (x.no && x.no.startsWith(pre)) { const n = parseInt(x.no.slice(pre.length), 10); if (n > m) m = n; } return m; }, 0);
  return pre + pad(max + 1, 3);
}

/* ---------- แปลงบิล POS → ใบเสร็จ ---------- */
export function saleToReceipt(s) {
  const items = [];
  // ผู้ให้บริการ: POS เก็บไว้ที่ staffName ของบิล (คนที่รับค่ามือ) และบางบรรทัดมี doerName แยก (เช่น สปา)
  (s.serviceItems || []).forEach(i => items.push({ name: i.name, qty: 1, unitPrice: Number(i.price) || 0, total: Number(i.price) || 0, kind: 'service', doer: i.doerName || '' }));
  if (!(s.serviceItems || []).length && s.service) items.push({ name: s.service, qty: 1, unitPrice: Number(s.serviceTotal ?? s.price) || 0, total: Number(s.serviceTotal ?? s.price) || 0, kind: 'service' });
  (s.homecareItems || []).forEach(i => items.push({ name: i.name, qty: Number(i.qty) || 1, unitPrice: Number(i.unitPrice) || 0, total: Number(i.total) || 0, kind: 'product' }));
  const gross = sum(items, i => i.total);
  const total = round2(Number(s.totalPaid ?? ((s.paid || 0) + (s.homecareTotal || 0))) || 0);
  const discount = round2(Number(s.creditUsed) || 0) + round2(Number(s.discount) || 0);
  const diff = round2(gross - discount - total); // ส่วนต่างที่ POS คิดต่างไป เก็บไว้ตรวจ
  const d = new Date(s.date);
  return {
    id: 'POS-' + s.id, posId: s.id, source: 'pos', date: s.date, day: `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`,
    customerName: s.memberName || 'ลูกค้าทั่วไป', memberId: s.memberId || null, items, gross, discount, total, diff,
    channel: s.payMethod === 'transfer' ? 'BSV001' : 'CSH001', voided: !!s.voided,
    // ผู้ให้บริการของบิล = พนักงานที่ POS บันทึกไว้ (ได้ค่ามือ) + ผู้ร่วมทำ (coStaffs) ถ้ามี
    staffName: [s.staffName, ...((s.coStaffs || []).map(c => c.staffName))].filter(Boolean).join(' + '),
  };
}
