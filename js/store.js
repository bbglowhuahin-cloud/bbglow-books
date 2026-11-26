// ชั้นข้อมูล: Firestore (ของจริง โปรเจกต์เดียวกับ POS) หรือ LocalStorage (โหมดทดลอง ?demo=1)
import { uid } from './util.js';

export const COLLS = ['acc_settings', 'acc_receipts', 'acc_expenses', 'acc_contacts', 'acc_transfers', 'acc_statements'];
export const DEMO = new URLSearchParams(location.search).has('demo');

const firebaseConfig = {
  apiKey: 'AIzaSyB8HM1grB7OsiBvdLo5xRH5SqLnQoLR25U',
  authDomain: 'bbglowhuahin-3bb7d.firebaseapp.com',
  projectId: 'bbglowhuahin-3bb7d',
  storageBucket: 'bbglowhuahin-3bb7d.firebasestorage.app',
  messagingSenderId: '714462283652',
  appId: '1:714462283652:web:088c6ddde11f46fc08ffd1',
};

let backend;
// Firestore ไม่รับค่า undefined → ตัดทิ้งก่อนบันทึก
const clean = d => JSON.parse(JSON.stringify(d));

/* ---------------- Firestore ---------------- */
async function firestoreBackend() {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const au = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const app = initializeApp(firebaseConfig);
  const db = fs.getFirestore(app);
  const auth = au.getAuth(app);
  return {
    name: 'firestore',
    listen(coll, cb) { return fs.onSnapshot(fs.collection(db, coll), snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => console.error(coll, err)); },
    async save(coll, docu) { const { id, ...data } = clean(docu); await fs.setDoc(fs.doc(db, coll, id), data); return id; },
    async saveMany(coll, docs) {
      for (let i = 0; i < docs.length; i += 400) {
        const batch = fs.writeBatch(db);
        docs.slice(i, i + 400).forEach(d => { const { id, ...data } = clean(d); batch.set(fs.doc(db, coll, id), data); });
        await batch.commit();
      }
    },
    async remove(coll, id) { await fs.deleteDoc(fs.doc(db, coll, id)); },
    async posSales(fromIso) {
      const q = fs.query(fs.collection(db, 'sales'), fs.where('date', '>=', fromIso));
      const snap = await fs.getDocs(q);
      return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    },
    async posMembers() { const snap = await fs.getDocs(fs.collection(db, 'members')); return snap.docs.map(d => ({ _docId: d.id, ...d.data() })); },
    auth: {
      onChange(cb) { return au.onAuthStateChanged(auth, cb); },
      signIn(email, pw) { return au.signInWithEmailAndPassword(auth, email, pw); },
      signOut() { return au.signOut(auth); },
    },
  };
}

/* ---------------- LocalStorage (ทดลอง) ---------------- */
function localBackend() {
  const key = c => 'bbbooks:' + c;
  const read = c => JSON.parse(localStorage.getItem(key(c)) || '[]');
  const write = (c, arr) => localStorage.setItem(key(c), JSON.stringify(arr));
  const listeners = {};
  const emit = c => (listeners[c] || []).forEach(cb => cb(read(c)));
  return {
    name: 'local',
    listen(coll, cb) { (listeners[coll] = listeners[coll] || []).push(cb); setTimeout(() => cb(read(coll)), 0); return () => { listeners[coll] = listeners[coll].filter(x => x !== cb); }; },
    async save(coll, docu) { const arr = read(coll).filter(x => x.id !== docu.id); arr.push(docu); write(coll, arr); emit(coll); return docu.id; },
    async saveMany(coll, docs) { const ids = new Set(docs.map(d => d.id)); const arr = read(coll).filter(x => !ids.has(x.id)).concat(docs); write(coll, arr); emit(coll); },
    async remove(coll, id) { write(coll, read(coll).filter(x => x.id !== id)); emit(coll); },
    async posSales(fromIso) { return demoSales().filter(s => s.date >= fromIso); },
    async posMembers() { return []; },
    auth: { onChange(cb) { setTimeout(() => cb(null), 0); return () => {}; }, async signIn() { throw new Error('โหมดทดลองไม่มีล็อกอิน'); }, async signOut() {} },
    reset() { COLLS.forEach(c => localStorage.removeItem(key(c))); localStorage.removeItem('bbbooks:demoSales'); },
  };
}

/** บิลตัวอย่างรูปแบบเดียวกับ POS จริง (ใช้เฉพาะโหมดทดลอง) */
function demoSales() {
  const cached = localStorage.getItem('bbbooks:demoSales');
  if (cached) return JSON.parse(cached);
  const names = ['คุณ สมมติ หนึ่ง', 'คุณ สมมติ สอง', 'คุณ สมมติ สาม', 'คุณ สมมติ สี่', 'คุณ สมมติ ห้า', 'ลูกค้าทั่วไป', 'คุณ สมมติ หก', 'คุณ สมมติ เจ็ด'];
  const combos = [
    [[{ name: 'BB Super Locked หน้า', price: 1999 }, { name: 'BB Super Locked คอ', price: 399 }], []],
    [[{ name: 'BB Super Locked หน้า', price: 1999 }], []],
    [[{ name: 'Mesotherapy', price: 2399 }], []],
    [[{ name: 'BB Super Locked หน้า', price: 1999 }, { name: 'BB Super Locked คอ', price: 399 }], [{ id: 'mask_uv', name: 'แมสยูวี', qty: 1, unitPrice: 159, total: 159 }]],
    [[{ name: 'แว็กซ์ขอบบิกินี', price: 500, wax: true }], [{ id: 'after_gel', name: 'อาฟเตอร์เจล', qty: 1, unitPrice: 250, total: 250 }]],
  ];
  const out = []; let n = 0;
  const start = new Date('2026-10-01T10:00:00');
  for (let d = 0; d < 56; d++) {
    const perDay = 1 + ((d * 7) % 3);
    for (let k = 0; k < perDay; k++) {
      const dt = new Date(start.getTime() + d * 86400000 + k * 3600000 * 2);
      const [svc, hc] = combos[(d + k) % combos.length];
      const serviceTotal = svc.reduce((a, x) => a + x.price, 0);
      const homecareTotal = hc.reduce((a, x) => a + x.total, 0);
      const creditUsed = (d + k) % 4 === 0 ? 240 : 0;
      const paid = serviceTotal - creditUsed;
      out.push({
        id: 'S' + (1760000000000 + n * 7919), memberId: 'M' + (100 + (n % 8)), memberName: names[n % names.length],
        service: svc.map(x => x.name).join(', '), price: serviceTotal, serviceTotal, serviceItems: svc,
        homecareTotal, homecareItems: hc, discount: 0, creditUsed, creditEarned: Math.round(serviceTotal * 0.05),
        paid, totalPaid: paid + homecareTotal, staffId: ['S2', 'S3', 'S4'][n % 3], staffName: ['เอ', 'หยง', 'เจต'][n % 3], commission: 0,
        payMethod: (n % 3 === 2) ? 'cash' : 'transfer', date: dt.toISOString(), voided: n === 17,
      });
      n++;
    }
  }
  localStorage.setItem('bbbooks:demoSales', JSON.stringify(out));
  return out;
}

export async function initStore() {
  backend = DEMO ? localBackend() : await firestoreBackend();
  return backend;
}
export const store = {
  get backend() { return backend; },
  listen: (c, cb) => backend.listen(c, cb),
  save: (c, d) => backend.save(c, d),
  saveMany: (c, ds) => backend.saveMany(c, ds),
  remove: (c, id) => backend.remove(c, id),
  posSales: from => backend.posSales(from),
  posMembers: () => backend.posMembers(),
  auth: () => backend.auth,
  newId: p => uid(p),
};
