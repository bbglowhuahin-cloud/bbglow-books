import { S, reg, rerender, saveDoc, removeDoc, openModal, closeModal, formData, canI, confirmBox, nav } from '../core.js';
import { CHANNELS, chan, balances, channelLedger, nextNo } from '../model.js';
import { fmt, esc, thDate, today, toast, round2, uid, monthKey, thMonth, downloadText, csvRow } from '../util.js';

export function render() {
  const ui = S.ui.fin = S.ui.fin || { ch: 'BSV001', month: monthKey(today()) };
  if (S.param && chan(S.param).type !== '?') { ui.ch = S.param; S.param = ''; }
  const bal = balances(S);
  const months = [...new Set([...S.receipts.map(r => monthKey(r.day)), ...S.expenses.map(e => monthKey(e.date)), ...S.transfers.map(t => monthKey(t.date))])].sort().reverse();
  const from = ui.month ? ui.month + '-01' : '', to = ui.month ? ui.month + '-31' : '';
  const led = channelLedger(S, ui.ch, from, to);
  const c = chan(ui.ch);
  return `
  <div class="topbar"><h1>การเงิน · ช่องทางเงิน</h1><div class="row">
    <button class="btn btn-outline btn-sm" data-act="finDirector">💼 เงินกรรมการ</button>
    <button class="btn btn-gold btn-sm" data-act="finTransfer">⇄ โอนระหว่างช่องทาง</button></div></div>
  <div class="grid g4 mb">
    ${CHANNELS.map(x => `<div class="stat ${x.id === ui.ch ? 'hero' : ''}" data-act="finPick" data-ch="${x.id}" style="cursor:pointer"><div class="lbl">${esc(x.name)}</div><div class="val ${x.type !== 'director' && bal[x.id] < 0 ? 'neg' : ''}">${fmt(x.type === 'director' ? -bal[x.id] : bal[x.id])}</div><div class="sub">${x.type === 'director' ? 'บริษัทติดหนี้กรรมการ' : 'ยอดในสมุด'}</div></div>`).join('')}
  </div>
  <div class="card"><div class="row">
    <b>${esc(c.name)}</b>
    <select data-on="finMonth" style="width:auto"><option value="">ตั้งแต่ต้น</option>${months.map(m => `<option value="${m}" ${m === ui.month ? 'selected' : ''}>${thMonth(m)}</option>`).join('')}</select>
    <span class="grow"></span><button class="btn btn-outline btn-sm" data-act="finExport">⬇ CSV</button></div>
    <div class="tbl-wrap mt"><table class="tbl"><thead><tr><th>วันที่</th><th>อ้างอิง</th><th>รายการ</th><th class="right">เข้า</th><th class="right">ออก</th><th class="right">คงเหลือ</th></tr></thead><tbody>
      <tr><td></td><td></td><td><b>ยอดยกมา</b></td><td></td><td></td><td class="num"><b>${fmt(led.open)}</b></td></tr>
      ${led.rows.map(r => `<tr ${r.kind === 'transfer' ? `data-act="finEditTransfer" data-id="${r.id}" style="cursor:pointer"` : ''}><td>${thDate(r.date)}</td><td class="small">${esc(r.ref)}</td><td>${esc(r.desc)}</td><td class="num pos">${r.inp ? fmt(r.inp) : ''}</td><td class="num neg">${r.out ? fmt(r.out) : ''}</td><td class="num ${r.bal < 0 && c.type !== 'director' ? 'neg' : ''}">${fmt(r.bal)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">ไม่มีรายการในช่วงนี้</td></tr>'}
    </tbody><tfoot><tr><td colspan="3">รวมช่วงนี้</td><td class="num">${fmt(led.rows.reduce((a, r) => a + r.inp, 0))}</td><td class="num">${fmt(led.rows.reduce((a, r) => a + r.out, 0))}</td><td class="num">${fmt(led.rows.length ? led.rows[led.rows.length - 1].bal : led.open)}</td></tr></tfoot></table></div>
  </div>
  ${c.type === 'director' ? '<div class="alert warn">ช่อง "กรรมการ" คือเงินที่อาจารย์ให้บริษัทยืมหรือสำรองจ่าย ยอดติดลบในสมุด = บริษัทติดหนี้กรรมการ เมื่อบริษัทโอนคืนให้ลง "โอนระหว่างช่องทาง" จากบัญชีธนาคารไปกรรมการ</div>' : ''}`;
}

export function transferForm(t = null, preset = {}) {
  if (!canI(t ? 'edit' : 'add')) return;
  const d = t || { date: today(), from: 'BSV001', to: 'BSV002', amount: '', note: '', ...preset };
  openModal(`<h2>${t ? 'แก้ไขรายการโอน' : 'โอนระหว่างช่องทาง'}</h2><form data-submit="finSaveTransfer">
    <input type="hidden" name="id" value="${esc(d.id || '')}">
    <div class="grid g3"><div class="field"><label class="f">วันที่</label><input name="date" type="date" value="${d.date}" required></div>
    <div class="field"><label class="f">จาก</label><select name="from">${CHANNELS.map(c => `<option value="${c.id}" ${c.id === d.from ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
    <div class="field"><label class="f">ไป</label><select name="to">${CHANNELS.map(c => `<option value="${c.id}" ${c.id === d.to ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div></div>
    <div class="grid g2"><div class="field"><label class="f">จำนวนเงิน</label><input name="amount" type="number" step="0.01" min="0.01" value="${d.amount}" required></div>
    <div class="field"><label class="f">หมายเหตุ</label><input name="note" value="${esc(d.note || '')}" placeholder="เช่น เติมบัญชีจ่าย / ฝากเงินสด / อาจารย์สำรองจ่าย"></div></div>
    <div class="small muted">ตัวอย่าง: บัญชีรับ → บัญชีจ่าย = เติมเงินไว้จ่าย · เงินสด → บัญชีรับ = ฝากเงินสด · กรรมการ → บัญชีจ่าย = อาจารย์ให้บริษัทยืม · บัญชีรับ → กรรมการ = คืนเงินอาจารย์</div>
    <div class="row mt" style="justify-content:space-between"><span>${t && S.role === 'owner' ? `<button type="button" class="btn btn-ghost" data-act="finDelTransfer" data-id="${t.id}">ลบ</button>` : ''}</span><span class="row"><button type="button" class="btn btn-outline" data-act="closeModal">ยกเลิก</button><button class="btn btn-gold">บันทึก</button></span></div></form>`);
}
reg({
  finPick: el => { S.ui.fin.ch = el.dataset.ch; rerender(); },
  finMonth: el => { S.ui.fin.month = el.value; rerender(); },
  finTransfer: () => transferForm(),
  finDirector: () => transferForm(null, { from: 'DIR', to: 'BSV002', note: 'อาจารย์โอนเติมบัญชีจ่าย' }),
  finEditTransfer: el => transferForm(S.transfers.find(t => t.id === el.dataset.id)),
  async finSaveTransfer(f) {
    const d = formData(f); if (d.from === d.to) return toast('ต้นทางกับปลายทางซ้ำกัน'); if (!(d.amount > 0)) return toast('กรอกจำนวนเงิน');
    const old = d.id ? S.transfers.find(t => t.id === d.id) : null;
    const doc = { ...(old || {}), id: d.id || uid('T'), date: d.date, from: d.from, to: d.to, amount: round2(d.amount), note: d.note };
    if (!doc.no) doc.no = nextNo(S.transfers, 'TR', d.date);
    if (d.from === 'DIR' || d.to === 'DIR') doc.kind = d.from === 'DIR' ? 'directorIn' : 'directorOut'; else doc.kind = 'transfer';
    await saveDoc('acc_transfers', doc); closeModal(); toast('บันทึกรายการโอนแล้ว');
  },
  async finDelTransfer(el) { if (!await confirmBox('ลบรายการโอนนี้?')) return; await removeDoc('acc_transfers', el.dataset.id); closeModal(); },
  finExport() { const ui = S.ui.fin; const led = channelLedger(S, ui.ch, ui.month ? ui.month + '-01' : '', ui.month ? ui.month + '-31' : ''); downloadText(`ledger_${ui.ch}_${ui.month || 'all'}.csv`, [csvRow(['วันที่', 'อ้างอิง', 'รายการ', 'เข้า', 'ออก', 'คงเหลือ']), csvRow(['', '', 'ยอดยกมา', '', '', led.open]), ...led.rows.map(r => csvRow([r.date, r.ref, r.desc, r.inp || '', r.out || '', r.bal]))].join('\n')); },
});
