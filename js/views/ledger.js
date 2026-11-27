// หน้า "บัญชี": สมุดรายวัน แยกประเภท งบทดลอง งบกำไรขาดทุน งบฐานะการเงิน (สร้างอัตโนมัติจากเอกสาร)
import { S, reg, rerender, openModal } from '../core.js';
import { buildJournal, ledger, trialBalance, profitLoss, balanceSheet, acct, ACCOUNTS } from '../journal.js';
import { fmt, esc, thDate, monthKey, today, fiscalYear, fiscalRange, thMonth, monthsBetween, downloadText, csvRow } from '../util.js';

const BOOKS = { all: 'ทั้งหมด', RV: 'รายวันรับ', PV: 'รายวันจ่าย', JV: 'รายวันทั่วไป' };
const n = v => v ? fmt(v) : '';

export function render() {
  const ui = S.ui.lg = S.ui.lg || { tab: 'journal', book: 'all', month: monthKey(today()), acct: '111302', fy: fiscalYear(today()), asOf: today() };
  const { from: fyFrom, to: fyTo } = fiscalRange(ui.fy);
  const J = buildJournal(S);
  const unbalanced = J.filter(j => !j.balanced);
  const months = monthsBetween(monthKey(fyFrom), monthKey(today()) < monthKey(fyTo) ? monthKey(today()) : monthKey(fyTo)).reverse();
  const tabs = [['journal', 'สมุดรายวัน'], ['ledger', 'แยกประเภท'], ['tb', 'งบทดลอง'], ['pl', 'งบกำไรขาดทุน'], ['bs', 'งบฐานะการเงิน']];
  const period = ui.month ? { from: ui.month + '-01', to: ui.month + '-31', label: thMonth(ui.month) } : { from: fyFrom, to: fyTo, label: `ปีบัญชี ${ui.fy + 542}/${String(ui.fy + 543).slice(2)}` };
  return `
  <div class="topbar"><h1>บัญชี</h1><div class="row">
    <select data-on="lgFy" style="width:auto">${[ui.fy - 1, ui.fy, ui.fy + 1].map(y => `<option value="${y}" ${y === ui.fy ? 'selected' : ''}>ปีบัญชี ${y + 542}/${String(y + 543).slice(2)}</option>`).join('')}</select>
    ${ui.tab !== 'bs' ? `<select data-on="lgMonth" style="width:auto"><option value="">ทั้งปีบัญชี</option>${months.map(m => `<option value="${m}" ${m === ui.month ? 'selected' : ''}>${thMonth(m)}</option>`).join('')}</select>` : `<input type="date" data-on="lgAsOf" value="${ui.asOf}" style="width:auto">`}
    <button class="btn btn-outline btn-sm" data-act="lgExport">⬇ CSV</button></div></div>
  ${unbalanced.length ? `<div class="alert red">มีรายการที่เดบิต/เครดิตไม่เท่ากัน ${unbalanced.length} รายการ: ${esc(unbalanced.map(j => j.no).join(', '))}</div>` : ''}
  <div class="card"><div class="seg">${tabs.map(([k, t]) => `<button class="${ui.tab === k ? 'on' : ''}" data-act="lgTab" data-v="${k}">${t}</button>`).join('')}</div></div>
  ${ui.tab === 'journal' ? journal(J, period, ui) : ui.tab === 'ledger' ? ledgerView(J, period, ui) : ui.tab === 'tb' ? tbView(J, period) : ui.tab === 'pl' ? plView(J, period) : bsView(J, ui.asOf, fyFrom)}
  <p class="small muted">สมุดรายวันทุกรายการสร้างอัตโนมัติจากใบเสร็จ รายจ่าย รายการโอน และยอดยกมา แก้ไขที่เอกสารต้นทางแล้วตัวเลขจะเปลี่ยนตาม · ยังไม่มีค่าเสื่อมราคาและปรับสินค้าคงเหลือ (ลงเป็นรายวันทั่วไปตอนปิดปีโดยสำนักงานบัญชี) · รหัสธนาคาร 111302/111303 เป็นบัญชีย่อยของ 111301 ใน PEAK</p>`;
}

function journal(J, p, ui) {
  const list = J.filter(j => j.date >= p.from && j.date <= p.to && (ui.book === 'all' || j.book === ui.book));
  return `<div class="card"><div class="row"><div class="seg">${Object.entries(BOOKS).map(([k, t]) => `<button class="${ui.book === k ? 'on' : ''}" data-act="lgBook" data-v="${k}">${t}</button>`).join('')}</div><span class="grow"></span><span class="small">${list.length} รายการ · ${p.label}</span></div></div>
  <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>เลขที่</th><th>สมุด</th><th>รายการ / บัญชี</th><th class="right">เดบิต</th><th class="right">เครดิต</th></tr></thead><tbody>
  ${list.map(j => `<tr style="background:#FBF6F2"><td>${thDate(j.date)}</td><td class="small">${esc(j.no)}</td><td class="small">${BOOKS[j.book]}</td><td><b>${esc(j.desc)}</b></td><td class="num">${fmt(j.dr)}</td><td class="num">${fmt(j.cr)}</td></tr>
    ${j.lines.map(l => `<tr><td></td><td></td><td></td><td class="small" style="padding-left:${l.cr ? 40 : 20}px">${l.acct} ${esc(acct(l.acct).name)}</td><td class="num small">${n(l.dr)}</td><td class="num small">${n(l.cr)}</td></tr>`).join('')}`).join('') || '<tr><td colspan="6" class="empty">ไม่มีรายการ</td></tr>'}
  </tbody></table></div>`;
}
function ledgerView(J, p, ui) {
  const codes = [...new Set(J.flatMap(j => j.lines.map(l => l.acct)))].sort();
  const L = ledger(J, ui.acct, p.from, p.to); const a = acct(ui.acct);
  return `<div class="card"><div class="row"><select data-on="lgAcct" style="max-width:420px">${codes.map(c => `<option value="${c}" ${c === ui.acct ? 'selected' : ''}>${c} ${esc(acct(c).name)}</option>`).join('')}</select><span class="small muted">${a.type === 'A' || a.type === 'X' ? 'ยอดปกติเดบิต' : 'ยอดปกติเครดิต'} · ${p.label}</span></div></div>
  <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>เลขที่</th><th>รายการ</th><th class="right">เดบิต</th><th class="right">เครดิต</th><th class="right">คงเหลือ</th></tr></thead><tbody>
    <tr><td></td><td></td><td><b>ยอดยกมา</b></td><td></td><td></td><td class="num"><b>${fmt(L.open)}</b></td></tr>
    ${L.rows.map(r => `<tr><td>${thDate(r.date)}</td><td class="small">${esc(r.no)}</td><td class="small">${esc(r.desc)}</td><td class="num">${n(r.dr)}</td><td class="num">${n(r.cr)}</td><td class="num ${r.bal < 0 ? 'neg' : ''}">${fmt(r.bal)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">ไม่มีรายการในช่วงนี้</td></tr>'}
  </tbody><tfoot><tr><td colspan="3">รวม / ยอดยกไป</td><td class="num">${fmt(L.rows.reduce((s, r) => s + r.dr, 0))}</td><td class="num">${fmt(L.rows.reduce((s, r) => s + r.cr, 0))}</td><td class="num">${fmt(L.close)}</td></tr></tfoot></table></div>`;
}
function tbView(J, p) {
  const T = trialBalance(J, p.from, p.to);
  return `<div class="card tbl-wrap"><div class="card-title">งบทดลอง ${p.label} (ก่อนปิดบัญชี)</div><table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อบัญชี</th><th class="right">ยกมา Dr</th><th class="right">ยกมา Cr</th><th class="right">เดบิต</th><th class="right">เครดิต</th><th class="right">คงเหลือ Dr</th><th class="right">คงเหลือ Cr</th></tr></thead><tbody>
    ${T.rows.map(r => `<tr><td class="small">${r.code}</td><td class="small">${esc(r.name)}</td><td class="num">${n(r.openDr)}</td><td class="num">${n(r.openCr)}</td><td class="num">${n(r.dr)}</td><td class="num">${n(r.cr)}</td><td class="num">${n(r.closeDr)}</td><td class="num">${n(r.closeCr)}</td></tr>`).join('')}
  </tbody><tfoot><tr><td colspan="2">รวม</td><td class="num">${fmt(T.total.openDr)}</td><td class="num">${fmt(T.total.openCr)}</td><td class="num">${fmt(T.total.dr)}</td><td class="num">${fmt(T.total.cr)}</td><td class="num">${fmt(T.total.closeDr)}</td><td class="num">${fmt(T.total.closeCr)}</td></tr></tfoot></table>
  ${Math.abs(T.total.closeDr - T.total.closeCr) > 0.005 ? '<div class="alert red mt">งบทดลองไม่ลงตัว ตรวจรายการที่เดบิต/เครดิตไม่เท่ากัน</div>' : '<div class="alert ok mt">งบทดลองลงตัว</div>'}</div>`;
}
function plView(J, p) {
  const P = profitLoss(J, p.from, p.to);
  const sec = (title, rows, total) => `<tr style="background:#FBF6F2"><td colspan="2"><b>${title}</b></td><td class="num"><b>${fmt(total)}</b></td></tr>${rows.map(r => `<tr><td class="small">${r.code}</td><td>${esc(r.name)}</td><td class="num">${fmt(r.amount)}</td></tr>`).join('')}`;
  return `<div class="card"><div class="card-title">งบกำไรขาดทุน ${p.label}</div><table class="tbl"><thead><tr><th>รหัส</th><th>รายการ</th><th class="right">บาท</th></tr></thead><tbody>
    ${sec('รายได้', P.rev, P.revenue)}
    ${sec('ต้นทุนขายและบริการ', P.cogs, P.tCogs)}
    <tr><td></td><td><b>กำไรขั้นต้น</b></td><td class="num"><b>${fmt(P.grossProfit)}</b></td></tr>
    ${sec('ค่าใช้จ่ายในการขายและการตลาด', P.sell, P.tSell)}
    ${sec('ค่าใช้จ่ายในการบริหาร', P.admin, P.tAdmin)}
  </tbody><tfoot><tr><td></td><td>กำไร (ขาดทุน) สุทธิ</td><td class="num ${P.profit >= 0 ? 'pos' : 'neg'}">${fmt(P.profit)}</td></tr></tfoot></table>
  <p class="small muted mt">ส่วนลดจ่ายแสดงเป็นรายได้ติดลบ · ยังไม่รวมค่าเสื่อมราคาและภาษีเงินได้นิติบุคคล</p></div>`;
}
function bsView(J, asOf, fyFrom) {
  const B = balanceSheet(J, asOf, fyFrom);
  const rows = (list) => list.map(r => `<tr><td class="small">${r.code}</td><td>${esc(r.name)}</td><td class="num">${fmt(r.amount)}</td></tr>`).join('');
  return `<div class="grid g2">
    <div class="card"><div class="card-title">สินทรัพย์ ณ ${thDate(asOf, true)}</div><table class="tbl"><tbody>${rows(B.assets)}</tbody><tfoot><tr><td colspan="2">รวมสินทรัพย์</td><td class="num">${fmt(B.tA)}</td></tr></tfoot></table></div>
    <div class="card"><div class="card-title">หนี้สินและส่วนของเจ้าของ</div><table class="tbl"><tbody>${rows(B.liab)}<tr><td colspan="2"><b>รวมหนี้สิน</b></td><td class="num"><b>${fmt(B.tL)}</b></td></tr>${rows(B.eq)}<tr><td></td><td>กำไร (ขาดทุน) งวดปัจจุบัน</td><td class="num ${B.profit >= 0 ? 'pos' : 'neg'}">${fmt(B.profit)}</td></tr><tr><td colspan="2"><b>รวมส่วนของเจ้าของ</b></td><td class="num"><b>${fmt(B.tE)}</b></td></tr></tbody><tfoot><tr><td colspan="2">รวมหนี้สินและส่วนของเจ้าของ</td><td class="num">${fmt(B.tL + B.tE)}</td></tr></tfoot></table>
    ${Math.abs(B.diff) > 0.005 ? `<div class="alert red mt">งบไม่ดุล ต่าง ${fmt(B.diff)}</div>` : '<div class="alert ok mt">งบดุล</div>'}</div>
  </div>
  <div class="alert warn">ยอดยกมาของสินค้า สินทรัพย์ เจ้าหนี้ ทุน และกำไรสะสม ตั้งตามงบ PEAK ณ 30 ก.ย. 69 (แก้ได้ที่ ตั้งค่า) · บรรทัด 333000 คือผลต่างจากการตั้งเงินสด/ธนาคารยกมาตามยอดจริงแทนสมุด PEAK ซึ่งสำนักงานบัญชีต้องปรับปรุง</div>`;
}

reg({
  lgTab: el => { S.ui.lg.tab = el.dataset.v; rerender(); },
  lgBook: el => { S.ui.lg.book = el.dataset.v; rerender(); },
  lgFy: el => { S.ui.lg.fy = Number(el.value); S.ui.lg.month = ''; rerender(); },
  lgMonth: el => { S.ui.lg.month = el.value; rerender(); },
  lgAsOf: el => { S.ui.lg.asOf = el.value; rerender(); },
  lgAcct: el => { S.ui.lg.acct = el.value; rerender(); },
  lgExport() {
    const ui = S.ui.lg; const J = buildJournal(S); const { from, to } = fiscalRange(ui.fy); const p = ui.month ? { from: ui.month + '-01', to: ui.month + '-31' } : { from, to };
    let lines = [];
    if (ui.tab === 'journal') { lines.push(csvRow(['วันที่', 'เลขที่', 'สมุด', 'รายการ', 'รหัสบัญชี', 'ชื่อบัญชี', 'เดบิต', 'เครดิต'])); J.filter(j => j.date >= p.from && j.date <= p.to).forEach(j => j.lines.forEach(l => lines.push(csvRow([j.date, j.no, BOOKS[j.book], j.desc, l.acct, acct(l.acct).name, l.dr || '', l.cr || ''])))); }
    else if (ui.tab === 'ledger') { const L = ledger(J, ui.acct, p.from, p.to); lines.push(csvRow(['บัญชี', ui.acct, acct(ui.acct).name]), csvRow(['วันที่', 'เลขที่', 'รายการ', 'เดบิต', 'เครดิต', 'คงเหลือ']), csvRow(['', '', 'ยอดยกมา', '', '', L.open])); L.rows.forEach(r => lines.push(csvRow([r.date, r.no, r.desc, r.dr || '', r.cr || '', r.bal]))); }
    else if (ui.tab === 'tb') { const T = trialBalance(J, p.from, p.to); lines.push(csvRow(['รหัส', 'ชื่อบัญชี', 'ยกมา Dr', 'ยกมา Cr', 'เดบิต', 'เครดิต', 'คงเหลือ Dr', 'คงเหลือ Cr'])); T.rows.forEach(r => lines.push(csvRow([r.code, r.name, r.openDr, r.openCr, r.dr, r.cr, r.closeDr, r.closeCr]))); }
    else if (ui.tab === 'pl') { const P = profitLoss(J, p.from, p.to); lines.push(csvRow(['รหัส', 'รายการ', 'บาท'])); [...P.rev, ...P.cogs, ...P.sell, ...P.admin].forEach(r => lines.push(csvRow([r.code, r.name, r.amount]))); lines.push(csvRow(['', 'กำไร(ขาดทุน)สุทธิ', P.profit])); }
    else { const B = balanceSheet(J, ui.asOf, from); lines.push(csvRow(['ส่วน', 'รหัส', 'รายการ', 'บาท'])); B.assets.forEach(r => lines.push(csvRow(['สินทรัพย์', r.code, r.name, r.amount]))); B.liab.forEach(r => lines.push(csvRow(['หนี้สิน', r.code, r.name, r.amount]))); B.eq.forEach(r => lines.push(csvRow(['ส่วนของเจ้าของ', r.code, r.name, r.amount]))); lines.push(csvRow(['ส่วนของเจ้าของ', '', 'กำไร(ขาดทุน)งวดปัจจุบัน', B.profit])); }
    downloadText(`${ui.tab}_${ui.month || 'FY' + ui.fy}.csv`, lines.join('\n'));
  },
});
