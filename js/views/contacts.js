import { S, reg, rerender, saveDoc, removeDoc, openModal, closeModal, formData, canI, confirmBox } from '../core.js';
import { store } from '../store.js';
import { esc, toast, uid, fmt0 } from '../util.js';

export function render() {
  const ui = S.ui.ct = S.ui.ct || { type: 'vendor', q: '' };
  const list = S.contacts.filter(c => c.type === ui.type && (!ui.q || (c.name + ' ' + (c.taxId || '') + ' ' + (c.phone || '')).toLowerCase().includes(ui.q.toLowerCase())));
  const spend = {}; S.expenses.forEach(e => spend[e.vendorName] = (spend[e.vendorName] || 0) + e.amount);
  const buy = {}; S.receipts.forEach(r => { if (!r.voided) buy[r.customerName] = (buy[r.customerName] || 0) + r.total; });
  return `
  <div class="topbar"><h1>ผู้ติดต่อ</h1><div class="row">
    ${ui.type === 'customer' ? `<button class="btn btn-outline btn-sm" data-act="ctImportPOS">⟳ ดึงลูกค้าจาก POS</button>` : ''}
    <button class="btn btn-gold btn-sm" data-act="ctNew">+ เพิ่ม${ui.type === 'vendor' ? 'ผู้ขาย' : 'ลูกค้า'}</button></div></div>
  <div class="card"><div class="row">
    <div class="seg"><button class="${ui.type === 'vendor' ? 'on' : ''}" data-act="ctType" data-v="vendor">ผู้ขาย / ผู้รับเงิน</button><button class="${ui.type === 'customer' ? 'on' : ''}" data-act="ctType" data-v="customer">ลูกค้า</button></div>
    <input data-input="ctQ" value="${esc(ui.q)}" placeholder="ค้นหา" style="max-width:260px"><span class="grow"></span><span class="small">${list.length} ราย</span></div></div>
  <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>ชื่อ</th><th>ประเภท</th><th>เลขผู้เสียภาษี</th><th>โทร</th><th class="right">${ui.type === 'vendor' ? 'ยอดจ่ายสะสม' : 'ยอดซื้อสะสม'}</th><th></th></tr></thead><tbody>
    ${list.map(c => `<tr><td>${esc(c.name)}${c.address ? `<br><span class="small muted">${esc(c.address)}</span>` : ''}</td><td class="small">${c.type === 'vendor' ? (c.juristic ? 'นิติบุคคล (ภ.ง.ด.53)' : 'บุคคลธรรมดา (ภ.ง.ด.3)') : 'ลูกค้า'}</td><td>${esc(c.taxId || '-')}</td><td>${esc(c.phone || '-')}</td><td class="num">${fmt0((ui.type === 'vendor' ? spend : buy)[c.name] || 0)}</td><td><button class="btn btn-ghost btn-sm" data-act="ctEdit" data-id="${c.id}">แก้</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">ยังไม่มีรายชื่อ</td></tr>'}
  </tbody></table></div>
  <p class="small muted">ผู้ขายถูกเพิ่มอัตโนมัติเมื่อบันทึกรายจ่าย ใส่เลขผู้เสียภาษีไว้เพื่อให้หนังสือรับรอง 50 ทวิ ครบถ้วน · ลูกค้าดึงจากสมาชิก POS</p>`;
}
function form(c = null) {
  if (!canI(c ? 'edit' : 'add')) return;
  const d = c || { type: S.ui.ct.type, name: '', taxId: '', phone: '', address: '', juristic: false };
  openModal(`<h2>${c ? 'แก้ไข' : 'เพิ่ม'}${d.type === 'vendor' ? 'ผู้ขาย' : 'ลูกค้า'}</h2><form data-submit="ctSave">
    <input type="hidden" name="id" value="${esc(d.id || '')}"><input type="hidden" name="type" value="${d.type}">
    <div class="field"><label class="f">ชื่อ</label><input name="name" value="${esc(d.name)}" required></div>
    <div class="grid g2"><div class="field"><label class="f">เลขประจำตัวผู้เสียภาษี</label><input name="taxId" value="${esc(d.taxId || '')}" inputmode="numeric" maxlength="13"></div>
    <div class="field"><label class="f">โทร</label><input name="phone" value="${esc(d.phone || '')}"></div></div>
    <div class="field"><label class="f">ที่อยู่ (ใช้ใน 50 ทวิ)</label><textarea name="address">${esc(d.address || '')}</textarea></div>
    ${d.type === 'vendor' ? `<div class="field"><label><input type="checkbox" name="juristic" ${d.juristic ? 'checked' : ''}> นิติบุคคล (บริษัท/หจก. → ภ.ง.ด.53)</label></div>` : ''}
    <div class="row" style="justify-content:space-between"><span>${c && S.role === 'owner' ? `<button type="button" class="btn btn-ghost" data-act="ctDelete" data-id="${c.id}">ลบ</button>` : ''}</span><span class="row"><button type="button" class="btn btn-outline" data-act="closeModal">ยกเลิก</button><button class="btn btn-gold">บันทึก</button></span></div></form>`);
}
reg({
  ctType: el => { S.ui.ct.type = el.dataset.v; rerender(); },
  ctQ: el => { S.ui.ct.q = el.value; clearTimeout(S.ui.ctT); S.ui.ctT = setTimeout(rerender, 250); },
  ctNew: () => form(), ctEdit: el => form(S.contacts.find(x => x.id === el.dataset.id)),
  async ctSave(f) { const d = formData(f); const old = d.id ? S.contacts.find(x => x.id === d.id) : {}; await saveDoc('acc_contacts', { ...old, ...d, id: d.id || uid(d.type === 'vendor' ? 'V' : 'C') }); closeModal(); toast('บันทึกแล้ว'); },
  async ctDelete(el) { if (!await confirmBox('ลบรายชื่อนี้?')) return; await removeDoc('acc_contacts', el.dataset.id); closeModal(); },
  async ctImportPOS() {
    if (!canI('sync')) return; toast('กำลังดึงสมาชิกจาก POS…');
    let ms; try { ms = await store.posMembers(); } catch (e) { return toast('ดึงไม่สำเร็จ: ' + e.message); }
    const have = new Set(S.contacts.filter(c => c.type === 'customer').map(c => c.posId || c.name));
    const docs = ms.filter(m => m.name && !have.has(m.id) && !have.has(m.name)).map(m => ({ id: 'POSM-' + m.id, posId: m.id, type: 'customer', name: m.name, phone: m.phone || '', taxId: '', source: 'pos', createdAt: new Date().toISOString() }));
    if (docs.length) await store.saveMany('acc_contacts', docs);
    toast(`เพิ่มลูกค้าใหม่ ${docs.length} ราย จากสมาชิก POS ${ms.length} ราย`);
  },
});
