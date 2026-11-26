// กระทบยอด statement กสิกร กับสมุด
import { S, reg, rerender, saveDoc, openModal, closeModal, formData, canI, confirmBox } from '../core.js';
import { store } from '../store.js';
import { CHANNELS, chan, balances, nextNo } from '../model.js';
import { fmt, esc, thDate, monthKey, today, toast, round2, parseCSV, parseNum, uid, thMonth, sum } from '../util.js';
import { openForm as expenseForm } from './expenses.js';
import { transferForm } from './finance.js';

const dayDiff = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);

/* ---------- นำเข้า ---------- */
function parseStatementText(text, channel) {
  // รูปแบบข้อความจาก PDF กสิกร: DD-MM-YY HH:MM ประเภท จำนวน คงเหลือ ช่องทาง รายละเอียด
  const out = []; let prev = null;
  text.split(/\n/).forEach(line => {
    const m = line.trim().match(/^(\d{2})-(\d{2})-(\d{2}) (\d{2}:\d{2}) (\S+) ([\d,]+\.\d{2}) ([\d,]+\.\d{2}) (.*)$/);
    if (!m) { if (prev && line.trim() && !/^(หน้าที่|ที่ DD|ชื่อบัญชี|รอบ|สาขา|ยอดยกไป|รวม|เวลา|วันที่|สอบถาม|ออกโดย|\d\/\d)/.test(line.trim())) prev.detail += ' ' + line.trim(); return; }
    const [, dd, mm, yy, time, type, amt, bal, detail] = m;
    const amount = parseNum(amt), balance = parseNum(bal);
    const sign = prev && prev.balance != null ? (balance > prev.balance ? 1 : -1) : (/รับ|ฝาก|เข้า/.test(type) ? 1 : -1);
    prev = { date: `20${yy}-${mm}-${dd}`, time, type, amount: round2(sign * amount), balance, detail: detail.trim(), channel };
    out.push(prev);
  });
  return out;
}
function parseStatementCSV(text, channel) {
  const rows = parseCSV(text); if (rows.length < 2) return [];
  const h = rows[0].map(x => x.trim());
  const idx = n => h.findIndex(x => x.includes(n));
  const iDate = idx('วันที่'), iOut = idx('ถอน'), iIn = idx('ฝาก'), iBal = idx('คงเหลือ'), iDet = idx('รายละเอียด'), iTime = idx('เวลา'), iType = idx('ประเภท'), iAcct = idx('บัญชี');
  if (iDate < 0 || (iOut < 0 && iIn < 0)) return [];
  return rows.slice(1).map(r => {
    let d = r[iDate].trim(); let iso;
    let m = d.match(/^(\d{2})[-/](\d{2})[-/](\d{2,4})$/);
    if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; if (+y > 2400) y = String(+y - 543); iso = `${y}-${m[2]}-${m[1]}`; } else iso = d.slice(0, 10);
    const out = iOut >= 0 ? parseNum(r[iOut]) : 0, inp = iIn >= 0 ? parseNum(r[iIn]) : 0;
    let ch = channel; if (iAcct >= 0 && r[iAcct]) ch = /0442|จ่าย/.test(r[iAcct]) ? 'BSV002' : /1753|รับ/.test(r[iAcct]) ? 'BSV001' : channel;
    return { date: iso, time: iTime >= 0 ? r[iTime] : '', type: iType >= 0 ? r[iType] : '', amount: round2(inp - out), balance: iBal >= 0 ? parseNum(r[iBal]) : null, detail: iDet >= 0 ? r[iDet] : '', channel: ch };
  }).filter(x => x.amount && x.type !== 'ยอดยกมา');
}
const hash = str => { let h = 0; for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h.toString(36); };
async function importLines(lines) {
  const have = new Set(S.statements.map(s => s.id));
  const docs = lines.map(l => ({ ...l, id: `${l.channel}-${l.date}-${l.time || '0000'}-${Math.round(Math.abs(l.amount) * 100)}-${hash(l.detail || '')}`, matchedTo: null, importedAt: new Date().toISOString() })).filter(d => !have.has(d.id));
  if (docs.length) await store.saveMany('acc_statements', docs);
  return docs.length;
}

/* ---------- จับคู่อัตโนมัติ ---------- */
function autoMatch() {
  const usedR = new Set(), usedE = new Set();
  S.statements.forEach(s => { const m = s.matchedTo; if (!m) return; if (m.type === 'receipt') usedR.add(m.id); if (m.type === 'expense') usedE.add(m.id); if (m.type === 'multi') (m.ids || []).forEach(id => (m.kind === 'receipt' ? usedR : usedE).add(id)); });
  const usedT = {}; S.statements.filter(s => s.matchedTo?.type === 'transfer').forEach(s => usedT[s.matchedTo.id + '|' + s.channel] = 1);
  const updates = [];
  // โอนระหว่างบัญชีต้องเห็นเลขบัญชีคู่กันในรายละเอียด / เงินกรรมการต้องเห็นชื่อกรรมการ กันจับผิดบรรทัด
  const fitsTransfer = (t, s) => { const other = t.from === s.channel ? t.to : t.from; const oc = chan(other); if (oc.type === 'director') return isDirector(s); if (oc.mask) return (s.detail || '').includes(oc.mask); return true; };
  S.statements.filter(s => !s.matchedTo).forEach(s => {
    const amt = Math.abs(s.amount);
    if (s.amount > 0) {
      const t = S.transfers.find(t => t.to === s.channel && t.amount === amt && dayDiff(t.date, s.date) <= 1 && !usedT[t.id + '|' + s.channel] && fitsTransfer(t, s));
      if (t) { usedT[t.id + '|' + s.channel] = 1; updates.push({ ...s, matchedTo: { type: 'transfer', id: t.id }, matchKind: 'auto' }); return; }
      const r = S.receipts.find(r => !r.voided && r.channel === s.channel && r.total === amt && dayDiff(r.day, s.date) <= 1 && !usedR.has(r.id));
      if (r) { usedR.add(r.id); updates.push({ ...s, matchedTo: { type: 'receipt', id: r.id }, matchKind: 'auto' }); }
      // ลูกค้าโอนทีเดียว 2–3 บิล: หาชุดใบเสร็จช่องเดียวกันในวันใกล้กันที่รวมได้พอดี
      const pool = S.receipts.filter(r => !r.voided && r.channel === s.channel && dayDiff(r.day, s.date) <= 1 && !usedR.has(r.id) && r.total < amt);
      const combo = findCombo(pool.map(r => ({ id: r.id, v: r.total })), amt);
      if (combo) { combo.forEach(id => usedR.add(id)); updates.push({ ...s, matchedTo: { type: 'multi', kind: 'receipt', ids: combo }, matchKind: 'auto-multi' }); }
    } else {
      const t = S.transfers.find(t => t.from === s.channel && t.amount === amt && dayDiff(t.date, s.date) <= 1 && !usedT[t.id + '|' + s.channel] && fitsTransfer(t, s));
      if (t) { usedT[t.id + '|' + s.channel] = 1; updates.push({ ...s, matchedTo: { type: 'transfer', id: t.id }, matchKind: 'auto' }); return; }
      const e = S.expenses.find(e => e.status === 'paid' && e.channel === s.channel && e.paid === amt && dayDiff(e.paidDate || e.date, s.date) <= 3 && !usedE.has(e.id));
      if (e) { usedE.add(e.id); updates.push({ ...s, matchedTo: { type: 'expense', id: e.id }, matchKind: 'auto' }); return; }
      // จ่ายทีเดียวหลายบิล (ผู้ขายเดียวกัน วันเดียวกัน)
      const pool = S.expenses.filter(e => e.status === 'paid' && e.channel === s.channel && dayDiff(e.paidDate || e.date, s.date) <= 3 && !usedE.has(e.id) && e.paid < amt);
      const combo = findCombo(pool.map(e => ({ id: e.id, v: e.paid })), amt);
      if (combo) { combo.forEach(id => usedE.add(id)); updates.push({ ...s, matchedTo: { type: 'multi', kind: 'expense', ids: combo }, matchKind: 'auto-multi' }); }
    }
  });
  return updates;
}
/** หาชุด 2–3 รายการที่รวมเท่ากับ target (สตางค์) */
function findCombo(items, target) {
  const t = Math.round(target * 100); const v = items.map(x => Math.round(x.v * 100));
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
    if (v[i] + v[j] === t) return [items[i].id, items[j].id];
    for (let k = j + 1; k < v.length; k++) if (v[i] + v[j] + v[k] === t) return [items[i].id, items[j].id, items[k].id];
  }
  return null;
}
const isInternal = s => CHANNELS.some(c => c.mask && s.detail && s.detail.includes(c.mask));
const isDirector = s => (S.settings.director.keywords || []).some(k => k && (s.detail || '').toUpperCase().includes(k.toUpperCase()));
const otherChannel = s => { const c = CHANNELS.find(c => c.mask && s.detail.includes(c.mask)); return c ? c.id : (s.channel === 'BSV001' ? 'BSV002' : 'BSV001'); };

export function render() {
  const ui = S.ui.rec = S.ui.rec || { ch: 'BSV001', month: '', only: 'open' };
  const months = [...new Set(S.statements.map(s => monthKey(s.date)))].sort().reverse();
  const list = S.statements.filter(s => s.channel === ui.ch && (!ui.month || monthKey(s.date) === ui.month) && (ui.only !== 'open' || !s.matchedTo));
  const openCount = S.statements.filter(s => !s.matchedTo).length;
  const bal = balances(S);
  const lastBal = ch => { const l = S.statements.filter(s => s.channel === ch && s.balance != null).sort((a, b) => (a.date + a.time) < (b.date + b.time) ? 1 : -1)[0]; return l ? { bal: l.balance, date: l.date } : null; };
  const refName = s => { if (!s.matchedTo) return ''; const { type, id } = s.matchedTo;
    if (type === 'multi') { const list = (s.matchedTo.ids || []).map(i => s.matchedTo.kind === 'receipt' ? S.receipts.find(x => x.id === i) : S.expenses.find(x => x.id === i)).filter(Boolean); return `${s.matchedTo.kind === 'receipt' ? 'ใบเสร็จ' : 'รายจ่าย'} ${list.length} ใบ: ${list.map(x => x.no).join(', ')}` + (s.matchedTo.diff ? ` (ต่าง ${fmt(s.matchedTo.diff)})` : ''); } if (type === 'receipt') { const r = S.receipts.find(x => x.id === id); return r ? `ใบเสร็จ ${r.no} ${r.customerName}` : 'ใบเสร็จ (ลบแล้ว)'; } if (type === 'expense') { const e = S.expenses.find(x => x.id === id); return e ? `รายจ่าย ${e.no} ${e.vendorName}` : 'รายจ่าย (ลบแล้ว)'; } if (type === 'transfer') { const t = S.transfers.find(x => x.id === id); return t ? `โอน ${chan(t.from).short} → ${chan(t.to).short}` : 'โอน (ลบแล้ว)'; } return type; };
  return `
  <div class="topbar"><h1>กระทบยอดธนาคาร</h1><div class="row">
    <button class="btn btn-outline btn-sm" data-act="recImport">⬆ นำเข้า statement</button>
    <button class="btn btn-gold btn-sm" data-act="recAuto">✓ จับคู่อัตโนมัติ</button></div></div>
  <div class="grid g2 mb">
    ${['BSV001', 'BSV002'].map(ch => { const lb = lastBal(ch); const diff = lb ? round2(bal[ch] - lb.bal) : null; return `<div class="stat"><div class="lbl">${esc(chan(ch).name)}</div><div class="val">${fmt(bal[ch])} <span class="small muted" style="font-weight:400">สมุด</span></div><div class="sub">statement ล่าสุด ${lb ? fmt(lb.bal) + ' (' + thDate(lb.date) + ')' : 'ยังไม่นำเข้า'} ${diff != null ? `· ต่าง <b class="${Math.abs(diff) < 0.01 ? 'pos' : 'neg'}">${fmt(diff)}</b>` : ''}</div></div>`; }).join('')}
  </div>
  <div class="card"><div class="row">
    <div class="seg">${['BSV001', 'BSV002'].map(ch => `<button class="${ui.ch === ch ? 'on' : ''}" data-act="recCh" data-v="${ch}">${chan(ch).short}</button>`).join('')}</div>
    <select data-on="recMonth" style="width:auto"><option value="">ทุกเดือน</option>${months.map(m => `<option value="${m}" ${m === ui.month ? 'selected' : ''}>${thMonth(m)}</option>`).join('')}</select>
    <div class="seg"><button class="${ui.only === 'open' ? 'on' : ''}" data-act="recOnly" data-v="open">ยังไม่จับคู่ (${openCount})</button><button class="${ui.only === 'all' ? 'on' : ''}" data-act="recOnly" data-v="all">ทั้งหมด</button></div>
    <span class="grow"></span><span class="small">${list.length} รายการ</span></div></div>
  <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>รายละเอียดจากธนาคาร</th><th class="right">เข้า</th><th class="right">ออก</th><th class="right">ยอดธนาคาร</th><th>จับคู่กับ</th><th></th></tr></thead><tbody>
    ${list.map(s => `<tr>
      <td>${thDate(s.date)}<br><span class="small muted">${esc(s.time || '')}</span></td><td class="small">${esc(s.type)} ${esc(s.detail)}</td>
      <td class="num pos">${s.amount > 0 ? fmt(s.amount) : ''}</td><td class="num neg">${s.amount < 0 ? fmt(-s.amount) : ''}</td><td class="num">${s.balance != null ? fmt(s.balance) : ''}</td>
      <td class="small">${s.matchedTo ? `<span class="badge green">${esc(refName(s))}</span>` : isInternal(s) ? '<span class="badge blue">โอนระหว่างบัญชีบริษัท</span>' : isDirector(s) ? '<span class="badge red">เงินกรรมการ</span>' : ''}</td>
      <td style="white-space:nowrap">${s.matchedTo ? `<button class="btn btn-ghost btn-sm" data-act="recUnmatch" data-id="${s.id}">ยกเลิกคู่</button>` : `
        ${isInternal(s) ? `<button class="btn btn-outline btn-sm" data-act="recInternal" data-id="${s.id}">สร้างโอนภายใน</button>` : ''}
        ${isDirector(s) ? `<button class="btn btn-outline btn-sm" data-act="recDirector" data-id="${s.id}">ลงเงินกรรมการ</button>` : ''}
        ${s.amount < 0 ? `<button class="btn btn-outline btn-sm" data-act="recExpense" data-id="${s.id}">สร้างรายจ่าย</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-act="recPick" data-id="${s.id}">เลือกคู่…</button>`}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">ไม่มีรายการ</td></tr>'}
  </tbody></table></div>
  <p class="small muted">จับคู่อัตโนมัติ: เงินเข้า = ใบเสร็จช่องโอนยอดเท่ากันภายใน 1 วัน · เงินออก = รายจ่ายยอดจ่ายจริงเท่ากันภายใน 3 วัน · โอนระหว่างบัญชีตัวเอง/เงินกรรมการ ระบบแนะนำปุ่มให้สร้างรายการ</p>`;
}

function importDialog() {
  if (!canI('recon')) return;
  openModal(`<h2>นำเข้า statement กสิกร</h2>
    <div class="field"><label class="f">บัญชี</label><select id="impCh">${['BSV001', 'BSV002'].map(ch => `<option value="${ch}">${chan(ch).name}</option>`).join('')}</select></div>
    <div class="field"><label class="f">ไฟล์ CSV จาก K BIZ (หรือ CSV ที่มีคอลัมน์ วันที่/ถอน/ฝาก/รายละเอียด)</label><input type="file" id="impFile" accept=".csv,.txt"></div>
    <div class="field"><label class="f">หรือวางข้อความจาก statement PDF (คัดลอกทั้งหน้า)</label><textarea id="impText" style="min-height:120px" placeholder="01-10-26 ยอดยกมา 29,536.00&#10;08-10-26 14:53 โอนเงิน 10,400.00 19,136.00 K BIZ โอนไป X0413 ..."></textarea></div>
    <div class="row" style="justify-content:space-between"><button type="button" class="btn btn-ghost" data-act="recSeed">โหลด statement ต.ค.–พ.ย. 69 ที่เตรียมไว้</button><span class="row"><button class="btn btn-outline" data-act="closeModal">ยกเลิก</button><button class="btn btn-gold" data-act="recDoImport">นำเข้า</button></span></div>`);
}

reg({
  recCh: el => { S.ui.rec.ch = el.dataset.v; rerender(); },
  recMonth: el => { S.ui.rec.month = el.value; rerender(); },
  recOnly: el => { S.ui.rec.only = el.dataset.v; rerender(); },
  recImport: () => importDialog(),
  async recDoImport() {
    const ch = document.getElementById('impCh').value; const file = document.getElementById('impFile').files[0]; const text = document.getElementById('impText').value;
    let lines = [];
    if (file) { const t = await file.text(); lines = parseStatementCSV(t, ch); if (!lines.length) lines = parseStatementText(t, ch); }
    else if (text.trim()) lines = parseStatementText(text, ch);
    if (!lines.length) return toast('อ่านรายการไม่ได้ ตรวจรูปแบบไฟล์');
    const n = await importLines(lines); closeModal(); toast(`นำเข้า ${n} รายการใหม่ (อ่านได้ ${lines.length})`);
  },
  async recSeed() { try { const r = await fetch('seed/kbank_2569-10_11.json'); const lines = await r.json(); const n = await importLines(lines); closeModal(); toast(`นำเข้า statement ต.ค.–พ.ย. ${n} รายการใหม่`); } catch (e) { toast('โหลดไม่ได้: ' + e.message); } },
  async recAuto() { if (!canI('recon')) return; const up = autoMatch(); if (up.length) await store.saveMany('acc_statements', up); toast(`จับคู่อัตโนมัติได้ ${up.length} รายการ`); },
  async recUnmatch(el) { const s = S.statements.find(x => x.id === el.dataset.id); await saveDoc('acc_statements', { ...s, matchedTo: null, matchKind: '' }); },
  async recInternal(el) {
    if (!canI('recon')) return; const s = S.statements.find(x => x.id === el.dataset.id); const other = otherChannel(s);
    const from = s.amount > 0 ? other : s.channel, to = s.amount > 0 ? s.channel : other;
    const t = { id: uid('T'), no: nextNo(S.transfers, 'TR', s.date), date: s.date, from, to, amount: Math.abs(s.amount), note: 'จาก statement: ' + s.detail.slice(0, 40), kind: 'transfer' };
    await saveDoc('acc_transfers', t);
    const ups = [{ ...s, matchedTo: { type: 'transfer', id: t.id }, matchKind: 'internal' }];
    const twin = S.statements.find(x => x.channel === other && !x.matchedTo && x.amount === -s.amount && dayDiff(x.date, s.date) <= 1);
    if (twin) ups.push({ ...twin, matchedTo: { type: 'transfer', id: t.id }, matchKind: 'internal' });
    await store.saveMany('acc_statements', ups); toast('สร้างรายการโอนภายในและจับคู่แล้ว' + (twin ? ' (ทั้งสองบัญชี)' : ''));
  },
  async recDirector(el) {
    if (!canI('recon')) return; const s = S.statements.find(x => x.id === el.dataset.id);
    const t = { id: uid('T'), no: nextNo(S.transfers, 'TR', s.date), date: s.date, from: s.amount > 0 ? 'DIR' : s.channel, to: s.amount > 0 ? s.channel : 'DIR', amount: Math.abs(s.amount), note: (s.amount > 0 ? 'อาจารย์โอนให้บริษัทยืม' : 'คืนเงินอาจารย์') + ' · ' + s.detail.slice(0, 40), kind: s.amount > 0 ? 'directorIn' : 'directorOut' };
    await saveDoc('acc_transfers', t); await saveDoc('acc_statements', { ...s, matchedTo: { type: 'transfer', id: t.id }, matchKind: 'director' }); toast('ลงเงินกรรมการแล้ว');
  },
  recExpense(el) {
    const s = S.statements.find(x => x.id === el.dataset.id);
    S.ui.recPending = s.id;
    expenseForm(null, { date: s.date, amount: Math.abs(s.amount), channel: s.channel, desc: s.detail.replace(/K BIZ|โอนไป|เพื่อชำระ/g, '').trim().slice(0, 60), vendorName: '' });
  },
  recPick(el) {
    const s = S.statements.find(x => x.id === el.dataset.id); const amt = Math.abs(s.amount);
    const cands = s.amount > 0
      ? S.receipts.filter(r => !r.voided && dayDiff(r.day, s.date) <= 7).map(r => ({ type: 'receipt', id: r.id, label: `ใบเสร็จ ${r.no} ${thDate(r.day)} ${r.customerName} ${chan(r.channel).short}`, amt: r.total }))
      : S.expenses.filter(e => dayDiff(e.paidDate || e.date, s.date) <= 10).map(e => ({ type: 'expense', id: e.id, label: `รายจ่าย ${e.no} ${thDate(e.date)} ${e.vendorName} ${e.status === 'unpaid' ? '(ค้างจ่าย)' : chan(e.channel).short}`, amt: e.paid }));
    cands.push(...S.transfers.filter(t => dayDiff(t.date, s.date) <= 3).map(t => ({ type: 'transfer', id: t.id, label: `โอน ${thDate(t.date)} ${chan(t.from).short} → ${chan(t.to).short}`, amt: t.amount })));
    cands.sort((a, b) => (Math.abs(a.amt - amt) - Math.abs(b.amt - amt)));
    openModal(`<h2>เลือกรายการในสมุดให้ตรงกับ ${fmt(amt)} (${thDate(s.date)})</h2><p class="small muted">${esc(s.detail)}</p>
      <p class="small">กด "จับคู่" ถ้าตรง 1 รายการ · หรือติ๊กหลายรายการ (จ่าย/รับทีเดียวหลายบิล) แล้วกด "จับคู่ที่ติ๊ก"</p>
      <div style="max-height:50vh;overflow:auto" id="pickList">${cands.slice(0, 40).map(c => `<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid #F3EAE0"><label class="row small" style="gap:6px"><input type="checkbox" data-on="recTick" data-amt="${c.amt}" data-type="${c.type}" data-id="${c.id}">${esc(c.label)}</label><span class="row"><b class="num ${c.amt === amt ? 'pos' : ''}">${fmt(c.amt)}</b><button class="btn btn-outline btn-sm" data-act="recDoPick" data-sid="${s.id}" data-type="${c.type}" data-id="${c.id}">จับคู่</button></span></div>`).join('') || '<div class="empty">ไม่มีรายการใกล้เคียง</div>'}</div>
      <div class="row mt" style="justify-content:space-between"><span class="small" id="pickSum">ติ๊กแล้ว 0 รายการ รวม 0.00</span><span class="row"><button class="btn btn-outline" data-act="closeModal">ปิด</button><button class="btn btn-gold" data-act="recDoMulti" data-sid="${s.id}" data-target="${amt}">จับคู่ที่ติ๊ก</button></span></div>`, { wide: true });
  },
  recTick() { const t = [...document.querySelectorAll('#pickList input:checked')]; const sum = t.reduce((a, x) => a + Number(x.dataset.amt), 0); document.getElementById('pickSum').textContent = `ติ๊กแล้ว ${t.length} รายการ รวม ${fmt(sum)}`; },
  async recDoMulti(el) {
    const s = S.statements.find(x => x.id === el.dataset.sid); const target = Number(el.dataset.target);
    const t = [...document.querySelectorAll('#pickList input:checked')]; if (!t.length) return toast('ยังไม่ได้ติ๊กรายการ');
    const types = new Set(t.map(x => x.dataset.type)); if (types.size > 1 || types.has('transfer')) return toast('ติ๊กได้เฉพาะใบเสร็จล้วน หรือรายจ่ายล้วน');
    const kind = t[0].dataset.type; const ids = t.map(x => x.dataset.id); const sum = round2(t.reduce((a, x) => a + Number(x.dataset.amt), 0)); const diff = round2(target - sum);
    if (Math.abs(diff) > 0.005 && !await confirmBox(`ยอดรวมที่ติ๊ก ${fmt(sum)} ไม่เท่ากับรายการธนาคาร ${fmt(target)} (ต่าง ${fmt(diff)}) จับคู่ต่อไหม? ส่วนต่างจะถูกบันทึกไว้ให้ตรวจ`)) return;
    if (kind === 'expense') for (const id of ids) { const e = S.expenses.find(x => x.id === id); if (e && (e.status === 'unpaid' || e.channel !== s.channel)) await saveDoc('acc_expenses', { ...e, status: 'paid', channel: s.channel, paidDate: s.date }); }
    await saveDoc('acc_statements', { ...s, matchedTo: { type: 'multi', kind, ids, diff: diff || 0 }, matchKind: 'manual-multi' }); closeModal(); toast(`จับคู่ ${ids.length} รายการแล้ว`);
  },
  async recDoPick(el) {
    const s = S.statements.find(x => x.id === el.dataset.sid);
    if (el.dataset.type === 'expense') { const e = S.expenses.find(x => x.id === el.dataset.id); if (e && (e.status === 'unpaid' || e.channel !== s.channel)) await saveDoc('acc_expenses', { ...e, status: 'paid', channel: s.channel, paidDate: s.date }); }
    // ใบเสร็จที่ POS ลงช่องทางผิด (เช่น กดเงินสดแต่ลูกค้าโอน) → แก้ช่องทางในสมุด และกันไม่ให้การดึง POS ครั้งหน้าทับ
    if (el.dataset.type === 'receipt') { const r = S.receipts.find(x => x.id === el.dataset.id); if (r && r.channel !== s.channel) await saveDoc('acc_receipts', { ...r, channelOrig: r.channel, channel: s.channel, channelFixed: true }); }
    const amt = Math.abs(s.amount); const ref = el.dataset.type === 'receipt' ? S.receipts.find(x => x.id === el.dataset.id)?.total : el.dataset.type === 'expense' ? S.expenses.find(x => x.id === el.dataset.id)?.paid : S.transfers.find(x => x.id === el.dataset.id)?.amount;
    const diff = ref != null ? round2(amt - ref) : 0;
    await saveDoc('acc_statements', { ...s, matchedTo: { type: el.dataset.type, id: el.dataset.id, diff: diff || 0 }, matchKind: 'manual' }); closeModal(); toast('จับคู่แล้ว' + (diff ? ` (ต่าง ${fmt(diff)})` : ''));
  },
});
