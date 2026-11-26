import { S, reg, nav } from '../core.js';
import { balances, monthly, CHANNELS, chan } from '../model.js';
import { fmt, fmt0, esc, thMonth, monthKey, today, thDateTime, monthsBetween, addMonths } from '../util.js';
import { syncPOS } from './receipts.js';

export function render() {
  const bal = balances(S);
  const cur = monthKey(today());
  const months = monthsBetween(addMonths(cur, -5), cur);
  const ms = monthly(S, months);
  const m = ms[ms.length - 1];
  const prev = ms[ms.length - 2] || {};
  const unmatched = S.statements.filter(x => !x.matchedTo).length;
  const unpaid = S.expenses.filter(e => e.status === 'unpaid');
  const alerts = [];
  if (!S.settings.opening.cashConfirmed) alerts.push(['warn', 'ยอดเงินสดตั้งต้น 1 ต.ค. 69 ยังใช้ตัวเลขจากสมุด PEAK (' + fmt(S.settings.opening.balances.CSH001) + ') รอยอดนับจริง — แก้ได้ที่ ตั้งค่า']);
  CHANNELS.filter(c => c.type !== 'director' && bal[c.id] < -0.005).forEach(c => alerts.push(['red', `${c.name} ยอดในสมุดติดลบ ${fmt(bal[c.id])} — น่าจะขาดรายการโอนเข้า หรือเงินกรรมการ`]));
  if (unmatched) alerts.push(['warn', `มีรายการ statement ธนาคารที่ยังไม่จับคู่ ${unmatched} รายการ`]);
  if (unpaid.length) alerts.push(['warn', `รายจ่ายค้างจ่าย ${unpaid.length} รายการ รวม ${fmt(unpaid.reduce((a, e) => a + e.paid, 0))}`]);
  if (S.settings._unsaved) alerts.push(['warn', 'ยังไม่ได้บันทึกการตั้งค่าเริ่มต้นลงฐานข้อมูล — ไปที่ ตั้งค่า แล้วกดบันทึก']);
  const maxV = Math.max(1, ...ms.map(x => Math.max(x.revenue, x.expense)));
  const bars = ms.map(x => `<div style="flex:1;text-align:center;font-size:.7rem;color:var(--muted)">
      <div style="display:flex;gap:3px;align-items:flex-end;height:110px;justify-content:center">
        <div title="รายได้ ${fmt(x.revenue)}" style="width:40%;background:linear-gradient(180deg,var(--gold),var(--gold-dark));height:${Math.round(x.revenue / maxV * 100)}%;border-radius:4px 4px 0 0"></div>
        <div title="ค่าใช้จ่าย ${fmt(x.expense)}" style="width:40%;background:var(--rose-light);border:1px solid var(--rose);height:${Math.round(x.expense / maxV * 100)}%;border-radius:4px 4px 0 0"></div></div>
      ${thMonth(x.month, false)}<br><b class="${x.profit >= 0 ? 'pos' : 'neg'}">${fmt0(x.profit)}</b></div>`).join('');
  const pct = (a, b) => b ? ((a - b) / Math.abs(b) * 100).toFixed(0) + '%' : '-';
  return `
  <div class="topbar"><h1>หน้าหลัก</h1><div class="row">
    <span class="small muted">POS ซิงก์ล่าสุด ${S.settings.posLastSync ? thDateTime(S.settings.posLastSync) : 'ยังไม่เคย'}</span>
    <button class="btn btn-gold btn-sm" data-act="syncPOS">⟳ ดึงบิลจาก POS</button></div></div>
  ${alerts.map(([k, t]) => `<div class="alert ${k}">${esc(t)}</div>`).join('')}
  <div class="grid g4 mb">
    <div class="stat hero"><div class="lbl">รายได้ ${thMonth(cur, false)}</div><div class="val">${fmt(m.revenue)}</div><div class="sub">${m.bills} ใบเสร็จ · เทียบเดือนก่อน ${pct(m.revenue, prev.revenue)}</div></div>
    <div class="stat"><div class="lbl">ค่าใช้จ่าย ${thMonth(cur, false)}</div><div class="val">${fmt(m.expense)}</div><div class="sub">เทียบเดือนก่อน ${pct(m.expense, prev.expense)}</div></div>
    <div class="stat"><div class="lbl">กำไร/ขาดทุน ${thMonth(cur, false)}</div><div class="val ${m.profit >= 0 ? 'pos' : 'neg'}">${fmt(m.profit)}</div><div class="sub">บริการ ${fmt0(m.service)} · สินค้า ${fmt0(m.product)} · ส่วนลด ${fmt0(m.discount)}</div></div>
    <div class="stat"><div class="lbl">บริษัทติดหนี้กรรมการ</div><div class="val">${fmt(-bal.DIR)}</div><div class="sub">เงินที่อาจารย์สำรองจ่าย/ให้ยืม</div></div>
  </div>
  <div class="grid g3 mb">
    ${CHANNELS.filter(c => c.type !== 'director').map(c => `<div class="stat" data-act="goLedger" data-ch="${c.id}" style="cursor:pointer"><div class="lbl">${esc(c.name)}</div><div class="val ${bal[c.id] < 0 ? 'neg' : ''}">${fmt(bal[c.id])}</div><div class="sub">ยอดในสมุด · กดดูรายการ</div></div>`).join('')}
  </div>
  <div class="card"><div class="card-title">รายได้ (ทอง) เทียบค่าใช้จ่าย (ชมพู) 6 เดือน · ตัวเลขล่าง = กำไร</div><div style="display:flex;gap:6px">${bars}</div></div>
  <div class="grid g2">
    <div class="card"><div class="card-title">ใบเสร็จล่าสุด</div>
      ${S.receipts.filter(r => !r.voided).slice(0, 6).map(r => `<div class="row" style="justify-content:space-between;padding:5px 0;border-bottom:1px solid #F3EAE0"><span>${esc(r.customerName)}<br><span class="small muted">${esc(r.items.map(i => i.name).join(', '))}</span></span><span class="num"><b>${fmt(r.total)}</b><br><span class="tag ${chan(r.channel).type}">${chan(r.channel).short}</span></span></div>`).join('') || '<div class="empty">ยังไม่มีใบเสร็จ กด "ดึงบิลจาก POS"</div>'}
    </div>
    <div class="card"><div class="card-title">รายจ่ายล่าสุด</div>
      ${S.expenses.slice(0, 6).map(e => `<div class="row" style="justify-content:space-between;padding:5px 0;border-bottom:1px solid #F3EAE0"><span>${esc(e.vendorName)}<br><span class="small muted">${esc(e.desc || '')}</span></span><span class="num"><b>${fmt(e.amount)}</b><br><span class="tag ${chan(e.channel).type}">${e.status === 'unpaid' ? 'ค้างจ่าย' : chan(e.channel).short}</span></span></div>`).join('') || '<div class="empty">ยังไม่มีรายจ่าย</div>'}
      <button class="btn btn-outline btn-sm mt" data-act="goExpenses">+ บันทึกรายจ่าย</button>
    </div>
  </div>`;
}
reg({
  syncPOS: () => syncPOS(),
  goLedger: el => nav('finance', el.dataset.ch),
  goExpenses: () => nav('expenses', 'new'),
});
