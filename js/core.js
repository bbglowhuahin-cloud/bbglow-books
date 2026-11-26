// สถานะกลาง + ระบบ action + โมดัล (ไม่พึ่งไฟล์ view เพื่อเลี่ยง import วน)
import { store } from './store.js';
import { can } from './model.js';
import { toast } from './util.js';

export const S = {
  settings: null, receipts: [], expenses: [], contacts: [], transfers: [], statements: [],
  role: null, user: null, userLabel: '', ready: false, route: 'dashboard', param: '', ui: {},
};
export const ACTIONS = {};
export const reg = o => Object.assign(ACTIONS, o);

let renderFn = () => {};
export const setRender = f => { renderFn = f; };
export const rerender = () => renderFn();

export function nav(route, param = '') { location.hash = '#/' + route + (param ? '/' + param : ''); }

export function canI(action) {
  if (S.role && can(S.role, action)) return true;
  toast('สิทธิ์ของผู้ใช้นี้ทำรายการนี้ไม่ได้');
  return false;
}

export async function saveDoc(coll, docu) {
  docu.updatedAt = new Date().toISOString();
  docu.updatedBy = S.userLabel || S.role || '';
  if (!docu.createdAt) { docu.createdAt = docu.updatedAt; docu.createdBy = docu.updatedBy; }
  await store.save(coll, docu);
  return docu;
}
export const removeDoc = (coll, id) => store.remove(coll, id);

/* ---------- โมดัล ---------- */
export function openModal(html, { wide = false } = {}) {
  closeModal();
  const bg = document.createElement('div'); bg.className = 'modal-bg'; bg.id = 'modal';
  bg.innerHTML = `<div class="modal" ${wide ? 'style="max-width:960px"' : ''}>${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) closeModal(); });
  document.body.appendChild(bg);
  const f = bg.querySelector('input:not([type=hidden]),select,textarea'); if (f) setTimeout(() => f.focus(), 50);
  return bg;
}
export function closeModal() { const m = document.getElementById('modal'); if (m) m.remove(); }
export const modalEl = () => document.getElementById('modal');

/** อ่านค่าฟอร์มเป็น object ตาม name */
export function formData(form) {
  const o = {};
  form.querySelectorAll('[name]').forEach(el => {
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'number') o[el.name] = el.value === '' ? '' : Number(el.value);
    else o[el.name] = el.value.trim();
  });
  return o;
}
export function confirmBox(msg) { return new Promise(res => {
  const bg = openModal(`<p style="font-size:1rem;margin-bottom:14px">${msg}</p><div class="row" style="justify-content:flex-end"><button class="btn btn-outline" data-x="0">ยกเลิก</button><button class="btn btn-red" data-x="1">ยืนยัน</button></div>`);
  bg.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { closeModal(); res(b.dataset.x === '1'); });
}); }
