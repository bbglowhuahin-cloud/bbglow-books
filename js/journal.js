// เครื่องสร้างสมุดรายวันอัตโนมัติจากเอกสาร (ใบเสร็จ รายจ่าย โอน ยอดยกมา) → แยกประเภท งบทดลอง งบการเงิน
import { round2, sum, monthKey } from './util.js';
import { CATEGORIES, cat, chan, whtForm } from './model.js';

/* ---------- ผังบัญชี (รหัสตาม PEAK ยกเว้นที่ระบุ) ---------- */
export const ACCOUNTS = [
  ['111101', 'เงินสด', 'A'], ['111302', 'ธนาคาร กสิกร บัญชีรับ', 'A'], ['111303', 'ธนาคาร กสิกร บัญชีจ่าย', 'A'],
  ['114102', 'สินค้าสำเร็จรูป', 'A'], ['124106', 'อุปกรณ์สำนักงาน', 'A'], ['124107', 'เครื่องตกแต่งสำนักงาน', 'A'], ['124206', 'ค่าเสื่อมราคาสะสม - อุปกรณ์สำนักงาน', 'A'],
  ['212101', 'เจ้าหนี้การค้า/ค่าใช้จ่ายค้างจ่าย', 'L'], ['212201', 'เงินกู้ยืมจากกรรมการ', 'L'], ['215203', 'ภาษีหัก ณ ที่จ่ายค้างจ่าย (ภ.ง.ด.3/53)', 'L'], ['215501', 'ประกันสังคมค้างจ่าย', 'L'],
  ['311001', 'ทุน-เจ้าของกิจการ', 'E'], ['330000', 'กำไร(ขาดทุน)สะสม', 'E'], ['333000', 'ผลต่างยอดยกมารอปรับปรุง (เงินสด/ธนาคารไม่ตรงจริง)', 'E'],
  ['410101', 'รายได้จากการขายสินค้า', 'R'], ['410201', 'รายได้จากการให้บริการ', 'R'], ['410302', 'ส่วนลดจ่าย (เครดิตสะสมที่ลูกค้าใช้)', 'R'],
  ...CATEGORIES.filter(c => /^5/.test(c.code)).map(c => [c.code, c.name, 'X']),
  ['540199', 'ผลต่างยอดบิล POS', 'X'],
];
const ACC = Object.fromEntries(ACCOUNTS.map(([code, name, type]) => [code, { code, name, type }]));
export const acct = code => ACC[code] || { code, name: cat(code).name || code, type: /^1/.test(code) ? 'A' : /^2/.test(code) ? 'L' : /^3/.test(code) ? 'E' : /^4/.test(code) ? 'R' : 'X' };
export const CH_ACCT = { CSH001: '111101', BSV001: '111302', BSV002: '111303', DIR: '212201' };
const isDebitNormal = t => t === 'A' || t === 'X';

/* ---------- สร้างรายการสมุดรายวัน ---------- */
export function buildJournal(S) {
  const J = [];
  const op = S.settings.opening || {}; const ob = op.balances || {}; const bs = op.bs || {};
  // 1) ยอดยกมา
  const lines = [];
  const put = (code, dr, cr) => { dr = round2(dr); cr = round2(cr); if (dr) lines.push({ acct: code, dr, cr: 0 }); if (cr) lines.push({ acct: code, dr: 0, cr }); };
  ['CSH001', 'BSV001', 'BSV002'].forEach(ch => { const v = Number(ob[ch]) || 0; put(CH_ACCT[ch], v > 0 ? v : 0, v < 0 ? -v : 0); });
  const dirOpen = Number(ob.DIR) || 0; put('212201', dirOpen > 0 ? dirOpen : 0, dirOpen < 0 ? -dirOpen : 0); // ติดลบ = บริษัทเป็นหนี้กรรมการ
  put('114102', bs.inventory || 0, 0); put('124106', bs.equipment || 0, 0); put('124107', bs.furniture || 0, 0); put('124206', 0, bs.accumDep || 0);
  put('212101', 0, bs.payables || 0); put('215203', 0, (bs.pnd3 || 0) + (bs.pnd53 || 0)); put('215501', 0, bs.sso || 0);
  put('311001', 0, bs.capital || 0); put('330000', bs.retained < 0 ? -bs.retained : 0, bs.retained > 0 ? bs.retained : 0);
  const dr = sum(lines, l => l.dr), cr = sum(lines, l => l.cr); const plug = round2(cr - dr);
  if (plug) put('333000', plug > 0 ? plug : 0, plug < 0 ? -plug : 0);
  if (lines.length) J.push({ id: 'OPEN', date: op.date || '2026-10-01', book: 'JV', no: 'JV-OPEN', desc: 'ยอดยกมาต้นปีบัญชี' + (plug ? ' (มีผลต่างรอปรับปรุง ' + plug + ')' : ''), lines });
  // 2) ใบเสร็จ → รายวันรับ
  S.receipts.filter(r => !r.voided).forEach(r => {
    const L = [];
    L.push({ acct: CH_ACCT[r.channel] || '111101', dr: r.total, cr: 0 });
    if (r.discount) L.push({ acct: '410302', dr: r.discount, cr: 0 });
    const svc = sum(r.items.filter(i => i.kind === 'service'), i => i.total), prod = sum(r.items.filter(i => i.kind === 'product'), i => i.total);
    if (svc) L.push({ acct: '410201', dr: 0, cr: svc }); if (prod) L.push({ acct: '410101', dr: 0, cr: prod });
    const d = round2(r.total + (r.discount || 0) - svc - prod); if (d) L.push({ acct: '540199', dr: d < 0 ? -d : 0, cr: d > 0 ? d : 0 });
    J.push({ id: r.id, date: r.day, book: 'RV', no: r.no, desc: `ใบเสร็จ ${r.customerName}` + (r.channelFixed ? ' (แก้ช่องทางตอนกระทบยอด)' : ''), ref: { type: 'receipt', id: r.id }, lines: L });
  });
  // 3) รายจ่าย → รายวันจ่าย (และรายวันทั่วไปสำหรับเจ้าหนี้)
  S.expenses.forEach(e => {
    const wht = e.whtRemitted === 'vendor' ? 0 : (e.whtAmount || 0);
    const payAcct = CH_ACCT[e.channel];
    if (e.openingPayable) { // เจ้าหนี้ยกมา: บันทึกเฉพาะตอนจ่าย
      if (e.status === 'paid' && payAcct) J.push({ id: e.id, date: e.paidDate || e.date, book: 'PV', no: e.no, desc: `จ่ายเจ้าหนี้ยกมา ${e.vendorName}`, ref: { type: 'expense', id: e.id }, lines: [{ acct: '212101', dr: e.paid, cr: 0 }, { acct: payAcct, dr: 0, cr: e.paid }] });
      return;
    }
    const isLiab = e.category === '215200' || e.category === '215501';
    const debitAcct = e.category === '215200' ? '215203' : e.category === '215501' ? '215501' : e.category;
    const amount = e.amount;
    if (e.status === 'paid' && payAcct && (!e.paidDate || e.paidDate === e.date)) {
      const L = [{ acct: debitAcct, dr: amount, cr: 0 }]; if (wht) L.push({ acct: '215203', dr: 0, cr: wht }); L.push({ acct: payAcct, dr: 0, cr: round2(amount - wht) });
      J.push({ id: e.id, date: e.date, book: 'PV', no: e.no, desc: `${isLiab ? 'นำส่ง' : 'จ่าย'} ${e.vendorName}${e.desc ? ' · ' + e.desc : ''}`, ref: { type: 'expense', id: e.id }, lines: L });
    } else {
      // ตั้งหนี้ก่อน แล้วค่อยจ่าย
      const L = [{ acct: debitAcct, dr: amount, cr: 0 }]; if (wht) L.push({ acct: '215203', dr: 0, cr: wht }); L.push({ acct: '212101', dr: 0, cr: round2(amount - wht) });
      J.push({ id: e.id + ':acc', date: e.date, book: 'JV', no: e.no, desc: `ตั้งค้างจ่าย ${e.vendorName}${e.desc ? ' · ' + e.desc : ''}`, ref: { type: 'expense', id: e.id }, lines: L });
      if (e.status === 'paid' && payAcct) J.push({ id: e.id + ':pay', date: e.paidDate || e.date, book: 'PV', no: e.no, desc: `จ่ายค้างจ่าย ${e.vendorName}`, ref: { type: 'expense', id: e.id }, lines: [{ acct: '212101', dr: round2(amount - wht), cr: 0 }, { acct: payAcct, dr: 0, cr: round2(amount - wht) }] });
    }
  });
  // 4) โอนระหว่างช่องทาง / เงินกรรมการ → รายวันทั่วไป
  S.transfers.forEach(t => J.push({ id: t.id, date: t.date, book: 'JV', no: t.no || 'TR', desc: `โอน ${chan(t.from).short} → ${chan(t.to).short}${t.note ? ' · ' + t.note : ''}`, ref: { type: 'transfer', id: t.id }, lines: [{ acct: CH_ACCT[t.to], dr: t.amount, cr: 0 }, { acct: CH_ACCT[t.from], dr: 0, cr: t.amount }] }));
  J.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id === 'OPEN' ? -1 : b.id === 'OPEN' ? 1 : (a.no || '') < (b.no || '') ? -1 : 1));
  J.forEach(j => { j.dr = sum(j.lines, l => l.dr); j.cr = sum(j.lines, l => l.cr); j.balanced = Math.abs(j.dr - j.cr) < 0.005; });
  return J;
}

/* ---------- แยกประเภท ---------- */
export function ledger(J, code, from, to) {
  let bal = 0; const rows = []; let open = 0;
  const t = acct(code).type; const sign = isDebitNormal(t) ? 1 : -1;
  J.forEach(j => j.lines.forEach(l => { if (l.acct !== code) return; const v = sign * (l.dr - l.cr); if (from && j.date < from) { open = round2(open + v); return; } if (to && j.date > to) return; bal = round2(bal + v); rows.push({ date: j.date, no: j.no, book: j.book, desc: j.desc, dr: l.dr, cr: l.cr, ref: j.ref }); }));
  let run = open; rows.forEach(r => { run = round2(run + sign * (r.dr - r.cr)); r.bal = run; });
  return { open, rows, close: run, sign };
}

/* ---------- งบทดลอง ---------- */
export function trialBalance(J, from, to) {
  const m = {};
  const get = c => m[c] || (m[c] = { code: c, name: acct(c).name, type: acct(c).type, openDr: 0, openCr: 0, dr: 0, cr: 0 });
  J.forEach(j => j.lines.forEach(l => { const a = get(l.acct); if (from && j.date < from) { a.openDr += l.dr; a.openCr += l.cr; } else if (!to || j.date <= to) { a.dr += l.dr; a.cr += l.cr; } }));
  const rows = Object.values(m).map(a => { const openNet = round2(a.openDr - a.openCr); const closeNet = round2(openNet + a.dr - a.cr); return { ...a, openDr: openNet > 0 ? openNet : 0, openCr: openNet < 0 ? -openNet : 0, dr: round2(a.dr), cr: round2(a.cr), closeDr: closeNet > 0 ? closeNet : 0, closeCr: closeNet < 0 ? -closeNet : 0 }; }).filter(a => a.openDr || a.openCr || a.dr || a.cr).sort((a, b) => a.code < b.code ? -1 : 1);
  const tot = k => sum(rows, r => r[k]);
  return { rows, total: { openDr: tot('openDr'), openCr: tot('openCr'), dr: tot('dr'), cr: tot('cr'), closeDr: tot('closeDr'), closeCr: tot('closeCr') } };
}

/* ---------- งบกำไรขาดทุน ---------- */
export function profitLoss(J, from, to) {
  const m = {};
  J.forEach(j => { if ((from && j.date < from) || (to && j.date > to)) return; j.lines.forEach(l => { const t = acct(l.acct).type; if (t !== 'R' && t !== 'X') return; m[l.acct] = round2((m[l.acct] || 0) + (t === 'R' ? l.cr - l.dr : l.dr - l.cr)); }); });
  const rev = Object.entries(m).filter(([c]) => acct(c).type === 'R').map(([c, v]) => ({ code: c, name: acct(c).name, amount: v })).sort((a, b) => a.code < b.code ? -1 : 1);
  const exp = Object.entries(m).filter(([c]) => acct(c).type === 'X').map(([c, v]) => ({ code: c, name: acct(c).name, amount: v })).sort((a, b) => a.code < b.code ? -1 : 1);
  const cogs = exp.filter(e => /^51/.test(e.code)), sell = exp.filter(e => /^52/.test(e.code)), admin = exp.filter(e => /^53|^54/.test(e.code));
  const revenue = sum(rev, r => r.amount), tCogs = sum(cogs, r => r.amount), tSell = sum(sell, r => r.amount), tAdmin = sum(admin, r => r.amount);
  return { rev, cogs, sell, admin, revenue, tCogs, grossProfit: round2(revenue - tCogs), tSell, tAdmin, profit: round2(revenue - tCogs - tSell - tAdmin) };
}

/* ---------- งบฐานะการเงิน ณ วันที่ ---------- */
export function balanceSheet(J, asOf, fyFrom) {
  const m = {};
  J.forEach(j => { if (asOf && j.date > asOf) return; j.lines.forEach(l => { m[l.acct] = round2((m[l.acct] || 0) + l.dr - l.cr); }); });
  const grp = t => Object.entries(m).filter(([c]) => acct(c).type === t).map(([c, v]) => ({ code: c, name: acct(c).name, amount: isDebitNormal(t) ? v : -v })).filter(x => x.amount).sort((a, b) => a.code < b.code ? -1 : 1);
  const assets = grp('A'), liab = grp('L'), eq = grp('E');
  const pl = profitLoss(J, fyFrom, asOf);
  const tA = sum(assets, x => x.amount), tL = sum(liab, x => x.amount), tE = sum(eq, x => x.amount) + pl.profit;
  return { assets, liab, eq, profit: pl.profit, tA, tL, tE: round2(tE), diff: round2(tA - tL - tE) };
}
