import { S, reg, rerender, saveDoc, openModal, closeModal, canI } from '../core.js';
import { store } from '../store.js';
import { saleToReceipt, nextNo, chan, CHANNELS } from '../model.js';
import { fmt, fmt0, esc, thDate, monthKey, today, toast, downloadText, csvRow, thMonth, sum } from '../util.js';

/** ดึงบิลจาก POS (Firestore collection sales) มาเป็นใบเสร็จ ไม่ซ้ำ และไม่แก้ POS */
export async function syncPOS(silent = false) {
  if (!canI('sync')) return;
  const from = S.settings.posSyncFrom || '2026-10-01';
  toast('กำลังดึงบิลจาก POS…');
  let sales;
  try { sales = await store.posSales(from); } catch (err) { console.error(err); return toast('ดึงบิล POS ไม่สำเร็จ: ' + err.message, 4000); }
  const existing = new Map(S.receipts.map(r => [r.id, r]));
  const fresh = [...S.receipts];
  const toSave = [];
  sales.sort((a, b) => a.date < b.date ? -1 : 1).forEach(s => {
    if (!s.id || !s.date) return;
    const rc = saleToReceipt(s);
    const old = existing.get(rc.id);
    if (old) {
      // อัปเดตเฉพาะสถานะยกเลิก/ยอด/ช่องทาง ถ้าเปลี่ยน (เลขที่เดิมคงไว้) — ช่องทางที่แก้ตอนกระทบยอดแล้ว (channelFixed) ไม่ถูกทับ
      const ch = old.channelFixed ? old.channel : rc.channel;
      if (old.voided !== rc.voided || old.total !== rc.total || old.channel !== ch) toSave.push({ ...old, ...rc, channel: ch, no: old.no, syncedAt: new Date().toISOString() });
      return;
    }
    rc.no = nextNo(fresh, 'RE', rc.day); rc.syncedAt = new Date().toISOString();
    fresh.push(rc); toSave.push(rc);
  });
  if (toSave.length) await store.saveMany('acc_receipts', toSave);
  S.settings.posLastSync = new Date().toISOString();
  await saveDoc('acc_settings', { ...S.settings, _unsaved: undefined, id: 'main' });
  const added = toSave.filter(r => !existing.has(r.id)).length;
  if (!silent) toast(`ดึงบิล POS เสร็จ: ใหม่ ${added} ใบ อัปเดต ${toSave.length - added} ใบ จากทั้งหมด ${sales.length} บิล`, 4000);
}

export function render() {
  const ui = S.ui.rc = S.ui.rc || { month: monthKey(today()), ch: '', q: '' };
  const months = [...new Set(S.receipts.map(r => monthKey(r.day)))].sort().reverse();
  if (ui.month && !months.includes(ui.month) && months.length) ui.month = months[0];
  let list = S.receipts.filter(r => (!ui.month || monthKey(r.day) === ui.month) && (!ui.ch || r.channel === ui.ch) && (!ui.q || (r.customerName + ' ' + r.no + ' ' + r.items.map(i => i.name).join(' ')).toLowerCase().includes(ui.q.toLowerCase())));
  const live = list.filter(r => !r.voided);
  const byCh = {}; live.forEach(r => byCh[r.channel] = (byCh[r.channel] || 0) + r.total);
  return `
  <div class="topbar"><h1>ใบเสร็จรับเงิน</h1><div class="row">
    <button class="btn btn-outline btn-sm" data-act="rcExport">⬇ CSV</button>
    <button class="btn btn-gold btn-sm" data-act="syncPOS">⟳ ดึงบิลจาก POS</button></div></div>
  <div class="card"><div class="row">
    <select data-on="rcMonth" style="width:auto"><option value="">ทุกเดือน</option>${months.map(m => `<option value="${m}" ${m === ui.month ? 'selected' : ''}>${thMonth(m)}</option>`).join('')}</select>
    <select data-on="rcCh" style="width:auto"><option value="">ทุกช่องทาง</option>${CHANNELS.filter(c => c.type !== 'director').map(c => `<option value="${c.id}" ${c.id === ui.ch ? 'selected' : ''}>${c.short}</option>`).join('')}</select>
    <input data-input="rcQ" value="${esc(ui.q)}" placeholder="ค้นหาชื่อลูกค้า / เลขที่ / บริการ" style="max-width:280px">
    <span class="grow"></span>
    <span class="small">${live.length} ใบ · รวม <b>${fmt(sum(live, r => r.total))}</b> · ${Object.entries(byCh).map(([k, v]) => `${chan(k).short} ${fmt0(v)}`).join(' · ')}</span>
  </div></div>
  <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>เลขที่</th><th>วันที่</th><th>ลูกค้า</th><th>รายการ</th><th class="right">ราคาเต็ม</th><th class="right">ส่วนลด</th><th class="right">รับเงิน</th><th>ช่องทาง</th><th>ผู้ให้บริการ</th></tr></thead><tbody>
    ${list.map(r => `<tr style="${r.voided ? 'opacity:.45;text-decoration:line-through' : ''}" data-act="rcOpen" data-id="${r.id}">
      <td class="small">${esc(r.no || '')}${r.diff ? ' <span class="badge red" title="ยอดไม่ตรงสูตร">!</span>' : ''}</td><td>${thDate(r.day)}</td><td>${esc(r.customerName)}</td>
      <td class="small">${esc(r.items.map(i => i.name + (i.qty > 1 ? ' ×' + i.qty : '')).join(', '))}</td>
      <td class="num">${fmt(r.gross)}</td><td class="num">${r.discount ? fmt(r.discount) : '-'}</td><td class="num"><b>${fmt(r.total)}</b></td>
      <td><span class="tag ${chan(r.channel).type}">${chan(r.channel).short}</span></td><td class="small">${esc(r.staffName || '-')}${r.items.some(i => i.doer) ? `<br><span class="muted">${esc(r.items.filter(i => i.doer).map(i => i.name + ': ' + i.doer).join(', '))}</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">ไม่มีใบเสร็จในช่วงนี้</td></tr>'}
  </tbody></table></div>
  <p class="small muted">ใบเสร็จทุกใบดึงจากบิล POS โดยอัตโนมัติ แก้ไขที่ POS แล้วกดดึงใหม่ ยอดจะอัปเดตโดยเลขที่เดิมคงไว้ · เครดิตสะสมที่ลูกค้าใช้ลงเป็นส่วนลด ณ วันใช้</p>`;
}

function openReceipt(id) {
  const r = S.receipts.find(x => x.id === id); if (!r) return;
  openModal(`<h2>ใบเสร็จ ${esc(r.no || '')} ${r.voided ? '<span class="badge red">ยกเลิก</span>' : ''}</h2>
    <div class="grid g2 small"><div><b>ลูกค้า</b> ${esc(r.customerName)}<br><b>วันที่</b> ${thDate(r.day, true)}<br><b>ผู้ให้บริการ</b> ${esc(r.staffName || '-')}</div>
    <div><b>ช่องทาง</b> ${esc(chan(r.channel).name)}<br><b>อ้างอิง POS</b> ${esc(r.posId)}<br><b>ซิงก์เมื่อ</b> ${esc(r.syncedAt || '')}</div></div>
    <table class="tbl mt"><thead><tr><th>รายการ</th><th>ประเภท</th><th class="right">จำนวน</th><th class="right">ราคา</th></tr></thead><tbody>
    ${r.items.map(i => `<tr><td>${esc(i.name)}${i.doer ? ` <span class="small muted">· ทำโดย ${esc(i.doer)}</span>` : ''}</td><td>${i.kind === 'service' ? 'บริการ' : 'สินค้า'}</td><td class="num">${i.qty}</td><td class="num">${fmt(i.total)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td colspan="3">รวม</td><td class="num">${fmt(r.gross)}</td></tr><tr><td colspan="3">ส่วนลด (เครดิตสะสม)</td><td class="num">-${fmt(r.discount)}</td></tr><tr><td colspan="3">รับเงินจริง</td><td class="num">${fmt(r.total)}</td></tr></tfoot></table>
    ${r.diff ? `<div class="alert warn mt">ยอดจาก POS ไม่ตรงสูตร (ต่าง ${fmt(r.diff)}) ตรวจบิลใน POS</div>` : ''}
    <div class="row mt" style="justify-content:flex-end"><button class="btn btn-outline" data-act="closeModal">ปิด</button></div>`);
}

reg({
  rcMonth: el => { S.ui.rc.month = el.value; rerender(); },
  rcCh: el => { S.ui.rc.ch = el.value; rerender(); },
  rcQ: el => { S.ui.rc.q = el.value; clearTimeout(S.ui.rcT); S.ui.rcT = setTimeout(rerender, 250); },
  rcOpen: el => openReceipt(el.dataset.id),
  closeModal: () => closeModal(),
  rcExport() {
    const ui = S.ui.rc; const rows = S.receipts.filter(r => !ui.month || monthKey(r.day) === ui.month);
    const head = csvRow(['เลขที่', 'วันที่', 'ลูกค้า', 'รายการ', 'ราคาเต็ม', 'ส่วนลด', 'รับเงิน', 'ช่องทาง', 'พนักงาน', 'สถานะ', 'POS id']);
    downloadText(`receipts_${ui.month || 'all'}.csv`, [head, ...rows.map(r => csvRow([r.no, r.day, r.customerName, r.items.map(i => i.name).join(' | '), r.gross, r.discount, r.total, chan(r.channel).short, r.staffName, r.voided ? 'ยกเลิก' : 'ปกติ', r.posId]))].join('\n'));
  },
});
