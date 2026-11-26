import { S, reg, rerender, saveDoc, formData, canI, confirmBox } from '../core.js';
import { store, DEMO } from '../store.js';
import { CHANNELS, ROLES, DEFAULT_SETTINGS, nextNo } from '../model.js';
import { fmt, esc, toast, today, uid } from '../util.js';

export function render() {
  const st = S.settings; const op = st.opening;
  const owner = S.role === 'owner';
  const dis = owner ? '' : 'disabled';
  const peakCount = S.expenses.filter(e => e.source === 'peak').length;
  return `
  <div class="topbar"><h1>ตั้งค่า</h1>${st._unsaved ? '<span class="badge red">ยังไม่ได้บันทึก</span>' : ''}</div>
  ${!owner ? '<div class="alert warn">เฉพาะเจ้าของแก้ไขการตั้งค่าได้</div>' : ''}
  <form data-submit="stSave">
  <div class="grid g2">
    <div class="card"><div class="card-title">ข้อมูลกิจการ (ใช้ในหนังสือรับรอง 50 ทวิ)</div>
      <div class="field"><label class="f">ชื่อ</label><input name="company.name" value="${esc(st.company.name)}" ${dis}></div>
      <div class="field"><label class="f">เลขประจำตัวผู้เสียภาษี 13 หลัก</label><input name="company.taxId" value="${esc(st.company.taxId)}" maxlength="13" ${dis}></div>
      <div class="field"><label class="f">ที่อยู่</label><textarea name="company.address" ${dis}>${esc(st.company.address)}</textarea></div>
      <div class="field"><label class="f">โทร</label><input name="company.phone" value="${esc(st.company.phone)}" ${dis}></div>
    </div>
    <div class="card"><div class="card-title">ยอดยกมา ${esc(op.date)} (เริ่มปีบัญชี)</div>
      ${CHANNELS.map(c => `<div class="field"><label class="f">${esc(c.name)}${c.type === 'director' ? ' — ใส่ติดลบถ้าบริษัทติดหนี้กรรมการอยู่ก่อน' : ''}</label><input name="bal.${c.id}" type="number" step="0.01" value="${op.balances[c.id]}" ${dis}></div>`).join('')}
      <div class="field"><label><input type="checkbox" name="cashConfirmed" ${op.cashConfirmed ? 'checked' : ''} ${dis}> ยืนยันแล้วว่าเงินสดยกมาตรงกับที่นับจริง</label></div>
      <div class="field"><label class="f">หมายเหตุ</label><input name="openingNote" value="${esc(op.note || '')}" placeholder="เช่น นับเงินสดวันที่ … ได้ …" ${dis}></div>
      <p class="small muted">ยอดธนาคารตั้งตาม statement จริง ณ วันเริ่มปีบัญชี เงินสดตั้งจากการนับจริง</p>
    </div>
    <div class="card"><div class="card-title">POS และกรรมการ</div>
      <div class="field"><label class="f">ดึงบิล POS ตั้งแต่วันที่</label><input name="posSyncFrom" type="date" value="${esc(st.posSyncFrom)}" ${dis}></div>
      <div class="field"><label class="f">ชื่อกรรมการ</label><input name="director.name" value="${esc(st.director.name)}" ${dis}></div>
      <div class="field"><label class="f">คำที่ใช้จับรายการเงินกรรมการใน statement (คั่นด้วย ,)</label><input name="director.keywords" value="${esc((st.director.keywords || []).join(', '))}" ${dis}></div>
    </div>
    <div class="card"><div class="card-title">ผู้ใช้และสิทธิ์</div>
      <p class="small muted mb">3 ระดับ: ${Object.values(ROLES).join(' · ')}<br>ตั้ง PIN ต่อบทบาทได้ (ว่าง = ไม่ถาม) ก่อนเปิดใช้ล็อกอินอีเมลจริง</p>
      ${Object.entries(ROLES).map(([k, v]) => `<div class="field"><label class="f">PIN ${v}</label><input name="pin.${k}" value="${esc((st.pins || {})[k] || '')}" inputmode="numeric" ${dis}></div>`).join('')}
      <div class="field"><label><input type="checkbox" name="requireAuth" ${st.requireAuth ? 'checked' : ''} ${dis}> ใช้ล็อกอินอีเมล/รหัสผ่านของ Firebase (ต้องสร้างผู้ใช้ใน Firebase Console ก่อน)</label></div>
      <div class="field"><label class="f">อีเมล → บทบาท (บรรทัดละ 1 เช่น golf@x.com=owner, jet@x.com=keyer, acct@x.com=auditor)</label><textarea name="users" ${dis}>${esc(Object.entries(st.users || {}).map(([e, r]) => e + '=' + r).join('\n'))}</textarea></div>
    </div>
  </div>
  ${owner ? '<div class="row" style="justify-content:flex-end"><button class="btn btn-gold">บันทึกการตั้งค่า</button></div>' : ''}
  </form>
  <div class="card mt"><div class="card-title">นำเข้าข้อมูลจาก PEAK (ครั้งเดียว)</div>
    <div class="row" style="justify-content:space-between">
      <div class="small">รายจ่ายและผู้ขายช่วง ต.ค.–พ.ย. 69 จาก PEAK (ในระบบตอนนี้ ${peakCount} ใบ)<br><span class="muted">ใช้ไฟล์ seed ที่เก็บไว้ในเครื่อง ไม่ได้อยู่บนเว็บ · หมวดค่าใช้จ่ายเดาจากชื่อผู้ขาย ตรวจแก้ได้ทีหลัง · กดซ้ำไม่ซ้ำรายการ</span></div>
      <button class="btn btn-outline" data-act="stImportPeak" ${owner ? '' : 'disabled'}>นำเข้ารายจ่าย PEAK</button></div>
    <div class="row mt" style="justify-content:space-between">
      <div class="small">รายการโอนระหว่างบัญชีและเงินกรรมการช่วง ต.ค.–พ.ย. 69 ที่อ่านจาก statement</div>
      <button class="btn btn-outline" data-act="stImportTransfers" ${owner ? '' : 'disabled'}>นำเข้ารายการโอน</button></div>
    ${DEMO ? '<div class="row mt" style="justify-content:space-between"><div class="small">โหมดทดลอง: ล้างข้อมูลทั้งหมดในเครื่องนี้</div><button class="btn btn-red btn-sm" data-act="stResetDemo">ล้างข้อมูลทดลอง</button></div>' : ''}
  </div>
  <div class="card"><div class="card-title">ความปลอดภัยและสำรองข้อมูล</div>
    <p class="small">ข้อมูลเก็บใน Firebase โปรเจกต์เดียวกับ POS (bbglowhuahin-3bb7d) คอลเลกชันขึ้นต้น acc_ · ก่อนให้สำนักงานบัญชีเข้าใช้จริง ต้องเปิด Firebase Auth และปิดกฎ Firestore ที่เปิดอยู่ (ค้างมาจาก POS) · สำรองข้อมูล: หน้ารายงาน → CSV สำหรับผู้ตรวจ</p>
  </div>`;
}

const TRANSFERS_SEED = [
  { date: '2026-10-10', from: 'DIR', to: 'BSV002', amount: 9812.51, note: 'อาจารย์โอนเติมบัญชีจ่าย (MAKE by KBank)' },
  { date: '2026-10-13', from: 'BSV001', to: 'BSV002', amount: 15000, note: 'เติมบัญชีจ่าย' },
  { date: '2026-11-02', from: 'BSV001', to: 'BSV002', amount: 90000, note: 'เติมบัญชีจ่าย (จ่ายอมร)' },
  { date: '2026-11-02', from: 'BSV001', to: 'DIR', amount: 1443, note: 'คืนเงินอาจารย์' },
  { date: '2026-11-05', from: 'DIR', to: 'BSV002', amount: 43000, note: 'อาจารย์โอนเติมบัญชีจ่าย (TTB)' },
  { date: '2026-11-05', from: 'DIR', to: 'BSV002', amount: 21000, note: 'อาจารย์โอนเติมบัญชีจ่าย (BAY)' },
  { date: '2026-11-11', from: 'BSV001', to: 'BSV002', amount: 5000, note: 'เติมบัญชีจ่าย' },
  { date: '2026-11-11', from: 'BSV001', to: 'BSV002', amount: 10000, note: 'เติมบัญชีจ่าย' },
  { date: '2026-11-15', from: 'BSV001', to: 'DIR', amount: 3200, note: 'คืนเงินอาจารย์' },
];

reg({
  async stSave(f) {
    if (!canI('settings')) return;
    const d = formData(f); const st = JSON.parse(JSON.stringify(S.settings)); delete st._unsaved;
    st.company = { name: d['company.name'], taxId: d['company.taxId'], address: d['company.address'], phone: d['company.phone'] };
    CHANNELS.forEach(c => st.opening.balances[c.id] = Number(d['bal.' + c.id]) || 0);
    st.opening.cashConfirmed = !!d.cashConfirmed; st.opening.note = d.openingNote;
    st.posSyncFrom = d.posSyncFrom; st.director = { name: d['director.name'], keywords: d['director.keywords'].split(',').map(x => x.trim()).filter(Boolean) };
    st.pins = {}; Object.keys(ROLES).forEach(k => { if (d['pin.' + k]) st.pins[k] = d['pin.' + k]; });
    st.requireAuth = !!d.requireAuth; st.users = {};
    d.users.split(/\n/).forEach(l => { const [e, r] = l.split('=').map(x => x && x.trim()); if (e && ROLES[r]) st.users[e.toLowerCase()] = r; });
    if (st.requireAuth && !Object.values(st.users).includes('owner') && !DEMO) return toast('ต้องมีอีเมล owner อย่างน้อย 1 คนก่อนเปิดล็อกอินอีเมล');
    st.id = 'main'; await saveDoc('acc_settings', st); toast('บันทึกการตั้งค่าแล้ว');
  },
  async stImportPeak() {
    if (!canI('settings')) return;
    try {
      const r = await fetch('seed/peak_2569-10_11.json'); const seed = await r.json();
      const haveE = new Set(S.expenses.map(e => e.id)), haveV = new Set(S.contacts.map(c => c.name));
      const ex = seed.expenses.filter(e => !haveE.has(e.id)).map(e => ({ ...e, createdAt: new Date().toISOString(), createdBy: 'import' }));
      const vs = seed.vendors.filter(v => !haveV.has(v.name)).map(v => ({ ...v, id: 'PEAKV-' + v.id }));
      if (vs.length) await store.saveMany('acc_contacts', vs);
      if (ex.length) await store.saveMany('acc_expenses', ex);
      toast(`นำเข้ารายจ่าย ${ex.length} ใบ ผู้ขาย ${vs.length} ราย`);
    } catch (e) { toast('นำเข้าไม่ได้: ' + e.message); }
  },
  async stImportTransfers() {
    if (!canI('settings')) return;
    const have = new Set(S.transfers.map(t => `${t.date}|${t.from}|${t.to}|${t.amount}`));
    const docs = TRANSFERS_SEED.filter(t => !have.has(`${t.date}|${t.from}|${t.to}|${t.amount}`)).map((t, i) => ({ ...t, id: 'SEEDT-' + t.date + '-' + i, no: 'TR-' + t.date.slice(0, 7).replace('-', '') + '-S' + (i + 1), kind: t.from === 'DIR' ? 'directorIn' : t.to === 'DIR' ? 'directorOut' : 'transfer', createdAt: new Date().toISOString(), createdBy: 'import' }));
    if (docs.length) await store.saveMany('acc_transfers', docs);
    toast(`นำเข้ารายการโอน ${docs.length} รายการ`);
  },
  async stResetDemo() { if (!await confirmBox('ล้างข้อมูลทดลองทั้งหมดในเครื่องนี้?')) return; store.backend.reset(); location.reload(); },
});
