import { S, reg, rerender, saveDoc, removeDoc, openModal, closeModal, modalEl, formData, canI, confirmBox, nav } from '../core.js';
import { CATEGORIES, cat, CHANNELS, chan, WHT_RATES, nextNo, whtForm, isExpenseCat } from '../model.js';
import { fmt, fmt0, esc, thDate, monthKey, today, toast, round2, shrinkImage, downloadText, csvRow, thMonth, sum, uid } from '../util.js';

export function render() {
  const ui = S.ui.ex = S.ui.ex || { month: monthKey(today()), q: '', cat: '' };
  if (S.param === 'new') { S.param = ''; setTimeout(() => openForm(), 0); }
  const months = [...new Set(S.expenses.map(e => monthKey(e.date)))].sort().reverse();
  if (ui.month && !months.includes(ui.month) && months.length) ui.month = months[0];
  const list = S.expenses.filter(e => (!ui.month || monthKey(e.date) === ui.month) && (!ui.cat || e.category === ui.cat) && (!ui.q || (e.vendorName + ' ' + (e.desc || '') + ' ' + e.no).toLowerCase().includes(ui.q.toLowerCase())));
  const byCat = {}; list.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + e.amount);
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return `
  <div class="topbar"><h1>รายจ่าย</h1><div class="row">
    <button class="btn btn-outline btn-sm" data-act="exExport">⬇ CSV</button>
    <button class="btn btn-gold" data-act="exNew">+ บันทึกรายจ่าย</button></div></div>
  <div class="card"><div class="row">
    <select data-on="exMonth" style="width:auto"><option value="">ทุกเดือน</option>${months.map(m => `<option value="${m}" ${m === ui.month ? 'selected' : ''}>${thMonth(m)}</option>`).join('')}</select>
    <select data-on="exCat" style="width:auto;max-width:260px"><option value="">ทุกหมวด</option>${CATEGORIES.map(c => `<option value="${c.code}" ${c.code === ui.cat ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
    <input data-input="exQ" value="${esc(ui.q)}" placeholder="ค้นหาผู้ขาย / รายละเอียด" style="max-width:260px">
    <span class="grow"></span><span class="small">${list.length} รายการ · รวม <b>${fmt(sum(list, e => e.amount))}</b> · หัก ณ ที่จ่าย ${fmt0(sum(list, e => e.whtAmount))}</span></div>
    ${top.length ? `<div class="row mt small muted">${top.map(([k, v]) => `<span class="tag">${esc(cat(k).name)} ${fmt0(v)}</span>`).join('')}</div>` : ''}
  </div>
  <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>เลขที่</th><th>วันที่</th><th>ผู้ขาย / รายละเอียด</th><th>หมวด</th><th class="right">ยอด</th><th class="right">หัก ณ ที่จ่าย</th><th class="right">จ่ายจริง</th><th>ช่องทาง</th><th></th></tr></thead><tbody>
    ${list.map(e => `<tr>
      <td class="small">${esc(e.no || '')}${e.source === 'peak' ? ' <span class="badge gray">PEAK</span>' : ''}${e.attachment ? ' 📎' : ''}</td><td>${thDate(e.date)}</td>
      <td>${esc(e.vendorName)}${e.desc ? `<br><span class="small muted">${esc(e.desc)}</span>` : ''}</td>
      <td class="small">${esc(cat(e.category).name)}</td><td class="num">${fmt(e.amount)}</td>
      <td class="num">${e.whtAmount ? fmt(e.whtAmount) + `<br><span class="small muted">${e.whtRate}% ${whtForm(e, S.contacts) === 'PND53' ? 'ภ.ง.ด.53' : 'ภ.ง.ด.3'}</span>` : '-'}</td>
      <td class="num"><b>${fmt(e.paid)}</b></td>
      <td>${e.status === 'unpaid' ? '<span class="pill" style="background:var(--crimson-light);color:var(--crimson)">ค้างจ่าย</span>' : `<span class="tag ${chan(e.channel).type}">${chan(e.channel).short}</span>`}</td>
      <td class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn btn-ghost btn-sm" data-act="exEdit" data-id="${e.id}">แก้</button>${e.whtAmount ? `<button class="btn btn-ghost btn-sm" data-act="exCert" data-id="${e.id}" title="พิมพ์ 50 ทวิ">50ทวิ</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">ไม่มีรายจ่ายในช่วงนี้</td></tr>'}
  </tbody></table></div>`;
}

const catOptions = sel => { const groups = {}; CATEGORIES.forEach(c => (groups[c.group] = groups[c.group] || []).push(c)); return Object.entries(groups).map(([g, cs]) => `<optgroup label="${g}">${cs.map(c => `<option value="${c.code}" ${c.code === sel ? 'selected' : ''}>${c.name}</option>`).join('')}</optgroup>`).join(''); };

export function openForm(e = null, preset = {}) {
  if (!canI(e ? 'edit' : 'add')) return;
  const d = e || { date: today(), vendorName: '', category: '', desc: '', amount: '', whtRate: 0, channel: 'BSV002', status: 'paid', ...preset };
  const vendors = S.contacts.filter(c => c.type === 'vendor');
  openModal(`<h2>${e ? 'แก้ไขรายจ่าย ' + esc(e.no) : 'บันทึกรายจ่าย'}</h2>
  <form data-submit="exSave" id="exForm">
    <input type="hidden" name="id" value="${esc(d.id || '')}">
    <div class="grid g2">
      <div class="field"><label class="f">วันที่</label><input name="date" type="date" value="${d.date}" required></div>
      <div class="field"><label class="f">สถานะ</label><div class="seg"><button type="button" class="${d.status !== 'unpaid' ? 'on' : ''}" data-act="exStatus" data-v="paid">จ่ายแล้ว</button><button type="button" class="${d.status === 'unpaid' ? 'on' : ''}" data-act="exStatus" data-v="unpaid">ค้างจ่าย</button></div><input type="hidden" name="status" value="${d.status || 'paid'}"></div>
    </div>
    <div class="field"><label class="f">ผู้ขาย / ผู้รับเงิน</label><input name="vendorName" list="vendorList" value="${esc(d.vendorName)}" required placeholder="พิมพ์ชื่อ เลือกจากรายชื่อเดิมได้"><datalist id="vendorList">${vendors.map(v => `<option value="${esc(v.name)}">`).join('')}</datalist></div>
    <div class="grid g2">
      <div class="field"><label class="f">หมวด</label><select name="category" required><option value="">เลือกหมวด</option>${catOptions(d.category)}</select></div>
      <div class="field"><label class="f">รายละเอียด (ถ้ามี)</label><input name="desc" value="${esc(d.desc || '')}" placeholder="เช่น ค่าเช่า พ.ย. 69"></div>
    </div>
    <div class="grid g3">
      <div class="field"><label class="f">ยอดตามบิล (ก่อนหัก ณ ที่จ่าย)</label><input name="amount" type="number" step="0.01" min="0" value="${d.amount}" required data-input="exCalc"></div>
      <div class="field"><label class="f">หัก ณ ที่จ่าย</label><select name="whtRate" data-on="exCalc">${WHT_RATES.map(r => `<option value="${r}" ${Number(d.whtRate) === r ? 'selected' : ''}>${r === 0 ? 'ไม่หัก' : r + '%'}</option>`).join('')}</select></div>
      <div class="field"><label class="f">จ่ายจริง</label><input id="exPaid" value="${fmt(d.paid ?? d.amount)}" readonly style="background:#f6f0ea;font-weight:700"></div>
    </div>
    <div class="grid g2">
      <div class="field"><label class="f">จ่ายจากช่องทาง</label><select name="channel">${CHANNELS.map(c => `<option value="${c.id}" ${c.id === d.channel ? 'selected' : ''}>${c.name}${c.type === 'director' ? ' (อาจารย์จ่ายแทน)' : ''}</option>`).join('')}</select></div>
      <div class="field"><label class="f">รูปบิล</label><input type="file" accept="image/*" capture="environment" data-on="exPhoto">${d.attachment ? `<img src="${d.attachment}" style="max-height:80px;border-radius:8px;margin-top:6px">` : ''}<input type="hidden" name="attachment" value="${esc(d.attachment || '')}"></div>
    </div>
    <div id="whtHint" class="small muted"></div>
    <div class="row mt" style="justify-content:space-between">
      <span>${e && S.role === 'owner' ? `<button type="button" class="btn btn-ghost" data-act="exDelete" data-id="${e.id}">ลบ</button>` : ''}</span>
      <span class="row"><button type="button" class="btn btn-outline" data-act="closeModal">ยกเลิก</button><button class="btn btn-gold">บันทึก</button></span>
    </div>
  </form>`);
  calc();
}
function calc() {
  const f = document.getElementById('exForm'); if (!f) return;
  const amt = Number(f.amount.value) || 0, rate = Number(f.whtRate.value) || 0;
  const wht = round2(amt * rate / 100);
  f.querySelector('#exPaid').value = fmt(amt - wht);
  const v = f.vendorName.value;
  const form = whtForm({ vendorName: v }, S.contacts);
  f.querySelector('#whtHint').textContent = rate ? `หัก ${fmt(wht)} บาท → ออกหนังสือรับรอง 50 ทวิ และนำส่ง ${form === 'PND53' ? 'ภ.ง.ด.53 (นิติบุคคล)' : 'ภ.ง.ด.3 (บุคคลธรรมดา)'} ภายในวันที่ 7 ของเดือนถัดไป` : 'แนวทาง: ค่าเช่า 5% · ค่าบริการ/ค่าจ้าง/โฆษณา 3% · ค่าขนส่ง 1% · ซื้อสินค้า ไม่หัก';
}

function certHtml(e) {
  const c = S.settings.company; const v = S.contacts.find(x => x.name === e.vendorName) || {};
  const form = whtForm(e, S.contacts);
  const base = e.whtBase || e.amount;
  return `<div class="cert">
    <h3>หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</h3>
    <table class="nb"><tr><td style="width:50%"><b>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</b><br>${esc(c.name)}<br>เลขประจำตัวผู้เสียภาษี ${esc(c.taxId || '__________________')}<br>${esc(c.address)}</td>
    <td><b>ผู้ถูกหักภาษี ณ ที่จ่าย</b><br>${esc(e.vendorName)}<br>เลขประจำตัวผู้เสียภาษี ${esc(v.taxId || '__________________')}<br>${esc(v.address || '')}</td></tr></table>
    <p style="margin-top:6px">เล่มที่/เลขที่ <b>${esc(e.whtNo || e.no)}</b> &nbsp; แบบ ${form === 'PND53' ? '☐ ภ.ง.ด.3 &nbsp; ☑ ภ.ง.ด.53' : '☑ ภ.ง.ด.3 &nbsp; ☐ ภ.ง.ด.53'}</p>
    <table><thead><tr><th>ประเภทเงินได้พึงประเมินที่จ่าย</th><th style="width:110px">วัน เดือน ปี ที่จ่าย</th><th style="width:120px">จำนวนเงินที่จ่าย</th><th style="width:120px">ภาษีที่หักและนำส่งไว้</th></tr></thead>
    <tbody><tr><td>${esc(cat(e.category).name)}${e.desc ? ' — ' + esc(e.desc) : ''} (${e.whtRate}%)</td><td class="center">${thDate(e.paidDate || e.date, true)}</td><td class="num">${fmt(base)}</td><td class="num">${fmt(e.whtAmount)}</td></tr>
    <tr><td colspan="2" class="right"><b>รวมเงินที่จ่ายและภาษีที่หักนำส่ง</b></td><td class="num"><b>${fmt(base)}</b></td><td class="num"><b>${fmt(e.whtAmount)}</b></td></tr></tbody></table>
    <p style="margin-top:6px">รวมเงินภาษีที่หักนำส่ง (ตัวอักษร) <b>${bahtText(e.whtAmount)}</b></p>
    <p>ผู้จ่ายเงิน ☑ หัก ณ ที่จ่าย &nbsp; ☐ ออกให้ตลอดไป &nbsp; ☐ ออกให้ครั้งเดียว</p>
    <p style="margin-top:28px">ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</p>
    <p style="text-align:right;margin-top:30px">ลงชื่อ ........................................ ผู้จ่ายเงิน<br>วันที่ ${thDate(today(), true)}</p>
  </div>`;
}
export function bahtText(n) {
  const num = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'], pos = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  const read = s => { let out = ''; const L = s.length; for (let i = 0; i < L; i++) { const d = +s[i], p = L - i - 1; if (!d) continue; if (p === 0 && d === 1 && L > 1) out += 'เอ็ด'; else if (p === 1 && d === 2) out += 'ยี่สิบ'; else if (p === 1 && d === 1) out += 'สิบ'; else out += num[d] + pos[p]; } return out; };
  n = round2(n); const b = Math.floor(n), s = Math.round((n - b) * 100);
  let t = b ? (b >= 1e6 ? read(String(Math.floor(b / 1e6))) + 'ล้าน' + read(String(b % 1e6).padStart(1, '0')) : read(String(b))) + 'บาท' : '';
  return (t || 'ศูนย์บาท') + (s ? read(String(s)) + 'สตางค์' : 'ถ้วน');
}

reg({
  exMonth: el => { S.ui.ex.month = el.value; rerender(); },
  exCat: el => { S.ui.ex.cat = el.value; rerender(); },
  exQ: el => { S.ui.ex.q = el.value; clearTimeout(S.ui.exT); S.ui.exT = setTimeout(rerender, 250); },
  exNew: () => openForm(),
  exEdit: el => openForm(S.expenses.find(x => x.id === el.dataset.id)),
  exStatus: el => { const f = el.closest('form'); f.status.value = el.dataset.v; f.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b === el)); },
  exCalc: () => calc(),
  async exPhoto(el) { if (!el.files[0]) return; toast('กำลังย่อรูป…'); const data = await shrinkImage(el.files[0]); el.closest('form').attachment.value = data; toast('แนบรูปแล้ว'); },
  async exSave(f) {
    const d = formData(f);
    if (!d.amount || d.amount < 0) return toast('กรอกยอดเงิน');
    const old = d.id ? S.expenses.find(x => x.id === d.id) : null;
    const wht = round2(d.amount * d.whtRate / 100);
    const doc = { ...(old || {}), id: d.id || uid('E'), date: d.date, vendorName: d.vendorName, category: d.category, desc: d.desc, amount: round2(d.amount),
      whtRate: d.whtRate, whtBase: d.whtRate ? round2(d.amount) : 0, whtAmount: wht, paid: round2(d.amount - wht), channel: d.status === 'unpaid' ? '' : d.channel, status: d.status, attachment: d.attachment || '' };
    if (!doc.no) doc.no = nextNo(S.expenses, 'EXP', d.date);
    if (wht && !doc.whtNo) doc.whtNo = nextNo(S.expenses.map(x => ({ no: x.whtNo })), 'WHT', d.date);
    if (d.status === 'paid' && (!old || old.status === 'unpaid')) doc.paidDate = d.date;
    doc.source = doc.source || 'manual';
    // ผู้ขายใหม่ → เพิ่มในผู้ติดต่ออัตโนมัติ
    if (d.vendorName && !S.contacts.some(c => c.name === d.vendorName)) await saveDoc('acc_contacts', { id: uid('V'), type: 'vendor', name: d.vendorName, taxId: '', phone: '', juristic: /บริษัท|จำกัด|บจก|หจก|สำนักงาน|มหาชน/.test(d.vendorName), source: 'auto' });
    doc.whtRate = Number(d.whtRate) || 0;
    await saveDoc('acc_expenses', doc); closeModal(); toast('บันทึกรายจ่าย ' + doc.no + ' แล้ว');
    // ถ้าสร้างจากบรรทัด statement ให้จับคู่ให้เลย
    if (S.ui.recPending) { const s = S.statements.find(x => x.id === S.ui.recPending); S.ui.recPending = null; if (s) await saveDoc('acc_statements', { ...s, matchedTo: { type: 'expense', id: doc.id }, matchKind: 'created' }); }
  },
  async exDelete(el) { if (!canI('delete')) return; if (!await confirmBox('ลบรายจ่ายนี้ถาวร?')) return; await removeDoc('acc_expenses', el.dataset.id); closeModal(); toast('ลบแล้ว'); },
  exCert(el) { const e = S.expenses.find(x => x.id === el.dataset.id); openModal(certHtml(e) + `<div class="row mt noprint" style="justify-content:flex-end"><button class="btn btn-outline" data-act="closeModal">ปิด</button><button class="btn btn-gold" data-act="printModal">🖨 พิมพ์</button></div>`, { wide: true }); },
  printModal() { const m = modalEl().querySelector('.modal').innerHTML; const w = window.open('', '_blank'); w.document.write(`<html><head><meta charset="utf-8"><title>พิมพ์</title><link rel="stylesheet" href="${location.origin + location.pathname.replace(/[^/]*$/, '')}styles.css"></head><body style="background:#fff">${m}<script>setTimeout(()=>print(),400)</script></body></html>`); w.document.close(); },
  exExport() {
    const ui = S.ui.ex; const rows = S.expenses.filter(e => !ui.month || monthKey(e.date) === ui.month);
    const head = csvRow(['เลขที่', 'วันที่', 'ผู้ขาย', 'รายละเอียด', 'รหัสหมวด', 'หมวด', 'ยอด', 'อัตราหัก', 'หัก ณ ที่จ่าย', 'จ่ายจริง', 'ช่องทาง', 'สถานะ', 'แบบ', 'เลขที่ 50ทวิ']);
    downloadText(`expenses_${ui.month || 'all'}.csv`, [head, ...rows.map(e => csvRow([e.no, e.date, e.vendorName, e.desc, e.category, cat(e.category).name, e.amount, e.whtRate, e.whtAmount, e.paid, chan(e.channel).short, e.status, e.whtAmount ? whtForm(e, S.contacts) : '', e.whtNo]))].join('\n'));
  },
});
