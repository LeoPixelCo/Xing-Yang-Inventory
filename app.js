// ========================================================
// 电子台账 - app.js
// 纯前端 + Supabase 后端。所有配置在 config.js 里。
// ========================================================

const CFG = window.LEDGER_CONFIG || {};
let sb = null;
let materials = [];
let products = [];
let cashItems = []; // 现金采购品项清单(独立于原材料库)
let charts = {}; // 保存 Chart.js 实例,重绘前先销毁
let lastDaily = null; // 最近一次日报数据,供导出 PDF/CSV 使用

// -------------------- 工具函数 --------------------
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

// -------------------- 多语言(仅覆盖员工能看到的界面:解锁页 + 记录页) --------------------
const LANGS = ['zh', 'my', 'id'];
const LANG_LABELS = { zh: '中文', my: 'မြန်မာ', id: 'Indonesia' };
let lang = 'zh';
const I18N = {
  lockTitle: { zh: '请输入密码', my: 'စကားဝှက် ရိုက်ထည့်ပါ', id: 'Masukkan kata sandi' },
  lockSubtitle: { zh: '员工请输入员工密码;老板请输入老板密码查看全部功能', my: 'အလုပ်သမားစကားဝှက် ထည့်ပါ။ ပိုင်ရှင်/မန်နေဂျာဖြစ်ပါက လုပ်ဆောင်ချက်အားလုံးကြည့်ရန် စကားဝှက်အပြည့်အစုံ ထည့်ပါ', id: 'Karyawan masukkan kata sandi karyawan; pemilik masukkan kata sandi pemilik untuk melihat semua fitur' },
  lockError: { zh: '密码不对,再试一次', my: 'စကားဝှက် မှားနေပါသည်၊ ထပ်ကြိုးစားပါ', id: 'Kata sandi salah, coba lagi' },
  lockUnlock: { zh: '解锁', my: 'ဖွင့်ရန်', id: 'Buka' },
  appTitle: { zh: '电子台账', my: 'အီလက်ထရွောနစ် မှတ်တမ်း', id: 'Buku Catatan Digital' },
  connConnecting: { zh: '连接中…', my: 'ချိတ်ဆက်နေသည်…', id: 'Menyambungkan…' },
  connConnected: { zh: '已连接', my: 'ချိတ်ဆက်ပြီးပါပြီ', id: 'Tersambung' },
  connNotConfigured: { zh: '未配置', my: 'စနစ် မသတ်မှတ်ရသေးပါ', id: 'Belum diatur' },
  roleBoss: { zh: '老板模式', my: 'ပိုင်ရှင် မုဒ်', id: 'Mode Pemilik' },
  roleManager: { zh: '经理模式', my: 'မန်နေဂျာ မုဒ်', id: 'Mode Manajer' },
  roleStaff: { zh: '员工模式', my: 'ဝန်ထမ်း မုဒ်', id: 'Mode Karyawan' },
  switchRole: { zh: '切换', my: 'ပြောင်းရန်', id: 'Ganti' },
  navRecord: { zh: '记录', my: 'မှတ်တမ်း', id: 'Catatan' },
  subConsume: { zh: '原材料消耗', my: 'ကုန်ကြမ်းသုံးမှု', id: 'Pakai Bahan' },
  subProduce: { zh: '生产记录', my: 'ထုတ်လုပ်မှု', id: 'Produksi' },
  subShip: { zh: '出货记录', my: 'ကုန်ပို့မှု', id: 'Pengiriman' },
  subPurchase: { zh: '原材料入库', my: 'ကုန်သွင်းမှု', id: 'Terima Bahan' },
  subCashBuy: { zh: '现金采购', my: 'ငွေသားဝယ်ယူမှု', id: 'Beli Tunai' },
  lblMaterial: { zh: '原材料', my: 'ကုန်ကြမ်းပစ္စည်း', id: 'Bahan Baku' },
  lblProduct: { zh: '产品', my: 'ကုန်ချောပစ္စည်း', id: 'Produk' },
  lblQty: { zh: '数量', my: 'အရေအတွက်', id: 'Jumlah' },
  lblPurchaseQty: { zh: '入库数量', my: 'သွင်းယူသော အရေအတွက်', id: 'Jumlah Diterima' },
  lblDestination: { zh: '发往哪里', my: 'ဘယ်နေရာကို ပို့မလဲ', id: 'Dikirim ke mana' },
  lblPhoto: { zh: '照片', my: 'ဓာတ်ပုံ', id: 'Foto' },
  lblNote: { zh: '备注', my: 'မှတ်ချက်', id: 'Catatan' },
  lblSupplier: { zh: '从哪里买的', my: 'ဘယ်ကနေဝယ်တာလဲ', id: 'Beli dari mana' },
  lblCashItem: { zh: '品项', my: 'ပစ္စည်း', id: 'Barang' },
  lblItemName: { zh: '品名', my: 'ပစ္စည်းအမည်', id: 'Nama Barang' },
  lblUnit: { zh: '单位', my: 'ယူနစ်', id: 'Satuan' },
  phNewItemName: { zh: '新品项名称', my: 'ပစ္စည်းအမည် အသစ်', id: 'Nama barang baru' },
  phNewItemUnit: { zh: '单位(如 PKT / KG / BTL)', my: 'ယူနစ် (PKT / KG / BTL)', id: 'Satuan (PKT / KG / BTL)' },
  optNewCashItem: { zh: '+ 新品项(不在列表里)', my: '+ ပစ္စည်းအသစ် (စာရင်းမှာမပါ)', id: '+ Barang baru (belum ada di daftar)' },
  lblUnitPrice: { zh: '单价 (RM)', my: 'ဈေးနှုန်း (RM)', id: 'Harga Satuan (RM)' },
  cashBuyReceiptHint: { zh: '建议拍收据,方便报销对账', my: 'ငွေတောင်းလက်မှတ်ဓာတ်ပုံ ရိုက်ထားရင် ပိုကောင်းပါတယ်', id: 'Sebaiknya foto struk untuk klaim' },
  phOptional: { zh: '选填', my: 'မဖြည့်လည်းရ', id: 'opsional' },
  btnSubmitConsume: { zh: '提交消耗记录', my: 'မှတ်တမ်းပို့ရန်', id: 'Kirim' },
  btnSubmitProduce: { zh: '提交生产记录', my: 'မှတ်တမ်းပို့ရန်', id: 'Kirim' },
  btnSubmitShip: { zh: '提交出货记录', my: 'မှတ်တမ်းပို့ရန်', id: 'Kirim' },
  btnSubmitPurchase: { zh: '提交入库记录', my: 'မှတ်တမ်းပို့ရန်', id: 'Kirim' },
  btnSubmitCashBuy: { zh: '提交现金采购记录', my: 'မှတ်တမ်းပို့ရန်', id: 'Kirim' },
  recentTitle: { zh: '最近记录', my: 'မကြာသေးမီက မှတ်တမ်းများ', id: 'Catatan Terbaru' },
  recentEmpty: { zh: '还没有记录', my: 'မှတ်တမ်း မရှိသေးပါ', id: 'Belum ada catatan' },
  loadingText: { zh: '加载中…', my: 'ဖွင့်နေသည်…', id: 'Memuat…' },
  toastSubmitted: { zh: '已提交', my: 'ပို့ပြီးပါပြီ', id: 'Berhasil dikirim' },
  toastUploadingPhoto: { zh: '上传照片中…', my: 'ဓာတ်ပုံ တင်နေသည်…', id: 'Mengunggah foto…' },
  toastSubmitting: { zh: '提交中…', my: 'ပို့နေသည်…', id: 'Mengirim…' },
  selectNoMaterial: { zh: '(请先在设置中添加原材料)', my: '(ကျေးဇူးပြု၍ ကုန်ကြမ်းပစ္စည်း အရင်ထည့်ပါ)', id: '(Tambahkan bahan baku di Pengaturan dulu)' },
  selectNoProduct: { zh: '(请先在设置中添加产品)', my: '(ကျေးဇူးပြု၍ ကုန်ချောပစ္စည်း အရင်ထည့်ပါ)', id: '(Tambahkan produk di Pengaturan dulu)' }
};
function t(key) { return (I18N[key] && I18N[key][lang]) || (I18N[key] && I18N[key].zh) || key; }

let connState = 'connecting'; // 'connecting' | 'connected' | 'not_configured'
function updateConnStatusText() {
  // 连上了就把这个徽章收起来,省地方;没连上/出错才提示
  $('#connStatus').classList.toggle('hidden', connState === 'connected');
  if (connState === 'connected') return;
  const key = connState === 'not_configured' ? 'connNotConfigured' : 'connConnecting';
  $('#connStatus').textContent = t(key);
}

function applyI18n() {
  $all('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $all('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $all('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  updateConnStatusText();
}

function setLang(l) {
  if (!LANGS.includes(l)) return;
  lang = l;
  safeStorage.set('ledger_lang', l);
  applyI18n();
  if (currentRole) applyRole(currentRole); // 刷新 roleTag 文字
  if (sb && $('#tab-record').classList.contains('active')) renderRecent(); // 刷新"最近记录"里动态生成的文字
}

$all('.lang-btn').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
$('#langBtn').addEventListener('click', () => setLang(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]));

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

// 克重换算:某原材料是否按克追踪(设置了 pack_qty_grams 才算)
function isGramTracked(m) { return !!(m && Number(m.pack_qty_grams) > 0); }
// 库存/消耗记录用的计量单位文字
function stockUnitLabel(m) { return isGramTracked(m) ? 'g' : (m ? m.unit : ''); }
// 每 1 个记录单位(克重类=每克,否则=每采购单位)的成本
function pricePerBaseUnit(m) { return isGramTracked(m) ? (Number(m.unit_price) || 0) / Number(m.pack_qty_grams) : (Number(m.unit_price) || 0); }
// 把克数格式化成好读的 g / kg
function formatWeight(g) {
  const n = Number(g) || 0;
  return Math.abs(n) >= 1000 ? (n / 1000).toFixed(2) + ' kg' : Math.round(n) + ' g';
}

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

// -------------------- 身份(PIN 锁,仅界面层面) --------------------
let currentRole = null; // 'boss' | 'manager' | 'staff'
const STAFF_ALLOWED_TABS = ['record'];
const ROLE_I18N_KEYS = { boss: 'roleBoss', manager: 'roleManager', staff: 'roleStaff' };
function canDelete() { return currentRole === 'boss' || currentRole === 'manager'; }

// 删除一条记录(消耗/生产/出货/入库通用)。只有老板/经理能点到这个按钮,
// 但接口本身没有强制权限(见 README 安全性说明),这里再做一次前端拦截防误触。
window.deleteRecord = async function (table, id, refresh) {
  if (!canDelete()) return;
  if (!confirm('确定要删除这条记录吗?删除后无法恢复,库存和成本会立刻按删除后重新计算。')) return;
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) { toast('删除失败: ' + error.message, true); return; }
  toast('已删除');
  if (refresh === 'daily') renderDaily(); else renderRecent();
};

// 有些浏览器(比如 iOS Safari 开了"阻止所有 Cookie")会让 localStorage 直接抛错,
// 这里包一层,读写失败就退化成"这次打开先不记住身份",不让整个解锁流程卡死。
const safeStorage = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* 忽略,不阻塞解锁 */ } },
  remove(key) { try { localStorage.removeItem(key); } catch (e) { /* 忽略 */ } }
};

function applyRole(role) {
  currentRole = role;
  const isStaff = role === 'staff';
  $all('.nav-btn').forEach(b => { b.classList.toggle('hidden', isStaff && !STAFF_ALLOWED_TABS.includes(b.dataset.tab)); });
  $('#purchasePriceField')?.classList.toggle('hidden', isStaff);
  $('#roleTag').textContent = t(ROLE_I18N_KEYS[role]) || role;
  $('#roleTag').classList.remove('hidden');
  $('#switchRoleBtn').classList.remove('hidden');
  if (isStaff) switchTab('record');
}

function unlock(role) {
  safeStorage.set('ledger_role', role);
  $('#lockScreen').classList.add('hidden');
  applyRole(role);
}

$('#lockForm').addEventListener('submit', e => {
  e.preventDefault();
  const pin = $('#pinInput').value.trim();
  const pins = CFG.PINS || {};
  if (pin && pin === pins.boss) { unlock('boss'); return; }
  if (pin && pin === pins.manager) { unlock('manager'); return; }
  if (pin && pin === pins.staff) { unlock('staff'); return; }
  $('#pinError').textContent = t('lockError');
  $('#pinInput').value = '';
  $('#pinInput').focus();
});

$('#switchRoleBtn').addEventListener('click', () => {
  safeStorage.remove('ledger_role');
  location.reload();
});

function initRoleGate() {
  const saved = safeStorage.get('ledger_role');
  if (saved === 'boss' || saved === 'manager' || saved === 'staff') {
    $('#lockScreen').classList.add('hidden');
    applyRole(saved);
  } else {
    $('#lockScreen').classList.remove('hidden');
    $('#pinInput').focus();
  }
}

// -------------------- 初始化 --------------------
function initSupabase() {
  if (!CFG.SUPABASE_URL || CFG.SUPABASE_URL.includes('YOUR-PROJECT')) {
    connState = 'not_configured';
    updateConnStatusText();
    $('#connStatus').classList.add('bg-red-800');
    toast('请先在 config.js 里填入你的 Supabase 项目信息', true);
    return false;
  }
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  connState = 'connected';
  updateConnStatusText();
  return true;
}

async function loadMaterials() {
  const { data, error } = await sb.from('materials').select('*').eq('archived', false).order('name');
  if (error) { toast('读取原材料库失败: ' + error.message, true); return; }
  materials = data || [];
  const opts = materials.map(m => `<option value="${m.id}">${m.item_code ? m.item_code + ' ' : ''}${m.name}(${m.unit})</option>`).join('');
  $all('select[name="material_id"]').forEach(sel => { sel.innerHTML = opts || `<option value="">${t('selectNoMaterial')}</option>`; });
  loadConsumeOptions();
  updatePurchaseQtyUnit();
}

async function loadCashItems() {
  const { data, error } = await sb.from('cash_items').select('*').eq('archived', false).order('name');
  if (error) { toast('读取现金采购品项失败: ' + error.message, true); return; }
  cashItems = data || [];
  const opts = cashItems.map(i => `<option value="${i.id}">${i.name}(${i.unit})</option>`).join('');
  $all('select[name="cash_item_id"]').forEach(sel => {
    sel.innerHTML = opts + `<option value="__new__">${t('optNewCashItem')}</option>`;
  });
  updateCashbuyItemHint();
  loadConsumeOptions(); // 现金采购品项也要出现在"原材料消耗"的下拉里
}

async function loadProducts() {
  const { data, error } = await sb.from('products').select('*').eq('archived', false).order('name');
  if (error) { toast('读取产品库失败: ' + error.message, true); return; }
  products = data || [];
  const opts = products.map(p => `<option value="${p.id}">${p.item_code ? p.item_code + ' ' : ''}${p.name}(${p.unit})</option>`).join('');
  $all('select[name="product_id"]').forEach(sel => { sel.innerHTML = opts || `<option value="">${t('selectNoProduct')}</option>`; });
}

function materialName(id) { const m = materials.find(x => x.id === id); return m ? m.name : '(已删除的原材料)'; }
function productName(id) { const p = products.find(x => x.id === id); return p ? p.name : '(已删除的产品)'; }
function cashItemName(id) { const i = cashItems.find(x => x.id === id); return i ? i.name : '(已删除的品项)'; }
function cashItemUnit(id) { const i = cashItems.find(x => x.id === id); return i ? i.unit : ''; }

// 一条消耗记录可能是原材料,也可能是现金采购品项 —— 统一取名字和数量文字
function consumptionName(r) {
  return r.cash_item_id ? cashItemName(r.cash_item_id) : materialName(r.material_id);
}
function consumptionQtyLabel(r) {
  if (r.cash_item_id) return num(r.qty) + ' ' + cashItemUnit(r.cash_item_id);
  const m = materials.find(x => x.id === r.material_id);
  return isGramTracked(m) ? formatWeight(r.qty) : num(r.qty) + (m ? ' ' + m.unit : '');
}

// 选了品项之后:显示单位、把上次的价钱自动填进单价栏(可以改);
// 选"+ 新品项"则展开手动输入品名/单位的两个格子。
function updateCashbuyItemHint() {
  const sel = $('#form-cashbuy select[name="cash_item_id"]');
  if (!sel) return;
  const isNew = sel.value === '__new__';
  $('#cashbuyNewItemFields').classList.toggle('hidden', !isNew);
  const item = cashItems.find(i => i.id === sel.value);
  $('#cashbuyQtyUnit').textContent = item ? `(${item.unit})` : '';
  $('#cashbuyPriceUnit').textContent = item ? ` (每 ${item.unit})` : '';
  const priceInput = $('#form-cashbuy input[name="unit_price"]');
  if (item && !priceInput.dataset.touched) priceInput.value = item.last_price || '';
}

$('#form-cashbuy select[name="cash_item_id"]')?.addEventListener('change', () => {
  $('#form-cashbuy input[name="unit_price"]').dataset.touched = ''; // 换品项就重新带出该品项的价钱
  updateCashbuyItemHint();
});
$('#form-cashbuy input[name="unit_price"]')?.addEventListener('input', e => { e.target.dataset.touched = '1'; });

// -------------------- 消耗表单:原材料 + 现金采购品项 两个来源 --------------------
// 下拉的 value 用前缀区分:m:<id> = 原材料库,c:<id> = 现金采购品项。
// 现金采购的品项不进"原材料入库"(那张表单只认原材料库),但用掉了要能记消耗、算成本。
// 下拉选项:分"原材料"和"现金采购"两组,value 用 m:/c: 前缀区分
function targetOptionsHtml(selectedValue) {
  const sel = v => v === selectedValue ? ' selected' : '';
  const matOpts = materials.map(m => `<option value="m:${m.id}"${sel('m:' + m.id)}>${m.item_code ? m.item_code + ' ' : ''}${m.name}(${m.unit})</option>`).join('');
  const cashOpts = cashItems.map(i => `<option value="c:${i.id}"${sel('c:' + i.id)}>${i.name}(${i.unit})</option>`).join('');
  return (matOpts ? `<optgroup label="${t('lblMaterial')}">${matOpts}</optgroup>` : '') +
         (cashOpts ? `<optgroup label="${t('subCashBuy')}">${cashOpts}</optgroup>` : '');
}

// 解析 m:/c: 前缀的 value,统一返回:是哪种、对象、计量单位、每单位成本、是否按克
function resolveTarget(v) {
  if (!v) return null;
  if (v.startsWith('m:')) {
    const m = materials.find(x => x.id === v.slice(2));
    if (m) return { kind: 'material', obj: m, gram: isGramTracked(m), unit: stockUnitLabel(m), price: pricePerBaseUnit(m) };
  }
  if (v.startsWith('c:')) {
    const i = cashItems.find(x => x.id === v.slice(2));
    if (i) return { kind: 'cash', obj: i, gram: false, unit: i.unit, price: Number(i.last_price) || 0 };
  }
  return null;
}

function loadConsumeOptions() {
  const sel = $('#form-consume select[name="consume_target"]');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = targetOptionsHtml(prev) || `<option value="">${t('selectNoMaterial')}</option>`;
  updateConsumeQtyUnit();
}

function consumeTarget() {
  const sel = $('#form-consume select[name="consume_target"]');
  return sel ? resolveTarget(sel.value) : null;
}

// -------------------- 克重换算:表单单位提示 --------------------
function selectedMaterial(selectEl) { return materials.find(m => m.id === selectEl.value); }

function updateConsumeQtyUnit() {
  const hint = $('#consumeQtyUnit');
  const unitSelect = $('#consumeQtyUnitSelect');
  if (!hint || !unitSelect) return;
  const tgt = consumeTarget();
  // 克重类原材料给一个 g/kg 下拉自己选,其他的直接显示它自己的单位
  unitSelect.classList.toggle('hidden', !(tgt && tgt.gram));
  hint.textContent = (tgt && !tgt.gram) ? `(${tgt.unit})` : '';
  updateConsumeConvertHint();
}

// 用 kg 填的时候,底下提示换算成多少克(存进数据库的一律是克)
function updateConsumeConvertHint() {
  const qtyInput = $('#form-consume input[name="qty"]');
  const unitSelect = $('#consumeQtyUnitSelect');
  const hint = $('#consumeConvertHint');
  if (!qtyInput || !hint) return;
  const tgt = consumeTarget();
  const qty = Number(qtyInput.value);
  hint.textContent = (tgt && tgt.gram && unitSelect.value === 'kg' && qty > 0) ? `= ${Math.round(qty * 1000)} g` : '';
}

$('#consumeQtyUnitSelect')?.addEventListener('change', updateConsumeConvertHint);
$('#form-consume input[name="qty"]')?.addEventListener('input', updateConsumeConvertHint);
$('#form-consume select[name="consume_target"]')?.addEventListener('change', updateConsumeQtyUnit);

function updatePurchaseQtyUnit() {
  const sel = $('#form-purchase select[name="material_id"]');
  const unitEl = $('#purchaseQtyUnit');
  const priceUnitEl = $('#purchasePriceUnit');
  if (!sel || !unitEl) return;
  const m = selectedMaterial(sel);
  unitEl.textContent = m ? `(${m.unit})` : '';
  if (priceUnitEl) priceUnitEl.textContent = m ? ` (每 ${m.unit})` : '';
  updatePurchaseConvertHint();
}

function updatePurchaseConvertHint() {
  const sel = $('#form-purchase select[name="material_id"]');
  const qtyInput = $('#form-purchase input[name="qty"]');
  const hint = $('#purchaseConvertHint');
  if (!sel || !qtyInput || !hint) return;
  const m = selectedMaterial(sel);
  const qty = Number(qtyInput.value);
  if (m && isGramTracked(m) && qty > 0) {
    hint.textContent = `= ${formatWeight(qty * m.pack_qty_grams)}`;
  } else {
    hint.textContent = '';
  }
}

$('#form-consume select[name="material_id"]')?.addEventListener('change', updateConsumeQtyUnit);
$('#form-purchase select[name="material_id"]')?.addEventListener('change', updatePurchaseQtyUnit);
$('#form-purchase input[name="qty"]')?.addEventListener('input', updatePurchaseConvertHint);

// -------------------- 导航 --------------------
const TAB_TITLES = { record: '每日记录', stock: '库存', cost: '成本', calc: '成本计算', daily: '日报', overview: '后台总览', settings: '设置' };

function switchTab(tab) {
  if (currentRole === 'staff' && !STAFF_ALLOWED_TABS.includes(tab)) tab = 'record';
  $all('.tab-panel').forEach(p => p.classList.remove('active'));
  $(`#tab-${tab}`).classList.add('active');
  $all('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#pageTitle').textContent = tab === 'record' ? t('navRecord') : (TAB_TITLES[tab] || t('appTitle'));
  if (!sb) return; // 尚未配置 Supabase,不再往下发请求
  if (tab === 'stock') renderStock();
  if (tab === 'cost') renderCost();
  if (tab === 'calc') renderCalc();
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
  btn.textContent = t('toastSubmitting');
  try {
    let photoUrl = null;
    const file = fd.get('photo');
    if (file && file.size > 0) {
      btn.textContent = t('toastUploadingPhoto');
      photoUrl = await uploadPhoto(file);
    }
    const row = buildRow(fd, photoUrl);
    const { error } = await sb.from(table).insert(row);
    if (error) throw error;
    toast(t('toastSubmitted'));
    form.reset();
    if (form.id === 'form-consume') updateConsumeQtyUnit();
    if (form.id === 'form-purchase') updatePurchaseQtyUnit();
    renderRecent();
  } catch (err) {
    toast('提交失败: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

$('#form-consume').addEventListener('submit', e => handleRecordSubmit(e, 'material_consumptions', (fd, photo) => {
  const tgt = consumeTarget();
  // 克重类原材料可以选 g 或 kg 填,存进去的一律换算成克
  const entered = Number(fd.get('qty'));
  const qty = (tgt && tgt.gram && fd.get('qty_unit') === 'kg') ? entered * 1000 : entered;
  return {
    material_id: tgt && tgt.kind === 'material' ? tgt.obj.id : null,
    cash_item_id: tgt && tgt.kind === 'cash' ? tgt.obj.id : null,
    qty,
    unit_price_snapshot: tgt ? tgt.price : 0,
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
  const qty = Number(fd.get('qty'));
  return {
    material_id: fd.get('material_id') || null,
    qty,
    qty_base: mat && isGramTracked(mat) ? qty * mat.pack_qty_grams : qty,
    unit_price: price ? Number(price) : (mat ? mat.unit_price : 0),
    note: fd.get('note') || null,
    photo_url: photo
  };
}));

// 现金采购提交:选的是"+ 新品项"就先把品项写进 cash_items 再记这笔账;
// 记完顺手把该品项的 last_price 更新成这次的价钱,下次选它就自动带出最新价。
$('#form-cashbuy').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const fd = new FormData(form);
  const price = Number(fd.get('unit_price')) || 0;
  let itemId = fd.get('cash_item_id');

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = t('toastSubmitting');
  try {
    if (itemId === '__new__') {
      const name = (fd.get('new_item_name') || '').trim();
      const unit = (fd.get('new_item_unit') || '').trim();
      if (!name || !unit) { toast('新品项要填名称和单位', true); return; }
      const { data, error } = await sb.from('cash_items').insert({ name, unit, last_price: price }).select('id').single();
      if (error) throw error;
      itemId = data.id;
    }

    let photoUrl = null;
    const file = fd.get('photo');
    if (file && file.size > 0) {
      btn.textContent = t('toastUploadingPhoto');
      photoUrl = await uploadPhoto(file);
    }

    const { error: insErr } = await sb.from('cash_purchases').insert({
      cash_item_id: itemId,
      qty: Number(fd.get('qty')),
      unit_price: price,
      supplier: fd.get('supplier') || null,
      note: fd.get('note') || null,
      photo_url: photoUrl
    });
    if (insErr) throw insErr;

    await sb.from('cash_items').update({ last_price: price }).eq('id', itemId);

    toast(t('toastSubmitted'));
    form.reset();
    await loadCashItems();
    renderRecent();
  } catch (err) {
    toast('提交失败: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// -------------------- 最近记录 --------------------
async function renderRecent() {
  const box = $('#recentList');
  box.innerHTML = `<p class="text-sm text-gray-400">${t('loadingText')}</p>`;
  const [c, p, s, pu, cb] = await Promise.all([
    sb.from('material_consumptions').select('*').order('created_at', { ascending: false }).limit(5),
    sb.from('production_records').select('*').order('created_at', { ascending: false }).limit(5),
    sb.from('shipment_records').select('*').order('created_at', { ascending: false }).limit(5),
    sb.from('material_purchases').select('*').order('created_at', { ascending: false }).limit(5),
    sb.from('cash_purchases').select('*').order('created_at', { ascending: false }).limit(5)
  ]);
  const items = [
    ...(c.data || []).map(r => ({ ...r, kind: t('subConsume'), label: consumptionName(r), qtyLabel: consumptionQtyLabel(r), table: 'material_consumptions' })),
    ...(p.data || []).map(r => ({ ...r, kind: t('subProduce'), label: productName(r.product_id), qtyLabel: num(r.qty), table: 'production_records' })),
    ...(s.data || []).map(r => ({ ...r, kind: t('subShip'), label: productName(r.product_id), qtyLabel: num(r.qty), table: 'shipment_records' })),
    ...(pu.data || []).map(r => { const m = materials.find(x => x.id === r.material_id); return { ...r, kind: t('subPurchase'), label: materialName(r.material_id), qtyLabel: num(r.qty) + (m ? ' ' + m.unit : ''), table: 'material_purchases' }; }),
    ...(cb.data || []).map(r => ({ ...r, kind: t('subCashBuy'), label: cashItemName(r.cash_item_id), qtyLabel: money(r.qty * r.unit_price), table: 'cash_purchases' }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

  if (!items.length) { box.innerHTML = `<p class="text-sm text-gray-400">${t('recentEmpty')}</p>`; return; }
  box.innerHTML = items.map(it => `
    <div class="flex items-center gap-3 bg-white rounded-lg p-2.5 shadow-sm">
      ${it.photo_url ? `<a href="${it.photo_url}" target="_blank"><img src="${it.photo_url}" class="w-12 h-12 object-cover rounded-md" /></a>` : `<div class="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center text-gray-300 text-xs">无图</div>`}
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium">${it.kind} · ${it.label}</div>
        <div class="text-xs text-gray-400">${fmtTime(it.created_at)}${it.note ? ' · ' + it.note : ''}</div>
      </div>
      <div class="text-sm font-semibold text-teal-700">${it.qtyLabel}</div>
      ${canDelete() ? `<button class="text-red-600 text-xs px-1" onclick="deleteRecord('${it.table}','${it.id}','recent')">删除</button>` : ''}
    </div>
  `).join('');
}

// -------------------- 库存 --------------------
async function computeMaterialStock() {
  const [purchases, consumptions] = await Promise.all([
    sb.from('material_purchases').select('material_id, qty, qty_base'),
    sb.from('material_consumptions').select('material_id, qty')
  ]);
  // qty_base 是换算成库存计量单位(克重类=克,否则=采购单位)后的入库数量;
  // 旧记录没有 qty_base 时退回用 qty(等价于未换算前的行为)。
  const normalizedPurchases = (purchases.data || []).map(r => ({ material_id: r.material_id, qty: r.qty_base != null ? r.qty_base : r.qty }));
  const pMap = sumBy(normalizedPurchases, 'material_id', 'qty');
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
      <td class="px-3 py-2 text-right ${m.stock <= m.reorder_threshold ? 'text-red-600 font-semibold' : ''}">${isGramTracked(m) ? formatWeight(m.stock) : num(m.stock) + ' ' + m.unit}</td>
      <td class="px-3 py-2 text-right text-gray-400">${isGramTracked(m) ? formatWeight(m.reorder_threshold) : num(m.reorder_threshold)}</td>
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

// -------------------- 成本计算(配方计算器) --------------------
let calcRows = []; // [{ material_id, qty }]
let calcRowSeq = 0;

// 一行填的数量换算成"计价单位"的数量:克重类原材料选了 kg 就乘 1000
function calcRowBaseQty(row) {
  const qty = Number(row.qty) || 0;
  const tgt = resolveTarget(row.target);
  return (tgt && tgt.gram && row.unit === 'kg') ? qty * 1000 : qty;
}

function calcRowSubtotal(row) {
  const tgt = resolveTarget(row.target);
  return tgt ? calcRowBaseQty(row) * tgt.price : 0;
}

function renderCalcRows() {
  $('#calcRows').innerHTML = calcRows.map(row => {
    const tgt = resolveTarget(row.target);
    const unitCell = (tgt && tgt.gram)
      ? `<select class="calc-unit-select border rounded-lg px-1 py-1.5 text-xs w-14 shrink-0">
           <option value="g" ${row.unit !== 'kg' ? 'selected' : ''}>g</option>
           <option value="kg" ${row.unit === 'kg' ? 'selected' : ''}>kg</option>
         </select>`
      : `<span class="calc-unit text-xs text-gray-400 w-14 shrink-0 text-center">${tgt ? tgt.unit : ''}</span>`;
    return `
    <div class="calc-row bg-white rounded-xl p-3 shadow-sm flex items-center gap-2" data-row="${row.rowId}">
      <select class="calc-material flex-1 min-w-0 border rounded-lg px-2 py-1.5 text-sm">${targetOptionsHtml(row.target) || `<option value="">${t('selectNoMaterial')}</option>`}</select>
      <input type="number" step="any" min="0" value="${row.qty || ''}" placeholder="0" class="calc-qty w-16 border rounded-lg px-2 py-1.5 text-sm text-right" />
      ${unitCell}
      <span class="calc-subtotal text-sm font-medium text-teal-700 w-20 shrink-0 text-right">${money(calcRowSubtotal(row))}</span>
      <button type="button" class="calc-remove text-red-600 text-xs shrink-0">✕</button>
    </div>`;
  }).join('') || '<p class="text-sm text-gray-400 text-center py-2">还没有添加原材料</p>';
  updateCalcTotals();
}

function updateCalcTotals() {
  let total = 0;
  $all('.calc-row').forEach(rowEl => {
    const row = calcRows.find(r => String(r.rowId) === rowEl.dataset.row);
    if (!row) return;
    const subtotal = calcRowSubtotal(row);
    rowEl.querySelector('.calc-subtotal').textContent = money(subtotal);
    total += subtotal;
  });
  const yield_ = Number($('#calcYield').value) || 0;
  $('#calcTotal').textContent = money(total);
  $('#calcPerUnit').textContent = yield_ > 0 ? money(total / yield_) : '—';
}

$('#calcRows').addEventListener('input', e => {
  const rowEl = e.target.closest('.calc-row');
  if (!rowEl) return;
  const row = calcRows.find(r => String(r.rowId) === rowEl.dataset.row);
  if (!row) return;
  if (e.target.classList.contains('calc-qty')) { row.qty = Number(e.target.value) || 0; updateCalcTotals(); }
});
$('#calcRows').addEventListener('change', e => {
  const rowEl = e.target.closest('.calc-row');
  if (!rowEl) return;
  const row = calcRows.find(r => String(r.rowId) === rowEl.dataset.row);
  if (!row) return;
  if (e.target.classList.contains('calc-material')) {
    row.target = e.target.value;
    row.unit = 'g'; // 换了品项就重置单位选择
    renderCalcRows();  // 重画这行(可能要从"固定单位"变成 g/kg 下拉,或反过来)
  }
  if (e.target.classList.contains('calc-unit-select')) {
    row.unit = e.target.value;
    updateCalcTotals();
  }
});
$('#calcRows').addEventListener('click', e => {
  if (!e.target.classList.contains('calc-remove')) return;
  const rowEl = e.target.closest('.calc-row');
  calcRows = calcRows.filter(r => String(r.rowId) !== rowEl.dataset.row);
  renderCalcRows();
});

$('#calcAddRowBtn').addEventListener('click', () => {
  calcRows.push({ rowId: ++calcRowSeq, target: materials[0] ? 'm:' + materials[0].id : '', qty: 0, unit: 'g' });
  renderCalcRows();
});
$('#calcYield').addEventListener('input', updateCalcTotals);

$('#calcClearBtn').addEventListener('click', () => {
  calcRows = [];
  $('#calcYield').value = 1;
  $('#calcProductSelect').value = '';
  updateCalcProductButtons();
  renderCalcRows();
});

async function updateCalcProductButtons() {
  const productId = $('#calcProductSelect').value;
  $('#calcYieldUnit').textContent = '';
  if (!productId) {
    $('#calcSaveBtn').classList.add('hidden');
    $('#calcLoadBtn').classList.add('hidden');
    return;
  }
  const p = products.find(x => x.id === productId);
  $('#calcYieldUnit').textContent = p ? p.unit : '';
  $('#calcSaveBtn').classList.remove('hidden');
  const { data } = await sb.from('product_recipe').select('id').eq('product_id', productId).limit(1);
  $('#calcLoadBtn').classList.toggle('hidden', !data || !data.length);
}

$('#calcProductSelect').addEventListener('change', updateCalcProductButtons);

$('#calcLoadBtn').addEventListener('click', async () => {
  const productId = $('#calcProductSelect').value;
  if (!productId) return;
  const { data, error } = await sb.from('product_recipe').select('*').eq('product_id', productId);
  if (error) { toast('读取配方失败: ' + error.message, true); return; }
  // 配方里存的是"每份用量",克重类的存的是克数,载入时就用 g 显示
  calcRows = (data || []).map(r => ({
    rowId: ++calcRowSeq,
    target: r.cash_item_id ? 'c:' + r.cash_item_id : 'm:' + r.material_id,
    // 每份用量可能除不尽(比如 2 包 ÷ 3 份),保留 4 位小数就够了,免得输入框里一长串
    qty: Math.round((Number(r.qty_per_unit) || 0) * 10000) / 10000,
    unit: 'g'
  }));
  $('#calcYield').value = 1;
  renderCalcRows();
  toast('已载入配方');
});

$('#calcSaveBtn').addEventListener('click', async () => {
  const productId = $('#calcProductSelect').value;
  if (!productId) return;
  const yield_ = Number($('#calcYield').value) || 0;
  if (yield_ <= 0) { toast('请先填写"这次产出数量"(大于0),才能换算成每份用量', true); return; }
  const rows = calcRows.filter(r => r.target && r.qty > 0);
  if (!rows.length) { toast('还没有添加任何原材料', true); return; }
  if (!confirm('保存后会覆盖这个产品之前保存的标准配方,确定吗?')) return;
  const btn = $('#calcSaveBtn');
  btn.disabled = true;
  try {
    const { error: delErr } = await sb.from('product_recipe').delete().eq('product_id', productId);
    if (delErr) throw delErr;
    // 存的是换算后的用量(克重类=克),跟消耗记录的计量方式一致
    const payload = rows.map(r => {
      const tgt = resolveTarget(r.target);
      return {
        product_id: productId,
        material_id: tgt && tgt.kind === 'material' ? tgt.obj.id : null,
        cash_item_id: tgt && tgt.kind === 'cash' ? tgt.obj.id : null,
        qty_per_unit: calcRowBaseQty(r) / yield_
      };
    });
    const { error: insErr } = await sb.from('product_recipe').insert(payload);
    if (insErr) throw insErr;
    toast('已保存标准配方');
    updateCalcProductButtons();
  } catch (err) {
    toast('保存失败: ' + err.message, true);
  } finally {
    btn.disabled = false;
  }
});

function renderCalc() {
  const opts = products.map(p => `<option value="${p.id}">${p.item_code ? p.item_code + ' ' : ''}${p.name}</option>`).join('');
  const sel = $('#calcProductSelect');
  const current = sel.value;
  sel.innerHTML = '<option value="">— 不关联,只是快速算算 —</option>' + opts;
  sel.value = current;
  if (!calcRows.length) calcRows.push({ rowId: ++calcRowSeq, target: materials[0] ? 'm:' + materials[0].id : '', qty: 0, unit: 'g' });
  renderCalcRows();
  updateCalcProductButtons();
}

// -------------------- 日报 --------------------
async function renderDaily() {
  const dateStr = $('#dailyDate').value || todayStr();
  $('#dailyDate').value = dateStr;
  const { startISO, endISO } = dayRangeISO(dateStr);

  const [c, p, s, pu, cb] = await Promise.all([
    sb.from('material_consumptions').select('*').gte('created_at', startISO).lte('created_at', endISO).order('created_at'),
    sb.from('production_records').select('*').gte('created_at', startISO).lte('created_at', endISO).order('created_at'),
    sb.from('shipment_records').select('*').gte('created_at', startISO).lte('created_at', endISO).order('created_at'),
    sb.from('material_purchases').select('*').gte('created_at', startISO).lte('created_at', endISO).order('created_at'),
    sb.from('cash_purchases').select('*').gte('created_at', startISO).lte('created_at', endISO).order('created_at')
  ]);

  const cost = (c.data || []).reduce((sum, r) => sum + Number(r.qty) * Number(r.unit_price_snapshot || 0), 0);
  const cashTotal = (cb.data || []).reduce((sum, r) => sum + Number(r.qty) * Number(r.unit_price || 0), 0);
  const [mStock, pStock] = await Promise.all([computeMaterialStock(), computeProductStock()]);

  const section = (title, rows, render) => `
    <div class="bg-white rounded-xl p-4 shadow-sm">
      <h3 class="font-medium mb-2">${title} <span class="text-gray-400 text-sm">(${rows.length})</span></h3>
      ${rows.length ? `<div class="space-y-1.5 text-sm">${rows.map(render).join('')}</div>` : '<p class="text-sm text-gray-400">无记录</p>'}
    </div>`;
  const delBtn = (table, id) => canDelete() ? `<button class="text-red-600 text-xs ml-2" onclick="deleteRecord('${table}','${id}','daily')">删除</button>` : '';

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
      <div class="bg-white rounded-xl p-3 shadow-sm text-center col-span-2">
        <div class="text-xs text-gray-400">当日现金采购总额</div>
        <div class="text-lg font-semibold text-teal-700">${money(cashTotal)}</div>
      </div>
    </div>
    ${section('原材料消耗', c.data || [], r => `<div class="flex justify-between items-center border-b pb-1"><span>${consumptionName(r)}${r.note ? ' · ' + r.note : ''}</span><span>${consumptionQtyLabel(r)}${delBtn('material_consumptions', r.id)}</span></div>`)}
    ${section('生产记录', p.data || [], r => `<div class="flex justify-between items-center border-b pb-1"><span>${productName(r.product_id)}${r.note ? ' · ' + r.note : ''}</span><span>${num(r.qty)}${delBtn('production_records', r.id)}</span></div>`)}
    ${section('出货记录', s.data || [], r => `<div class="flex justify-between items-center border-b pb-1"><span>${productName(r.product_id)}${r.destination ? ' → ' + r.destination : ''}</span><span>${num(r.qty)}${delBtn('shipment_records', r.id)}</span></div>`)}
    ${section('原材料入库', pu.data || [], r => { const m = materials.find(x => x.id === r.material_id); return `<div class="flex justify-between items-center border-b pb-1"><span>${materialName(r.material_id)}${r.note ? ' · ' + r.note : ''}</span><span>${num(r.qty)} ${m ? m.unit : ''}${delBtn('material_purchases', r.id)}</span></div>`; })}
    ${section('现金采购', cb.data || [], r => `<div class="flex justify-between items-center border-b pb-1"><span>${cashItemName(r.cash_item_id)} × ${num(r.qty)} ${cashItemUnit(r.cash_item_id)}${r.supplier ? ' · ' + r.supplier : ''}${r.note ? ' · ' + r.note : ''}</span><span>${money(r.qty * r.unit_price)}${delBtn('cash_purchases', r.id)}</span></div>`)}
    <div class="bg-white rounded-xl p-4 shadow-sm">
      <h3 class="font-medium mb-2">当日结束库存快照 · 原材料</h3>
      <div class="text-sm space-y-1">
        ${mStock.map(m => `<div class="flex justify-between"><span>${m.name}</span><span class="${m.stock <= m.reorder_threshold ? 'text-red-600 font-semibold' : ''}">${isGramTracked(m) ? formatWeight(m.stock) : num(m.stock) + ' ' + m.unit}</span></div>`).join('') || '<p class="text-sm text-gray-400">暂无原材料</p>'}
      </div>
    </div>
    <div class="bg-white rounded-xl p-4 shadow-sm">
      <h3 class="font-medium mb-2">当日结束库存快照 · 产品</h3>
      <div class="text-sm space-y-1">
        ${pStock.map(p2 => `<div class="flex justify-between"><span>${p2.name}</span><span class="${p2.stock <= p2.reorder_threshold ? 'text-red-600 font-semibold' : ''}">${num(p2.stock)} ${p2.unit}</span></div>`).join('') || '<p class="text-sm text-gray-400">暂无产品</p>'}
      </div>
    </div>
  `;

  lastDaily = { dateStr, c: c.data || [], p: p.data || [], s: s.data || [], pu: pu.data || [], cb: cb.data || [], cost, cashTotal, mStock, pStock };
}
$('#dailyDate').addEventListener('change', renderDaily);

// -------------------- 日报导出: PDF(打印模板) / CSV --------------------
function rptRows(cols, rows, emptyText) {
  if (!rows.length) return `<div class="rpt-empty">${emptyText}</div>`;
  return `<table class="rpt-table"><thead><tr>${cols.map(c => `<th class="${c.num ? 'num' : ''}">${c.label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c.num ? 'num' : ''}">${c.get(r)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function buildDailyReportHTML(d) {
  const genTime = new Date().toLocaleString('zh-CN');
  const consumeRows = d.c.map(r => {
    const m = materials.find(x => x.id === r.material_id);
    const perGram = !r.cash_item_id && isGramTracked(m);
    return { name: consumptionName(r), qty: consumptionQtyLabel(r), price: money(r.unit_price_snapshot) + (perGram ? '/g' : ''), subtotal: money(Number(r.qty) * Number(r.unit_price_snapshot || 0)), note: r.note || '' };
  });
  const prodRows = d.p.map(r => ({ name: productName(r.product_id), qty: num(r.qty), note: r.note || '' }));
  const shipRows = d.s.map(r => ({ name: productName(r.product_id), qty: num(r.qty), dest: r.destination || '', note: r.note || '' }));
  const purchaseRows = d.pu.map(r => {
    const m = materials.find(x => x.id === r.material_id);
    return { name: materialName(r.material_id), qty: num(r.qty) + ' ' + (m ? m.unit : ''), price: money(r.unit_price), note: r.note || '' };
  });
  const cashBuyRows = d.cb.map(r => ({ name: cashItemName(r.cash_item_id), supplier: r.supplier || '', qty: num(r.qty) + ' ' + cashItemUnit(r.cash_item_id), price: money(r.unit_price), subtotal: money(r.qty * r.unit_price), note: r.note || '' }));

  const mStockRows = d.mStock.map(m => ({ name: m.name, qty: isGramTracked(m) ? formatWeight(m.stock) : num(m.stock) + ' ' + m.unit, low: m.stock <= m.reorder_threshold }));
  const pStockRows = d.pStock.map(p => ({ name: p.name, qty: num(p.stock) + ' ' + p.unit, low: p.stock <= p.reorder_threshold }));
  const stockTable = rows => rows.length ? `<table class="rpt-table">
        <thead><tr><th>品项</th><th class="num">剩余库存</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r.name}</td><td class="num" style="${r.low ? 'color:#dc2626; font-weight:700;' : ''}">${r.qty}</td></tr>`).join('')}</tbody>
      </table>` : '<div class="rpt-empty">暂无数据</div>';

  return `
    <div style="font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; color:#111827;">
      <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #0f766e; padding-bottom:10px; margin-bottom:14px;">
        <div>
          <div style="font-size:18px; font-weight:700;">${CFG.BUSINESS_NAME || '电子台账'}</div>
          <div style="font-size:13px; color:#6b7280; margin-top:2px;">每日台账报告 · Daily Ledger Report</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:20px; font-weight:700; color:#0f766e;">${d.dateStr}</div>
          <div style="font-size:11px; color:#9ca3af;">生成时间 ${genTime}</div>
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-bottom:16px;">
        <div style="flex:1; border:1px solid #d1d5db; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:11px; color:#6b7280;">当日原材料成本</div>
          <div style="font-size:18px; font-weight:700; color:#0f766e;">${money(d.cost)}</div>
        </div>
        <div style="flex:1; border:1px solid #d1d5db; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:11px; color:#6b7280;">生产笔数</div>
          <div style="font-size:18px; font-weight:700;">${d.p.length}</div>
        </div>
        <div style="flex:1; border:1px solid #d1d5db; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:11px; color:#6b7280;">出货笔数</div>
          <div style="font-size:18px; font-weight:700;">${d.s.length}</div>
        </div>
        <div style="flex:1; border:1px solid #d1d5db; border-radius:8px; padding:10px; text-align:center;">
          <div style="font-size:11px; color:#6b7280;">现金采购总额</div>
          <div style="font-size:18px; font-weight:700; color:#0f766e;">${money(d.cashTotal)}</div>
        </div>
      </div>

      <div style="font-size:13px; font-weight:700; margin:14px 0 6px;">原材料消耗</div>
      ${rptRows([{ label: '原材料', get: r => r.name }, { label: '数量', get: r => r.qty, num: true }, { label: '单价', get: r => r.price, num: true }, { label: '小计', get: r => r.subtotal, num: true }, { label: '备注', get: r => r.note }], consumeRows, '当日无消耗记录')}

      <div style="font-size:13px; font-weight:700; margin:14px 0 6px;">生产记录</div>
      ${rptRows([{ label: '产品', get: r => r.name }, { label: '数量', get: r => r.qty, num: true }, { label: '备注', get: r => r.note }], prodRows, '当日无生产记录')}

      <div style="font-size:13px; font-weight:700; margin:14px 0 6px;">出货记录</div>
      ${rptRows([{ label: '产品', get: r => r.name }, { label: '数量', get: r => r.qty, num: true }, { label: '发往', get: r => r.dest }, { label: '备注', get: r => r.note }], shipRows, '当日无出货记录')}

      <div style="font-size:13px; font-weight:700; margin:14px 0 6px;">原材料入库</div>
      ${rptRows([{ label: '原材料', get: r => r.name }, { label: '数量', get: r => r.qty, num: true }, { label: '采购单价', get: r => r.price, num: true }, { label: '备注', get: r => r.note }], purchaseRows, '当日无入库记录')}

      <div style="font-size:13px; font-weight:700; margin:14px 0 6px;">现金采购</div>
      ${rptRows([{ label: '品名', get: r => r.name }, { label: '来源', get: r => r.supplier }, { label: '数量', get: r => r.qty, num: true }, { label: '单价', get: r => r.price, num: true }, { label: '小计', get: r => r.subtotal, num: true }, { label: '备注', get: r => r.note }], cashBuyRows, '当日无现金采购记录')}

      <div style="font-size:13px; font-weight:700; margin:14px 0 6px;">当日结束库存快照 · 原材料</div>
      ${stockTable(mStockRows)}

      <div style="font-size:13px; font-weight:700; margin:14px 0 6px;">当日结束库存快照 · 产品</div>
      ${stockTable(pStockRows)}

      <div style="margin-top:18px; font-size:10px; color:#9ca3af; text-align:center;">由电子台账系统自动生成</div>
    </div>`;
}

function exportDailyPDF() {
  if (!lastDaily) return;
  $('#printArea').innerHTML = buildDailyReportHTML(lastDaily);
  window.print();
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportDailyCSV() {
  if (!lastDaily) return;
  const d = lastDaily;
  const rows = [['类型', '品项', '数量', '单价/成本', '备注/发往', '时间']];
  d.c.forEach(r => rows.push(['原材料消耗', consumptionName(r), consumptionQtyLabel(r), money(r.unit_price_snapshot), r.note || '', fmtTime(r.created_at)]));
  d.p.forEach(r => rows.push(['生产', productName(r.product_id), num(r.qty), '', r.note || '', fmtTime(r.created_at)]));
  d.s.forEach(r => rows.push(['出货', productName(r.product_id), num(r.qty), '', r.destination || '', fmtTime(r.created_at)]));
  d.pu.forEach(r => { const m = materials.find(x => x.id === r.material_id); rows.push(['原材料入库', materialName(r.material_id), num(r.qty) + ' ' + (m ? m.unit : ''), money(r.unit_price), r.note || '', fmtTime(r.created_at)]); });
  d.cb.forEach(r => rows.push(['现金采购', cashItemName(r.cash_item_id), num(r.qty) + ' ' + cashItemUnit(r.cash_item_id), money(r.unit_price), [r.supplier, r.note].filter(Boolean).join(' · '), fmtTime(r.created_at)]));
  rows.push([]);
  rows.push(['当日原材料成本', money(d.cost)]);
  rows.push(['当日现金采购总额', money(d.cashTotal)]);
  const csv = '﻿' + rows.map(row => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `日报_${d.dateStr}.csv`;
  a.click();
}

$('#exportDailyPdfBtn').addEventListener('click', exportDailyPDF);
$('#exportDailyCsvBtn').addEventListener('click', exportDailyCSV);

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
      <td class="px-3 py-2 text-gray-400 whitespace-nowrap">${m.item_code || ''}</td>
      <td class="px-3 py-2">${m.name}</td>
      <td class="px-3 py-2 text-center whitespace-nowrap">${m.unit}</td>
      <td class="px-3 py-2 text-center whitespace-nowrap">${money(m.unit_price)}</td>
      <td class="px-3 py-2 text-center whitespace-nowrap">${isGramTracked(m) ? money(pricePerBaseUnit(m)) + '/g' : '—'}</td>
      <td class="px-3 py-2 text-center whitespace-nowrap">${isGramTracked(m) ? formatWeight(m.reorder_threshold) : num(m.reorder_threshold)}</td>
      <td class="px-3 py-2 text-center whitespace-nowrap">${isGramTracked(m) ? formatWeight(m.opening_stock) : num(m.opening_stock)}</td>
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
  f.id.value = m.id; f.item_code.value = m.item_code || ''; f.name.value = m.name; f.unit.value = m.unit;
  f.unit_price.value = m.unit_price; f.pack_qty_grams.value = m.pack_qty_grams || '';
  f.reorder_threshold.value = m.reorder_threshold; f.opening_stock.value = m.opening_stock;
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
  const packQty = fd.get('pack_qty_grams');
  const row = {
    item_code: fd.get('item_code') || null,
    name: fd.get('name'), unit: fd.get('unit'),
    unit_price: Number(fd.get('unit_price')) || 0,
    pack_qty_grams: packQty ? Number(packQty) : null,
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
      <td class="px-3 py-2 text-gray-400 whitespace-nowrap">${p.item_code || ''}</td>
      <td class="px-3 py-2">${p.name}</td>
      <td class="px-3 py-2 text-center whitespace-nowrap">${p.unit}</td>
      <td class="px-3 py-2 text-center whitespace-nowrap">${num(p.reorder_threshold)}</td>
      <td class="px-3 py-2 text-center whitespace-nowrap">${num(p.opening_stock)}</td>
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

// -------------------- 设置: 现金采购品项 --------------------
async function renderCashItemTable() {
  const { data } = await sb.from('cash_items').select('*').order('archived').order('name');
  $('#cashItemTable tbody').innerHTML = (data || []).map(i => `
    <tr class="border-t ${i.archived ? 'opacity-40' : ''}">
      <td class="px-3 py-2">${i.name}</td>
      <td class="px-3 py-2 text-center whitespace-nowrap">${i.unit}</td>
      <td class="px-3 py-2 text-center whitespace-nowrap">${money(i.last_price)}</td>
      <td class="px-3 py-2 text-right whitespace-nowrap">
        <button class="text-teal-700 text-xs mr-2" onclick="editCashItem('${i.id}')">编辑</button>
        <button class="text-gray-400 text-xs" onclick="toggleArchiveCashItem('${i.id}', ${!i.archived})">${i.archived ? '恢复' : '归档'}</button>
      </td>
    </tr>`).join('');
}

window.editCashItem = async function (id) {
  const { data: i } = await sb.from('cash_items').select('*').eq('id', id).single();
  if (!i) return;
  const f = $('#cashItemForm');
  f.id.value = i.id; f.name.value = i.name; f.unit.value = i.unit; f.last_price.value = i.last_price;
  $('#cashItemCancelEdit').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
window.toggleArchiveCashItem = async function (id, archived) {
  await sb.from('cash_items').update({ archived }).eq('id', id);
  toast(archived ? '已归档' : '已恢复');
  await Promise.all([loadCashItems(), renderCashItemTable()]);
};
$('#cashItemCancelEdit').addEventListener('click', () => { $('#cashItemForm').reset(); $('#cashItemForm').id.value = ''; $('#cashItemCancelEdit').classList.add('hidden'); });

$('#cashItemForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = fd.get('id');
  const row = { name: fd.get('name'), unit: fd.get('unit'), last_price: Number(fd.get('last_price')) || 0 };
  const { error } = id ? await sb.from('cash_items').update(row).eq('id', id) : await sb.from('cash_items').insert(row);
  if (error) { toast('保存失败: ' + error.message, true); return; }
  toast('已保存');
  e.target.reset(); e.target.id.value = ''; $('#cashItemCancelEdit').classList.add('hidden');
  await Promise.all([loadCashItems(), renderCashItemTable()]);
});

// -------------------- 设置页:导出/导入 Excel(批量编辑) --------------------
// 每张表的列定义:key=数据库字段,label=Excel 表头,type=写回时怎么转换
const XLSX_TABLES = {
  materials: {
    fileName: '原材料库',
    reload: async () => { await loadMaterials(); await renderMaterialTable(); },
    cols: [
      { key: 'id', label: 'id(勿改)', type: 'text' },
      { key: 'item_code', label: '编号', type: 'text' },
      { key: 'name', label: '名称', type: 'text', required: true },
      { key: 'unit', label: '采购单位', type: 'text', required: true },
      { key: 'unit_price', label: '采购单价RM', type: 'number' },
      { key: 'pack_qty_grams', label: '每采购单位克数', type: 'numberOrNull' },
      { key: 'reorder_threshold', label: '预警线', type: 'number' },
      { key: 'opening_stock', label: '期初库存', type: 'number' },
      { key: 'archived', label: '已归档', type: 'bool' }
    ]
  },
  products: {
    fileName: '产品库',
    reload: async () => { await loadProducts(); await renderProductTable(); },
    cols: [
      { key: 'id', label: 'id(勿改)', type: 'text' },
      { key: 'item_code', label: '编号', type: 'text' },
      { key: 'name', label: '名称', type: 'text', required: true },
      { key: 'unit', label: '单位', type: 'text', required: true },
      { key: 'reorder_threshold', label: '预警线', type: 'number' },
      { key: 'opening_stock', label: '期初库存', type: 'number' },
      { key: 'archived', label: '已归档', type: 'bool' }
    ]
  },
  cash_items: {
    fileName: '现金采购品项',
    reload: async () => { await loadCashItems(); await renderCashItemTable(); },
    cols: [
      { key: 'id', label: 'id(勿改)', type: 'text' },
      { key: 'name', label: '品项名称', type: 'text', required: true },
      { key: 'unit', label: '单位', type: 'text', required: true },
      { key: 'last_price', label: '最近价格RM', type: 'number' },
      { key: 'archived', label: '已归档', type: 'bool' }
    ]
  }
};

window.exportSettingsXlsx = async function (tableKey) {
  const cfg = XLSX_TABLES[tableKey];
  const { data, error } = await sb.from(tableKey).select('*').order('archived').order('name');
  if (error) { toast('导出失败: ' + error.message, true); return; }
  const rows = (data || []).map(r => {
    const o = {};
    cfg.cols.forEach(c => {
      let v = r[c.key];
      if (c.type === 'bool') v = v ? '是' : '';
      if (v === null || v === undefined) v = '';
      o[c.label] = v;
    });
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(rows, { header: cfg.cols.map(c => c.label) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, cfg.fileName);
  XLSX.writeFile(wb, `${cfg.fileName}_${todayStr()}.xlsx`);
  toast('已导出');
};

window.importSettingsXlsx = async function (tableKey, input) {
  const file = input.files && input.files[0];
  input.value = ''; // 清掉,方便下次选同一个文件也能触发
  if (!file) return;
  const cfg = XLSX_TABLES[tableKey];
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!raw.length) { toast('这个文件里没有数据', true); return; }

    const updates = [], inserts = [], skipped = [];
    raw.forEach((r, idx) => {
      const row = {};
      let bad = null;
      cfg.cols.forEach(c => {
        if (c.key === 'id') return;
        const v = r[c.label];
        if (c.type === 'text') row[c.key] = (v === '' || v == null) ? null : String(v).trim();
        else if (c.type === 'bool') row[c.key] = (String(v).trim() === '是' || v === true);
        else if (c.type === 'numberOrNull') row[c.key] = (v === '' || v == null) ? null : Number(v);
        else row[c.key] = Number(v) || 0;
        if (c.required && !row[c.key]) bad = c.label;
      });
      if (bad) { skipped.push(`第 ${idx + 2} 行(缺少${bad})`); return; }
      const id = String(r[cfg.cols[0].label] || '').trim();
      if (id) { row.id = id; updates.push(row); } else { inserts.push(row); }
    });

    const msg = `准备写入「${cfg.fileName}」:\n更新 ${updates.length} 条,新增 ${inserts.length} 条` +
      (skipped.length ? `\n跳过 ${skipped.length} 条:${skipped.slice(0, 5).join('、')}${skipped.length > 5 ? '…' : ''}` : '') +
      `\n\n注意:表格里没有的品项不会被删除。确定吗?`;
    if (!confirm(msg)) return;

    if (updates.length) {
      const { error } = await sb.from(tableKey).upsert(updates);
      if (error) throw error;
    }
    if (inserts.length) {
      const { error } = await sb.from(tableKey).insert(inserts);
      if (error) throw error;
    }
    toast(`已更新 ${updates.length} 条,新增 ${inserts.length} 条`);
    await cfg.reload();
  } catch (err) {
    toast('导入失败: ' + err.message, true);
  }
};

// -------------------- 启动 --------------------
(async function start() {
  const savedLang = safeStorage.get('ledger_lang');
  if (LANGS.includes(savedLang)) lang = savedLang;
  applyI18n();
  initRoleGate();
  if (!initSupabase()) return;
  $('#dailyDate').value = todayStr();
  await Promise.all([loadMaterials(), loadProducts(), loadCashItems()]);
  await Promise.all([renderRecent(), renderMaterialTable(), renderProductTable(), renderCashItemTable()]);
})();
