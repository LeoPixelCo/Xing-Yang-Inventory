// ========================================================
// 电子台账 - app.js
// 纯前端 + Supabase 后端。所有配置在 config.js 里。
// ========================================================

const CFG = window.LEDGER_CONFIG || {};
let sb = null;
let materials = [];
let products = [];
let charts = {}; // 保存 Chart.js 实例,重绘前先销毁

// -------------------- 工具函数 --------------------
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.style.background = isError ? '#b91c1c' : '#111827';
  el.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

function money(n) { return 'RM ' + (Number(n) || 0).toFixed(2); }
function num(n) { return (Math.round((Number(n) || 0) * 100) / 100).toString(); }

function todayStr() {
  return new Date().toLocaleDateString('en-CA');
}
function localDateKey(iso) {
  return new Date(iso).toLocaleDateString('en-CA');
}
function dayRangeISO(dateStr) {
  const start = new Date(dateStr + 'T00:00:00');
  const end = new Date(dateStr + 'T23:59:59.999');
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}
function sumBy(rows, keyField, valField) {
  const map = {};
  for (const r of rows || []) {
    if (r[keyField] == null) continue;
    map[r[keyField]] = (map[r[keyField]] || 0) + Number(r[valField] || 0);
  }
  return map;
}
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// -------------------- 初始化 --------------------
function initSupabase() {
  if (!CFG.SUPABASE_URL || CFG.SUPABASE_URL.includes('YOUR-PROJECT')) {
    $('#connStatus').textContent = '未配置';
    $('#connStatus').classList.add('bg-red-800');
    toast('请先在 config.js 里填入你的 Supabase 项目信息', true);
    return false;
  }
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  $('#connStatus').textContent = '已连接';
  return true;
}

async function loadMaterials() {
  const { data, error } = await sb.from('materials').select('*').eq('archived', false).order('name');
  if (error) { toast('读取原材料库失败: ' + error.message, true); return; }
  materials = data || [];
  const opts = materials.map(m => `<option value="${m.id}">${m.name}(${m.unit})</option>`).join('');
  $all('select[name="material_id"]').forEach(sel => { sel.innerHTML = opts || '<option value="">(请先在设置中添加原材料)</option>'; });
}

async function loadProducts() {
  const { data, error } = await sb.from('products').select('*').eq('archived', false).order('name');
  if (error) { toast('读取产品库失败: ' + error.message, true); return; }
  products = data || [];
  const opts = products.map(p => `<option value="${p.id}">${p.item_code ? p.item_code + ' ' : ''}${p.name}(${p.unit})</option>`).join('');
  $all('select[name="product_id"]').forEach(sel => { sel.innerHTML = opts || '<option value="">(请先在设置中添加产品)</option>'; });
}

function materialName(id) { const m = materials.find(x => x.id === id); return m ? m.name : '(已删除的原材料)'; }
function productName(id) { const p = products.find(x => x.id === id); return p ? p.name : '(已删除的产品)'; }

// -------------------- 导航 --------------------
const TAB_TITLES = { record: '每日记录', stock: '库存', cost: '成本', daily: '日报', overview: '后台总览', settings: '设置' };

function switchTab(tab) {
  $all('.tab-panel').forEach(p => p.classList.remove('active'));
  $(`#tab-${tab}`).classList.add('active');
  $all('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#pageTitle').textContent = TAB_TITLES[tab] || '电子台账';
  if (!sb) return; // 尚未配置 Supabase,不再往下发请求
  if (tab === 'stock') renderStock();
  if (tab === 'cost') renderCost();
  if (tab === 'daily') renderDaily();
  if (tab === 'overview') renderOverview();
  if (tab === 'record') renderRecent();
}

$all('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

$all('.subtab-btn').forEach(btn => btn.addEventListener('click', () => {
  $all('.subtab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  $all('.record-form').forEach(f => f.classList.add('hidden'));
  $(`#form-${btn.dataset.sub}`).classList.remove('hidden');
}));

$all('.settings-tab-btn').forEach(btn => btn.addEventListener('click', () => {
  $all('.settings-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  $all('.settings-panel').forEach(p => p.classList.add('hidden'));
  $(`#settings-${btn.dataset.settings}`).classList.remove('hidden');
}));

// -------------------- 上传照片 --------------------
async function uploadPhoto(file) {
  if (!file) return null;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(CFG.PHOTO_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from(CFG.PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// -------------------- 记录表单提交 --------------------
async function handleRecordSubmit(e, table, buildRow) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const fd = new FormData(form);
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = '提交中…';
  try {
    let photoUrl = null;
    const file = fd.get('photo');
    if (file && file.size > 0) {
      btn.textContent = '上传照片中…';
      photoUrl = await uploadPhoto(file);
    }
    const row = buildRow(fd, photoUrl);
    const { error } = await sb.from(table).insert(row);
    if (error) throw error;
    toast('已提交');
    form.reset();
    renderRecent();
  } catch (err) {
    toast('提交失败: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

$('#form-consume').addEventListener('submit', e => handleRecordSubmit(e, 'material_consumptions', (fd, photo) => {
  const mat = materials.find(m => m.id === fd.get('material_id'));
  return {
    material_id: fd.get('material_id') || null,
    qty: Number(fd.get('qty')),
    unit_price_snapshot: mat ? mat.unit_price : 0,
    note: fd.get('note') || null,
    photo_url: photo
  };
}));

$('#form-produce').addEventListener('submit', e => handleRecordSubmit(e, 'production_records', (fd, photo) => ({
  product_id: fd.get('product_id') || null,
  qty: Number(fd.get('qty')),
  note: fd.get('note') || null,
  photo_url: photo
})));

$('#form-ship').addEventListener('submit', e => handleRecordSubmit(e, 'shipment_records', (fd, photo) => ({
  product_id: fd.get('product_id') || null,
  qty: Number(fd.get('qty')),
  destination: fd.get('destination') || null,
  note: fd.get('note') || null,
  photo_url: photo
})));

$('#form-purchase').addEventListener('submit', e => handleRecordSubmit(e, 'material_purchases', (fd, photo) => {
  const mat = materials.find(m => m.id === fd.get('material_id'));
  const price = fd.get('unit_price');
  return {
    material_id: fd.get('material_id') || null,
    qty: Number(fd.get('qty')),
    unit_price: price ? Number(price) : (mat ? mat.unit_price : 0),
    note: fd.get('note') || null,
    photo_url: photo
  };
}));

// -------------------- 最近记录 --------------------
async function renderRecent() {
  const box = $('#recentList');
  box.innerHTML = '<p class="text-sm text-gray-400">加载中…</p>';
  const [c, p, s, pu] = await Promise.all([
    sb.from('material_consumptions').select('*').order('created_at', { ascending: false }).limit(5),
    sb.from('production_records').select('*').order('created_at', { ascending: false }).limit(5),
    sb.from('shipment_records').select('*').order('created_at', { ascending: false }).limit(5),
    sb.from('material_purchases').select('*').order('created_at', { ascending: false }).limit(5)
  ]);
  const items = [
    ...(c.data || []).map(r => ({ ...r, kind: '消耗', label: materialName(r.material_id) })),
    ...(p.data || []).map(r => ({ ...r, kind: '生产', label: productName(r.product_id) })),
    ...(s.data || []).map(r => ({ ...r, kind: '出货', label: productName(r.product_id) })),
    ...(pu.data || []).map(r => ({ ...r, kind: '入库', label: materialName(r.material_id) }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

  if (!items.length) { box.innerHTML = '<p class="text-sm text-gray-400">还没有记录</p>'; return; }
  box.innerHTML = items.map(it => `
    <div class="flex items-center gap-3 bg-white rounded-lg p-2.5 shadow-sm">
      ${it.photo_url ? `<a href="${it.photo_url}" target="_blank"><img src="${it.photo_url}" class="w-12 h-12 object-cover rounded-md" /></a>` : `<div class="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center text-gray-300 text-xs">无图</div>`}
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium">${it.kind} · ${it.label}</div>
        <div class="text-xs text-gray-400">${fmtTime(it.created_at)}${it.note ? ' · ' + it.note : ''}</div>
      </div>
      <div class="text-sm font-semibold text-teal-700">${num(it.qty)}</div>
    </div>
  `).join('');
}

// -------------------- 库存 --------------------
async function computeMaterialStock() {
  const [purchases, consumptions] = await Promise.all([
    sb.from('material_purchases').select('material_id, qty'),
    sb.from('material_consumptions').select('material_id, qty')
  ]);
  const pMap = sumBy(purchases.data, 'material_id', 'qty');
  const cMap = sumBy(consumptions.data, 'material_id', 'qty');
  return materials.map(m => ({ ...m, stock: (m.opening_stock || 0) + (pMap[m.id] || 0) - (cMap[m.id] || 0) }));
}

async function computeProductStock() {
  const [prod, ship] = await Promise.all([
    sb.from('production_records').select('product_id, qty'),
    sb.from('shipment_records').select('product_id, qty')
  ]);
  const prMap = sumBy(prod.data, 'product_id', 'qty');
  const shMap = sumBy(ship.data, 'product_id', 'qty');
  return products.map(p => ({ ...p, stock: (p.opening_stock || 0) + (prMap[p.id] || 0) - (shMap[p.id] || 0) }));
}

async function renderStock() {
  const [mStock, pStock] = await Promise.all([computeMaterialStock(), computeProductStock()]);
  $('#materialStockTable tbody').innerHTML = mStock.map(m => `
    <tr class="border-t ${m.stock <= m.reorder_threshold ? 'bg-red-50' : ''}">
      <td class="px-3 py-2">${m.name}</td>
      <td class="px-3 py-2 text-right ${m.stock <= m.reorder_threshold ? 'text-red-600 font-semibold' : ''}">${num(m.stock)} ${m.unit}</td>
      <td class="px-3 py-2 text-right text-gray-400">${num(m.reorder_threshold)}</td>
    </tr>`).join('') || `<tr><td class="px-3 py-3 text-gray-400" colspan="3">暂无原材料,请先到设置中添加</td></tr>`;

  $('#productStockTable tbody').innerHTML = pStock.map(p => `
    <tr class="border-t ${p.stock <= p.reorder_threshold ? 'bg-red-50' : ''}">
      <td class="px-3 py-2">${p.name}</td>
      <td class="px-3 py-2 text-right ${p.stock <= p.reorder_threshold ? 'text-red-600 font-semibold' : ''}">${num(p.stock)} ${p.unit}</td>
      <td class="px-3 py-2 text-right text-gray-400">${num(p.reorder_threshold)}</td>
    </tr>`).join('') || `<tr><td class="px-3 py-3 text-gray-400" colspan="3">暂无产品,请先到设置中添加</td></tr>`;
}

// -------------------- 成本 --------------------
function destroyChart(key) { if (charts[key]) { charts[key].destroy(); delete charts[key]; } }

async function renderCost() {
  const days = Number($('#costRangeSelect').value);
  const from = daysAgoStr(days - 1);
  const { startISO } = dayRangeISO(from);
  const { data, error } = await sb.from('material_consumptions').select('qty, unit_price_snapshot, created_at').gte('created_at', startISO);
  if (error) { toast('读取成本失败: ' + error.message, true); return; }

  const byDay = {};
  let total = 0;
  for (const r of data || []) {
    const cost = Number(r.qty) * Number(r.unit_price_snapshot || 0);
    const key = localDateKey(r.created_at);
    byDay[key] = (byDay[key] || 0) + cost;
    total += cost;
  }
  const labels = [];
  for (let i = days - 1; i >= 0; i--) labels.push(daysAgoStr(i));
  const values = labels.map(d => byDay[d] || 0);

  $('#costTotal').textContent = money(total);
  $('#costTable tbody').innerHTML = labels.slice().reverse().map(d => `
    <tr class="border-t"><td class="px-3 py-2">${d}</td><td class="px-3 py-2 text-right">${money(byDay[d] || 0)}</td></tr>
  `).join('');

  destroyChart('cost');
  charts.cost = new Chart($('#costChart'), {
    type: 'line',
    data: { labels, datasets: [{ label: '每日原材料成本', data: values, borderColor: '#0f766e', backgroundColor: 'rgba(15,118,110,0.1)', fill: true, tension: 0.25 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}
$('#costRangeSelect').addEventListener('change', renderCost);

// -------------------- 日报 --------------------
async function renderDaily() {
  const dateStr = $('#dailyDate').value || todayStr();
  $('#dailyDate').value = dateStr;
  const { startISO, endISO } = dayRangeISO(dateStr);

  const [c, p, s, pu] = await Promise.all([
    sb.from('material_consumptions').select('*').gte('created_at', startISO).lte('created_at', endISO).order('created_at'),
    sb.from('production_records').select('*').gte('created_at', startISO).lte('created_at', endISO).order('created_at'),
    sb.from('shipment_records').select('*').gte('created_at', startISO).lte('created_at', endISO).order('created_at'),
    sb.from('material_purchases').select('*').gte('created_at', startISO).lte('created_at', endISO).order('created_at')
  ]);

  const cost = (c.data || []).reduce((sum, r) => sum + Number(r.qty) * Number(r.unit_price_snapshot || 0), 0);
  const [mStock, pStock] = await Promise.all([computeMaterialStock(), computeProductStock()]);

  const section = (title, rows, render) => `
    <div class="bg-white rounded-xl p-4 shadow-sm">
      <h3 class="font-medium mb-2">${title} <span class="text-gray-400 text-sm">(${rows.length})</span></h3>
      ${rows.length ? `<div class="space-y-1.5 text-sm">${rows.map(render).join('')}</div>` : '<p class="text-sm text-gray-400">无记录</p>'}
    </div>`;

  $('#dailyReport').innerHTML = `
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-white rounded-xl p-3 shadow-sm text-center">
        <div class="text-xs text-gray-400">当日原材料成本</div>
        <div class="text-lg font-semibold text-teal-700">${money(cost)}</div>
      </div>
      <div class="bg-white rounded-xl p-3 shadow-sm text-center">
        <div class="text-xs text-gray-400">生产 / 出货笔数</div>
        <div class="text-lg font-semibold text-teal-700">${p.data.length} / ${s.data.length}</div>
      </div>
    </div>
    ${section('原材料消耗', c.data || [], r => `<div class="flex justify-between border-b pb-1"><span>${materialName(r.material_id)}${r.note ? ' · ' + r.note : ''}</span><span>${num(r.qty)}</span></div>`)}
    ${section('生产记录', p.data || [], r => `<div class="flex justify-between border-b pb-1"><span>${productName(r.product_id)}${r.note ? ' · ' + r.note : ''}</span><span>${num(r.qty)}</span></div>`)}
    ${section('出货记录', s.data || [], r => `<div class="flex justify-between border-b pb-1"><span>${productName(r.product_id)}${r.destination ? ' → ' + r.destination : ''}</span><span>${num(r.qty)}</span></div>`)}
    ${section('原材料入库', pu.data || [], r => `<div class="flex justify-between border-b pb-1"><span>${materialName(r.material_id)}${r.note ? ' · ' + r.note : ''}</span><span>${num(r.qty)}</span></div>`)}
    <div class="bg-white rounded-xl p-4 shadow-sm">
      <h3 class="font-medium mb-2">当日结束库存快照</h3>
      <div class="text-sm space-y-1">
        ${mStock.map(m => `<div class="flex justify-between"><span>${m.name}</span><span class="${m.stock <= m.reorder_threshold ? 'text-red-600 font-semibold' : ''}">${num(m.stock)} ${m.unit}</span></div>`).join('')}
        ${pStock.map(p2 => `<div class="flex justify-between"><span>${p2.name}</span><span class="${p2.stock <= p2.reorder_threshold ? 'text-red-600 font-semibold' : ''}">${num(p2.stock)} ${p2.unit}</span></div>`).join('')}
      </div>
    </div>
  `;

  $('#exportDailyBtn').onclick = () => exportDaily(dateStr, c.data || [], p.data || [], s.data || [], pu.data || [], cost);
}
$('#dailyDate').addEventListener('change', renderDaily);

function exportDaily(dateStr, c, p, s, pu, cost) {
  const lines = [`日报 ${dateStr}`, `当日原材料成本: ${money(cost)}`, '', '【原材料消耗】'];
  c.forEach(r => lines.push(`${materialName(r.material_id)}\t${num(r.qty)}\t${r.note || ''}`));
  lines.push('', '【生产记录】');
  p.forEach(r => lines.push(`${productName(r.product_id)}\t${num(r.qty)}\t${r.note || ''}`));
  lines.push('', '【出货记录】');
  s.forEach(r => lines.push(`${productName(r.product_id)}\t${num(r.qty)}\t${r.destination || ''}\t${r.note || ''}`));
  lines.push('', '【原材料入库】');
  pu.forEach(r => lines.push(`${materialName(r.material_id)}\t${num(r.qty)}\t${r.note || ''}`));
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `日报_${dateStr}.txt`;
  a.click();
}

// -------------------- 总览 --------------------
async function renderOverview() {
  if (!$('#ovFrom').value) $('#ovFrom').value = daysAgoStr(29);
  if (!$('#ovTo').value) $('#ovTo').value = todayStr();
  const from = $('#ovFrom').value, to = $('#ovTo').value;
  const { startISO } = dayRangeISO(from);
  const { endISO } = dayRangeISO(to);

  const [c, p, s] = await Promise.all([
    sb.from('material_consumptions').select('qty, unit_price_snapshot, created_at').gte('created_at', startISO).lte('created_at', endISO),
    sb.from('production_records').select('qty, created_at').gte('created_at', startISO).lte('created_at', endISO),
    sb.from('shipment_records').select('qty, created_at').gte('created_at', startISO).lte('created_at', endISO)
  ]);

  const labels = [];
  const d0 = new Date(from), d1 = new Date(to);
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) labels.push(d.toLocaleDateString('en-CA'));

  const byDaySum = (rows, valFn) => {
    const m = {};
    for (const r of rows || []) { const k = localDateKey(r.created_at); m[k] = (m[k] || 0) + valFn(r); }
    return labels.map(d => m[d] || 0);
  };

  const consumeSeries = byDaySum(c.data, r => Number(r.qty));
  const costSeries = byDaySum(c.data, r => Number(r.qty) * Number(r.unit_price_snapshot || 0));
  const prodSeries = byDaySum(p.data, r => Number(r.qty));
  const shipSeries = byDaySum(s.data, r => Number(r.qty));

  destroyChart('consume');
  charts.consume = new Chart($('#consumeChart'), {
    type: 'bar',
    data: { labels, datasets: [{ label: '消耗数量', data: consumeSeries, backgroundColor: '#0f766e' }] },
    options: { plugins: { legend: { display: false } } }
  });

  destroyChart('prodship');
  charts.prodship = new Chart($('#prodShipChart'), {
    type: 'line',
    data: { labels, datasets: [
      { label: '生产', data: prodSeries, borderColor: '#0f766e', tension: 0.25 },
      { label: '出货', data: shipSeries, borderColor: '#f59e0b', tension: 0.25 }
    ] },
    options: { plugins: { legend: { position: 'bottom' } } }
  });

  destroyChart('ovcost');
  charts.ovcost = new Chart($('#overviewCostChart'), {
    type: 'line',
    data: { labels, datasets: [{ label: '成本', data: costSeries, borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.1)', fill: true, tension: 0.25 }] },
    options: { plugins: { legend: { display: false } } }
  });

  renderPhotoArchive(startISO, endISO);
}
$('#ovFrom').addEventListener('change', renderOverview);
$('#ovTo').addEventListener('change', renderOverview);

async function renderPhotoArchive(startISO, endISO) {
  const box = $('#photoArchive');
  box.innerHTML = '<p class="text-sm text-gray-400">加载中…</p>';
  const [c, p, s, pu] = await Promise.all([
    sb.from('material_consumptions').select('photo_url, material_id, created_at').gte('created_at', startISO).lte('created_at', endISO).not('photo_url', 'is', null),
    sb.from('production_records').select('photo_url, product_id, created_at').gte('created_at', startISO).lte('created_at', endISO).not('photo_url', 'is', null),
    sb.from('shipment_records').select('photo_url, product_id, created_at').gte('created_at', startISO).lte('created_at', endISO).not('photo_url', 'is', null),
    sb.from('material_purchases').select('photo_url, material_id, created_at').gte('created_at', startISO).lte('created_at', endISO).not('photo_url', 'is', null)
  ]);
  const items = [
    ...(c.data || []).map(r => ({ ...r, label: materialName(r.material_id) })),
    ...(p.data || []).map(r => ({ ...r, label: productName(r.product_id) })),
    ...(s.data || []).map(r => ({ ...r, label: productName(r.product_id) })),
    ...(pu.data || []).map(r => ({ ...r, label: materialName(r.material_id) }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!items.length) { box.innerHTML = '<p class="text-sm text-gray-400">该区间内没有照片</p>'; return; }

  const byDate = {};
  items.forEach(it => { const k = localDateKey(it.created_at); (byDate[k] = byDate[k] || []).push(it); });

  box.innerHTML = Object.keys(byDate).sort().reverse().map(date => `
    <div>
      <div class="text-xs text-gray-400 mb-1">${date}</div>
      <div class="flex gap-2 overflow-x-auto pb-1">
        ${byDate[date].map(it => `<a href="${it.photo_url}" target="_blank" title="${it.label}"><img src="${it.photo_url}" class="w-16 h-16 object-cover rounded-md flex-shrink-0" /></a>`).join('')}
      </div>
    </div>
  `).join('');
}

// -------------------- 设置: 原材料 --------------------
async function renderMaterialTable() {
  const { data } = await sb.from('materials').select('*').order('archived').order('name');
  $('#materialTable tbody').innerHTML = (data || []).map(m => `
    <tr class="border-t ${m.archived ? 'opacity-40' : ''}">
      <td class="px-2 py-2">${m.name}</td>
      <td class="px-2 py-2 text-center">${m.unit}</td>
      <td class="px-2 py-2 text-center">${money(m.unit_price)}</td>
      <td class="px-2 py-2 text-center">${num(m.reorder_threshold)}</td>
      <td class="px-2 py-2 text-center">${num(m.opening_stock)}</td>
      <td class="px-2 py-2 text-right whitespace-nowrap">
        <button class="text-teal-700 text-xs mr-2" onclick="editMaterial('${m.id}')">编辑</button>
        <button class="text-gray-400 text-xs" onclick="toggleArchiveMaterial('${m.id}', ${!m.archived})">${m.archived ? '恢复' : '归档'}</button>
      </td>
    </tr>`).join('');
}

window.editMaterial = async function (id) {
  const { data: m } = await sb.from('materials').select('*').eq('id', id).single();
  if (!m) return;
  const f = $('#materialForm');
  f.id.value = m.id; f.name.value = m.name; f.unit.value = m.unit;
  f.unit_price.value = m.unit_price; f.reorder_threshold.value = m.reorder_threshold; f.opening_stock.value = m.opening_stock;
  $('#materialCancelEdit').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.toggleArchiveMaterial = async function (id, archived) {
  await sb.from('materials').update({ archived }).eq('id', id);
  toast(archived ? '已归档' : '已恢复');
  await Promise.all([loadMaterials(), renderMaterialTable()]);
};
$('#materialCancelEdit').addEventListener('click', () => { $('#materialForm').reset(); $('#materialForm').id.value = ''; $('#materialCancelEdit').classList.add('hidden'); });

$('#materialForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = fd.get('id');
  const row = {
    name: fd.get('name'), unit: fd.get('unit'),
    unit_price: Number(fd.get('unit_price')) || 0,
    reorder_threshold: Number(fd.get('reorder_threshold')) || 0,
    opening_stock: Number(fd.get('opening_stock')) || 0
  };
  const { error } = id ? await sb.from('materials').update(row).eq('id', id) : await sb.from('materials').insert(row);
  if (error) { toast('保存失败: ' + error.message, true); return; }
  toast('已保存');
  e.target.reset(); e.target.id.value = ''; $('#materialCancelEdit').classList.add('hidden');
  await Promise.all([loadMaterials(), renderMaterialTable()]);
});

// -------------------- 设置: 产品 --------------------
async function renderProductTable() {
  const { data } = await sb.from('products').select('*').order('archived').order('name');
  $('#productTable tbody').innerHTML = (data || []).map(p => `
    <tr class="border-t ${p.archived ? 'opacity-40' : ''}">
      <td class="px-2 py-2 text-gray-400">${p.item_code || ''}</td>
      <td class="px-2 py-2">${p.name}</td>
      <td class="px-2 py-2 text-center">${p.unit}</td>
      <td class="px-2 py-2 text-center">${num(p.reorder_threshold)}</td>
      <td class="px-2 py-2 text-center">${num(p.opening_stock)}</td>
      <td class="px-2 py-2 text-right whitespace-nowrap">
        <button class="text-teal-700 text-xs mr-2" onclick="editProduct('${p.id}')">编辑</button>
        <button class="text-gray-400 text-xs" onclick="toggleArchiveProduct('${p.id}', ${!p.archived})">${p.archived ? '恢复' : '归档'}</button>
      </td>
    </tr>`).join('');
}

window.editProduct = async function (id) {
  const { data: p } = await sb.from('products').select('*').eq('id', id).single();
  if (!p) return;
  const f = $('#productForm');
  f.id.value = p.id; f.item_code.value = p.item_code || ''; f.name.value = p.name; f.unit.value = p.unit;
  f.reorder_threshold.value = p.reorder_threshold; f.opening_stock.value = p.opening_stock;
  $('#productCancelEdit').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.toggleArchiveProduct = async function (id, archived) {
  await sb.from('products').update({ archived }).eq('id', id);
  toast(archived ? '已归档' : '已恢复');
  await Promise.all([loadProducts(), renderProductTable()]);
};
$('#productCancelEdit').addEventListener('click', () => { $('#productForm').reset(); $('#productForm').id.value = ''; $('#productCancelEdit').classList.add('hidden'); });

$('#productForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = fd.get('id');
  const row = {
    item_code: fd.get('item_code') || null,
    name: fd.get('name'), unit: fd.get('unit'),
    reorder_threshold: Number(fd.get('reorder_threshold')) || 0,
    opening_stock: Number(fd.get('opening_stock')) || 0
  };
  const { error } = id ? await sb.from('products').update(row).eq('id', id) : await sb.from('products').insert(row);
  if (error) { toast('保存失败: ' + error.message, true); return; }
  toast('已保存');
  e.target.reset(); e.target.id.value = ''; $('#productCancelEdit').classList.add('hidden');
  await Promise.all([loadProducts(), renderProductTable()]);
});

// -------------------- 启动 --------------------
(async function start() {
  if (!initSupabase()) return;
  $('#dailyDate').value = todayStr();
  await Promise.all([loadMaterials(), loadProducts()]);
  await Promise.all([renderRecent(), renderMaterialTable(), renderProductTable()]);
})();
