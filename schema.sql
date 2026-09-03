-- ========================================================
-- 电子台账 数据库结构 (Supabase / Postgres)
-- 使用方法: 在 Supabase 项目的 SQL Editor 里粘贴并运行整份文件
-- ========================================================

-- 原材料库
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  item_code text,          -- 对应你原有采购系统里的 Item Code(如 W-1004),可为空
  name text not null,
  unit text not null,      -- 采购单位(如 BAG/CTN/PKT),入库时按这个单位计数
  unit_price numeric not null default 0,      -- 成本单价(每 1 个采购单位,如每 BAG)
  pack_qty_grams numeric,  -- 每 1 个采购单位换算多少克(如 1 BAG=50KG 就填 50000);
                           -- 留空/0 表示该原材料不按克追踪,消耗/库存仍按 unit 计
  reorder_threshold numeric not null default 0, -- 预警线(克重类原材料按克,否则按 unit)
  opening_stock numeric not null default 0,    -- 期初库存(克重类原材料按克,否则按 unit)
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
-- 如果 materials 表是在加这些字段之前建的,补一条:
alter table materials add column if not exists item_code text;
alter table materials add column if not exists pack_qty_grams numeric;

-- 产品库
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  item_code text,          -- 对应你原有系统里的 Item Code(如 B-0003),可为空
  name text not null,
  unit text not null,
  reorder_threshold numeric not null default 0,
  opening_stock numeric not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
-- 如果 products 表是在加这个字段之前建的,补一条:
alter table products add column if not exists item_code text;

-- 产品的标准原材料消耗比例 (可选,用于分摊单位产品成本)
create table if not exists product_recipe (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  material_id uuid not null references materials(id) on delete cascade,
  qty_per_unit numeric not null default 0
);

-- 原材料采购入库 (让库存不会一直减到负数)
create table if not exists material_purchases (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materials(id) on delete set null,
  qty numeric not null,     -- 按采购单位计的数量(如买了几 BAG),给人看的
  qty_base numeric,         -- 换算成库存计量单位后的数量(克重类原材料=qty*pack_qty_grams,
                             -- 否则等于 qty);库存计算用这个字段,不用 qty
  unit_price numeric,       -- 本次采购单价(每 1 个采购单位),留空则用原材料当前单价
  note text,
  photo_url text,
  created_at timestamptz not null default now()
);
alter table material_purchases add column if not exists qty_base numeric;

-- 现金采购(自己/员工掏现金买的,不走供应商发票,单独记一笔方便报销/对账;
-- 品名是自由填写的,不强制对应原材料库里的品项,因为很多是巴刹/杂货店零星采购)
create table if not exists cash_purchases (
  id uuid primary key default gen_random_uuid(),
  supplier text,            -- 从哪里买的,选填(可能没有正式店名)
  item_name text not null,  -- 品名(自由填写)
  qty numeric not null,
  unit text not null,
  unit_price numeric not null default 0,
  note text,
  photo_url text,           -- 收据照片
  created_at timestamptz not null default now()
);
alter table cash_purchases enable row level security;
drop policy if exists "allow all" on cash_purchases;
create policy "allow all" on cash_purchases for all using (true) with check (true);

-- 原材料消耗 (每日记录)
create table if not exists material_consumptions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materials(id) on delete set null,
  qty numeric not null,     -- 克重类原材料=消耗的克数;否则按 unit 计
  unit_price_snapshot numeric not null default 0, -- 记录当时"每 1 个 qty 单位"的单价
                             -- (克重类=每克成本,否则=每 unit 成本),成本计算更准确
  note text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- 生产记录
create table if not exists production_records (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  qty numeric not null,
  note text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- 出货记录
create table if not exists shipment_records (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  qty numeric not null,
  destination text,
  note text,
  photo_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mc_created on material_consumptions(created_at);
create index if not exists idx_mp_created on material_purchases(created_at);
create index if not exists idx_pr_created on production_records(created_at);
create index if not exists idx_sr_created on shipment_records(created_at);
create index if not exists idx_mc_material on material_consumptions(material_id);
create index if not exists idx_pr_product on production_records(product_id);
create index if not exists idx_sr_product on shipment_records(product_id);

-- ========================================================
-- 行级安全 (RLS)
-- 这是一个没有登录系统的内部工具:只要拿到 URL + anon key(前端代码里都能看到)
-- 就能读写全部数据。适合"团队内部用同一个链接"的场景,不适合公开发布。
-- 如果以后要限制权限,需要引入 Supabase Auth 并改写这里的策略。
-- ========================================================
alter table materials enable row level security;
alter table products enable row level security;
alter table product_recipe enable row level security;
alter table material_purchases enable row level security;
alter table material_consumptions enable row level security;
alter table production_records enable row level security;
alter table shipment_records enable row level security;

drop policy if exists "allow all" on materials;
create policy "allow all" on materials for all using (true) with check (true);

drop policy if exists "allow all" on products;
create policy "allow all" on products for all using (true) with check (true);

drop policy if exists "allow all" on product_recipe;
create policy "allow all" on product_recipe for all using (true) with check (true);

drop policy if exists "allow all" on material_purchases;
create policy "allow all" on material_purchases for all using (true) with check (true);

drop policy if exists "allow all" on material_consumptions;
create policy "allow all" on material_consumptions for all using (true) with check (true);

drop policy if exists "allow all" on production_records;
create policy "allow all" on production_records for all using (true) with check (true);

drop policy if exists "allow all" on shipment_records;
create policy "allow all" on shipment_records for all using (true) with check (true);

-- ========================================================
-- 图片存储桶
-- 在 Supabase 后台 Storage 页面手动创建一个名为 ledger-photos 的 bucket,
-- 勾选 "Public bucket"。然后运行下面两条策略,允许匿名上传和读取。
-- (如果在 SQL Editor 里执行下面两行报错 "must be owner of table objects",
--  改为在 Storage > ledger-photos > Policies 页面用图形界面新增策略即可。)
-- ========================================================
insert into storage.buckets (id, name, public)
values ('ledger-photos', 'ledger-photos', true)
on conflict (id) do nothing;

drop policy if exists "ledger photos public read" on storage.objects;
create policy "ledger photos public read" on storage.objects
  for select using (bucket_id = 'ledger-photos');

drop policy if exists "ledger photos public upload" on storage.objects;
create policy "ledger photos public upload" on storage.objects
  for insert with check (bucket_id = 'ledger-photos');
