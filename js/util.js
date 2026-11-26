// ฟังก์ชันช่วยทั่วไป
export const fmt = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt0 = n => Math.round(Number(n) || 0).toLocaleString('th-TH');
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = p => (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const pad = (n, w = 4) => String(n).padStart(w, '0');

export function ymd(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1, 2)}-${pad(x.getDate(), 2)}`;
}
export const today = () => ymd(new Date());
export const monthKey = iso => String(iso || '').slice(0, 7);
export const yearBE = iso => Number(String(iso).slice(0, 4)) + 543;
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_ML = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export function thDate(iso, long = false) {
  if (!iso) return '-';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y) return iso;
  return long ? `${d} ${TH_ML[m - 1]} ${y + 543}` : `${d} ${TH_M[m - 1]} ${String(y + 543).slice(2)}`;
}
export function thMonth(key, long = true) { const [y, m] = key.split('-').map(Number); return `${(long ? TH_ML : TH_M)[m - 1]} ${y + 543}`; }
export const thDateTime = iso => iso ? thDate(iso) + ' ' + new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';

/** ปีบัญชี เริ่ม 1 ต.ค. → คืน 'FY2570' สำหรับ 2026-10-01..2027-09-30 */
export function fiscalYear(iso, startMonth = 10) {
  const [y, m] = String(iso).split('-').map(Number);
  return m >= startMonth ? y + 1 : y;
}
export function fiscalRange(fy, startMonth = 10) {
  return { from: `${fy - 1}-${pad(startMonth, 2)}-01`, to: `${fy}-${pad(startMonth - 1, 2)}-30` };
}
export function addMonths(key, n) { let [y, m] = key.split('-').map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${pad(m, 2)}`; }
export function monthsBetween(a, b) { const out = []; let k = a; while (k <= b) { out.push(k); k = addMonths(k, 1); } return out; }

export function parseNum(s) {
  if (typeof s === 'number') return s;
  s = String(s || '').trim();
  if (!s) return 0;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  const v = parseFloat(s.replace(/[^\d.]/g, '')) || 0;
  return neg ? -v : v;
}
export const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
export const sum = (arr, f = x => x) => round2(arr.reduce((a, x) => a + (Number(f(x)) || 0), 0));
export const by = (k, dir = 1) => (a, b) => (a[k] > b[k] ? dir : a[k] < b[k] ? -dir : 0);
export const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});

let toastTimer;
export function toast(msg, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/** ย่อรูปบิลให้เล็กก่อนเก็บ (dataURL jpeg ~ ≤ 900px) */
export function shrinkImage(file, max = 900, q = 0.72) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q));
    };
    img.onerror = rej; img.src = url;
  });
}

/** อ่าน CSV ง่าย ๆ (รองรับเครื่องหมายคำพูด) */
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
export function downloadText(name, text, type = 'text/csv') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: type + ';charset=utf-8' })); a.download = name; a.click();
}
export const csvRow = arr => arr.map(v => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',');
