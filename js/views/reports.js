import { S, reg, rerender, openModal } from '../core.js';
import { monthly, whtSummary, cat, CATEGORIES, isExpenseCat, balances, CHANNELS } from '../model.js';
import { fmt, fmt0, esc, thMonth, monthKey, today, monthsBetween, addMonths, fiscalYear, fiscalRange, downloadText, csvRow, sum } from '../util.js';

export function render() {
  const ui = S.ui.rp = S.ui.rp || { tab: 'pl', fy: fiscalYear(today()) };
  const { from, to } = fiscalRange(ui.fy);
  const cur = monthKey(today());
  const months = monthsBetween(monthKey(from), monthKey(to) < cur ? monthKey(to) : cur);
  const tabs = [['pl', 'กำไรขาดทุนรายเดือน'], ['wht', 'ภาษีหัก ณ ที่จ่าย'], ['cat', 'ค่าใช้จ่ายตามหมวด'], ['pos', 'ฐานะเงินสด']];
  return `
  <div class="topbar"><h1>รายงาน</h1><div class="row">
    <select data-on="rpFy" style="width:auto">${[ui.fy - 1, ui.fy, ui.fy + 1].map(y => `<option value="${y}" ${y === ui.fy ? 'selected' : ''}>ปีบัญชี ${y + 543 - 1}/${String(y + 543).slice(2)} (ต.ค.–ก.ย.)</option>`).join('')}</select>
    <button class="btn btn-outline btn-sm" data-act="rpExport">⬇ CSV สำหรับผู้ตรวจ</button></div></div>
  <div class="card"><div class="seg">${tabs.map(([k, t]) => `<button class="${ui.tab === k ? 'on' : ''}" data-act="rpTab" data-v="${k}">${t}</button>`).join('')}</div></div>
  ${ui.tab === 'pl' ? pl(months) : ui.tab === 'wht' ? wht(months) : ui.tab === 'cat' ? byCat(months) : position()}`;
}
function pl(months) {
  const ms = monthly(S, months);
  const tot = k => sum(ms, x => x[k]);
  return `<div class="card tbl-wrap"><table class="tbl"><thead><tr><th>เดือน</th><th class="right">ใบเสร็จ</th><th class="right">รายได้บริการ</th><th class="right">รายได้สินค้า</th><th class="right">ส่วนลด</th><th class="right">รายได้สุทธิ</th><th class="right">ค่าใช้จ่าย</th><th class="right">กำไร/ขาดทุน</th></tr></thead><tbody>
    ${ms.map(x => `<tr><td>${thMonth(x.month)}</td><td class="num">${x.bills}</td><td class="num">${fmt(x.service)}</td><td class="num">${fmt(x.product)}</td><td class="num">${fmt(x.discount)}</td><td class="num"><b>${fmt(x.revenue)}</b></td><td class="num">${fmt(x.expense)}</td><td class="num ${x.profit >= 0 ? 'pos' : 'neg'}"><b>${fmt(x.profit)}</b></td></tr>`).join('')}
  </tbody><tfoot><tr><td>รวมปีบัญชี</td><td class="num">${tot('bills')}</td><td class="num">${fmt(tot('service'))}</td><td class="num">${fmt(tot('product'))}</td><td class="num">${fmt(tot('discount'))}</td><td class="num">${fmt(tot('revenue'))}</td><td class="num">${fmt(tot('expense'))}</td><td class="num ${tot('profit') >= 0 ? 'pos' : 'neg'}">${fmt(tot('profit'))}</td></tr></tfoot></table></div>
  <p class="small muted">รายได้สุทธิ = ราคาเต็ม − ส่วนลด (เครดิตสะสม) · ค่าใช้จ่ายนับเฉพาะหมวด 5xxxxx ไม่รวมซื้อสินทรัพย์และนำส่งภาษี · ยังไม่หักค่าเสื่อมราคาและต้นทุนสินค้าคงเหลือ (เฟส 2)</p>`;
}
function wht(months) {
  const rows = whtSummary(S, months);
  return `<div class="card tbl-wrap"><table class="tbl"><thead><tr><th>เดือนที่จ่าย</th><th>แบบ</th><th class="right">จำนวนราย</th><th class="right">เงินได้ที่จ่าย</th><th class="right">ภาษีที่หัก</th><th>กำหนดยื่น</th></tr></thead><tbody>
    ${rows.map(r => `<tr data-act="rpWhtDetail" data-k="${r.month}|${r.form}" style="cursor:pointer"><td>${thMonth(r.month)}</td><td>${r.form === 'PND53' ? 'ภ.ง.ด.53 (นิติบุคคล)' : 'ภ.ง.ด.3 (บุคคลธรรมดา)'}</td><td class="num">${r.count}</td><td class="num">${fmt(r.base)}</td><td class="num"><b>${fmt(r.wht)}</b></td><td class="small muted">ภายใน 7 ${thMonth(addMonths(r.month, 1), false)} (ออนไลน์ 15)</td></tr>`).join('') || '<tr><td colspan="6" class="empty">ไม่มีรายการหัก ณ ที่จ่ายในปีนี้</td></tr>'}
  </tbody></table></div><p class="small muted">กดแถวเพื่อดูรายชื่อ · พิมพ์หนังสือรับรอง 50 ทวิ ได้จากหน้ารายจ่าย (ปุ่ม 50ทวิ)</p>`;
}
function byCat(months) {
  const ms = monthly(S, months);
  const codes = [...new Set(ms.flatMap(m => Object.keys(m.byCat)))].sort();
  return `<div class="card tbl-wrap"><table class="tbl"><thead><tr><th>หมวด</th>${months.map(m => `<th class="right">${thMonth(m, false)}</th>`).join('')}<th class="right">รวม</th></tr></thead><tbody>
    ${codes.map(c => `<tr><td>${esc(cat(c).name)}<br><span class="small muted">${c}</span></td>${ms.map(m => `<td class="num">${m.byCat[c] ? fmt0(m.byCat[c]) : ''}</td>`).join('')}<td class="num"><b>${fmt0(sum(ms, m => m.byCat[c] || 0))}</b></td></tr>`).join('')}
  </tbody><tfoot><tr><td>รวม</td>${ms.map(m => `<td class="num">${fmt0(m.expense)}</td>`).join('')}<td class="num">${fmt0(sum(ms, m => m.expense))}</td></tr></tfoot></table></div>`;
}
function position() {
  const bal = balances(S); const op = S.settings.opening;
  return `<div class="card"><div class="card-title">เงินสดและเงินฝาก ณ วันนี้ เทียบยอดยกมา ${esc(op.date)}</div><table class="tbl"><thead><tr><th>ช่องทาง</th><th class="right">ยอดยกมา</th><th class="right">ปัจจุบัน</th></tr></thead><tbody>
    ${CHANNELS.filter(c => c.type !== 'director').map(c => `<tr><td>${esc(c.name)}</td><td class="num">${fmt(op.balances[c.id])}</td><td class="num ${bal[c.id] < 0 ? 'neg' : ''}"><b>${fmt(bal[c.id])}</b></td></tr>`).join('')}
    <tr><td>รวมเงินสดและเงินฝาก</td><td class="num">${fmt(sum(CHANNELS.filter(c => c.type !== 'director'), c => op.balances[c.id]))}</td><td class="num"><b>${fmt(sum(CHANNELS.filter(c => c.type !== 'director'), c => bal[c.id]))}</b></td></tr>
    <tr><td>หนี้สิน: เงินกู้ยืมกรรมการ</td><td class="num">${fmt(-op.balances.DIR)}</td><td class="num"><b>${fmt(-bal.DIR)}</b></td></tr>
    <tr><td>หนี้สิน: รายจ่ายค้างจ่าย</td><td class="num">-</td><td class="num"><b>${fmt(sum(S.expenses.filter(e => e.status === 'unpaid'), e => e.paid))}</b></td></tr>
    <tr><td>หนี้สิน: ภาษีหัก ณ ที่จ่ายรอนำส่ง (หักแล้ว − นำส่งแล้ว − ผู้รับเงินนำส่งเอง)</td><td class="num">-</td><td class="num"><b>${fmt(sum(S.expenses.filter(e => e.whtRemitted !== 'vendor'), e => e.whtAmount) - sum(S.expenses.filter(e => e.category === '215200'), e => e.amount))}</b></td></tr>
  </tbody></table></div>
  ${!op.cashConfirmed ? '<div class="alert warn">ยอดเงินสดยกมายังไม่ยืนยันจากการนับจริง</div>' : ''}`;
}
reg({
  rpTab: el => { S.ui.rp.tab = el.dataset.v; rerender(); },
  rpFy: el => { S.ui.rp.fy = Number(el.value); rerender(); },
  rpWhtDetail(el) {
    const [month, form] = el.dataset.k.split('|'); const r = whtSummary(S, [month]).find(x => x.form === form);
    openModal(`<h2>${form === 'PND53' ? 'ภ.ง.ด.53' : 'ภ.ง.ด.3'} ${thMonth(month)}</h2><table class="tbl"><thead><tr><th>วันที่</th><th>ผู้ถูกหัก</th><th>เลขผู้เสียภาษี</th><th>ประเภท</th><th class="right">เงินได้</th><th class="right">อัตรา</th><th class="right">ภาษี</th></tr></thead><tbody>
      ${r.list.map(e => { const v = S.contacts.find(c => c.name === e.vendorName) || {}; return `<tr><td>${esc(e.date)}</td><td>${esc(e.vendorName)}</td><td>${esc(v.taxId || '<span class="neg">ไม่มี</span>')}</td><td class="small">${esc(cat(e.category).name)}</td><td class="num">${fmt(e.whtBase || e.amount)}</td><td class="num">${e.whtRate}%</td><td class="num">${fmt(e.whtAmount)}</td></tr>`; }).join('')}
      </tbody><tfoot><tr><td colspan="4">รวม</td><td class="num">${fmt(r.base)}</td><td></td><td class="num">${fmt(r.wht)}</td></tr></tfoot></table>
      <div class="row mt" style="justify-content:flex-end"><button class="btn btn-outline" data-act="closeModal">ปิด</button></div>`, { wide: true });
  },
  rpExport() {
    const ui = S.ui.rp; const { from, to } = fiscalRange(ui.fy);
    const rc = S.receipts.filter(r => r.day >= from && r.day <= to), ex = S.expenses.filter(e => e.date >= from && e.date <= to), tr = S.transfers.filter(t => t.date >= from && t.date <= to);
    const lines = [csvRow(['ประเภท', 'เลขที่', 'วันที่', 'คู่ค้า', 'รายละเอียด', 'หมวด/ชนิด', 'เดบิตช่องทาง', 'เครดิตช่องทาง', 'ยอด', 'หัก ณ ที่จ่าย', 'สถานะ'])];
    rc.forEach(r => lines.push(csvRow(['ใบเสร็จ', r.no, r.day, r.customerName, r.items.map(i => i.name).join(' | '), 'รายได้', r.channel, '', r.total, '', r.voided ? 'ยกเลิก' : 'ปกติ'])));
    ex.forEach(e => lines.push(csvRow(['รายจ่าย', e.no, e.date, e.vendorName, e.desc, e.category + ' ' + cat(e.category).name, '', e.channel, e.amount, e.whtAmount, e.status])));
    tr.forEach(t => lines.push(csvRow(['โอน', t.no, t.date, '', t.note, t.kind, t.to, t.from, t.amount, '', ''])));
    downloadText(`bbglow_books_FY${ui.fy}.csv`, lines.join('\n'));
  },
});
