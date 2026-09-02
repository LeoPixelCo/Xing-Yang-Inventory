-- ========================================================
-- 批量导入原材料库(从 PURCHASE INV JULY.pdf 的 33 张采购发票整理,共 66 款)
-- 使用方法:先运行过最新版 schema.sql(确保 materials 表已有 item_code /
-- pack_qty_grams 字段),再在 Supabase 的 SQL Editor 里粘贴运行本文件。
--
-- unit_price 用的是该原材料【最近一次采购】的单价(每 1 个采购单位,如每 BAG/CTN),是真实成本价。
--
-- pack_qty_grams = 每 1 个采购单位换算多少克,从品名里的包装规格算出来的,例如:
--   P1 SUGAR (50KG) 按 BAG 采购 → 1 BAG = 50000g
--   TEPUNG GANDUM (10X1KG) 按 BOX 采购 → 1 BOX = 10 x 1000g = 10000g
--   直接按 KG 采购的(unit=KG)→ 1 KG = 1000g
-- 填了这个值的原材料,消耗记录会直接用【克】登记,成本按每克单价自动算;
-- 以下几款品名里看不出重量(比如按 CTN/PKT/TRAY/PCS/NOS 计,没写清楚多重),
-- pack_qty_grams 留空,继续按采购单位(不换算成克)登记和算成本:
--   W-1004(TRAY)、S-1004(PKT)、K-1004/K-1003(CTN 咖啡粉,包装克数不明)、
--   C-1007(CTN 茶叶,包装克数不明)、D-1002(按 ML 液体,不是重量单位)、
--   N-1001/B-1001/C-1014(按 NOS/PCS 计件,不是重量)
-- 想让这些也按克算,请告诉我每包/每罐/每箱实际多少克,我再补上换算值。
--
-- reorder_threshold(预警线)、opening_stock(期初库存)PDF 里没有对应数据,先留空(默认 0)。
-- 导入后请到「设置 → 原材料库」页手动补上 —— 克重类原材料这两个数请直接填【克】数
-- (比如现有 12.5kg 白糖库存,期初库存填 12500,不是 12.5)。
--
-- 如果之前跑过一次,重复运行会再插入一份重复数据 —— 只需要跑一次。
-- ========================================================

insert into materials (item_code, name, unit, unit_price, pack_qty_grams) values
('W-1004', 'WHOLE EGG - GRADE B', 'TRAY', 13.20, null),
('P-1001', 'P1 SUGAR (50KG)', 'BAG', 185.00, 50000),
('S-1002', 'SAWIT EMAS MINYAK MASAK (4X5KG)', 'CTN', 120.00, 20000),
('T-1001', 'TEPUNG GANDUM (ANCHOR) (10X1KG)', 'BOX', 30.00, 10000),
('G-1004', 'GARAM HALUS (12X450G)', 'PKT', 8.40, 5400),
('U-1001', 'UDANG GERAGAU', 'KG', 12.50, 1000),
('I-1004', 'IKAN BILIS MM (10KG)', 'CTN', 140.00, 10000),
('S-1011', 'SWEET HOME GULA BATU (3KG)', 'PKT', 25.00, 3000),
('A-1005', 'AJI MIX (10X1KG)', 'CTN', 180.00, 10000),
('A-1002', 'AJINOMOTO (20X1KG)', 'CTN', 285.00, 20000),
('S-1003', 'SODA BLUE (12X100G)', 'DOZ', 26.00, 1200),
('B-1006', 'BUAH KERAS', 'KG', 18.00, 1000),
('U-1002', 'UDANG KERING (1KG)', 'KG', 65.00, 1000),
('F-1011', 'FLOUNDER FISH (3KG)', 'PKT', 180.00, 3000),
('P-1020', 'PEARL BARLEY', 'KG', 5.00, 1000),
('A-1004', 'AA WHITE COFFEE', 'KG', 26.00, 1000),
('K-1011', 'KICAP CAIR CAP PANDA (6KG)', 'BTL', 31.50, 6000),
('T-1010', 'TAUCU HALUS (3KG)', 'JAR', 19.00, 3000),
('K-1012', 'KARAMEL PEKAT (6KG)', 'BTL', 39.50, 6000),
('T-1011', 'TAUCU MANIS (3KG)', 'JAR', 19.00, 3000),
('S-1013', 'SOS BERPERISA TIRAM (5KG)', 'BTL', 17.50, 5000),
('S-1014', 'SOS CILI BAWANG PUTIH (3KG)', 'BTL', 13.50, 3000),
('T-1012', 'TAUCU MANIS HITAM (1KG)', 'PKT', 6.50, 1000),
('C-1010', 'CUKA PUTIH (4.5KG)', 'BTL', 14.00, 4500),
('S-1004', 'SERI KAYA PASTE B', 'PKT', 27.30, null),
('K-1004', 'KOPI PREMIUM HAINANESE COFFEE', 'CTN', 250.00, null),
('K-1003', 'KOPI SPECIAL ROAST', 'CTN', 210.00, null),
('P-1005', 'PORK OIL', 'KG', 5.00, 1000),
('F-1001', 'FRZ PORK MINCED MEAT (1KG)', 'KG', 17.00, 1000),
('B-1004', 'BAWANG PUTIH', 'KG', 7.00, 1000),
('B-1003', 'BAWANG KECIL', 'KG', 4.00, 1000),
('C-1001', 'CILI MERAH', 'KG', 8.00, 1000),
('C-1004', 'CILI HIJAU', 'KG', 5.50, 1000),
('C-1002', 'CILI PADI MERAH (5KG)', 'BOX', 48.00, 5000),
('C-1009', 'CILI PADI HIJAU', 'KG', 10.00, 1000),
('C-1003', 'CILI KAMPUNG', 'KG', 18.00, 1000),
('H-1001', 'HALIA TUA', 'KG', 8.00, 1000),
('S-1001', 'SERAI', 'KG', 25.00, 1000),
('L-1003', 'LIMAU KASTURI', 'KG', 3.80, 1000),
('N-1001', 'NANAS', 'NOS', 4.30, null),
('P-1014', 'PORK SHOULDER', 'KG', 18.00, 1000),
('B-1005', 'BELACAN SHRIMP (500G)', 'PKT', 6.20, 500),
('D-1002', 'DEER BRAND PURE SESAME OIL (12X630ML)', 'DOZ', 180.00, null),
('W-1002', 'WHITE SESAME SEEDS', 'KG', 12.00, 1000),
('T-1007', 'TLC GREEN PEAS (24x425G)', 'CTN', 54.00, 10200),
('B-1001', 'BUNGA KANTAN', 'PCS', 2.20, null),
('B-1002', 'BAWANG BESAR', 'KG', 10.00, 1000),
('L-1001', 'LENGKUAS', 'KG', 8.00, 1000),
('D-1001', 'DAUN KARI', 'KG', 15.00, 1000),
('F-1006', 'FRY-OLA SHORTENING NH 4480 16KG', 'CTN', 111.30, 16000),
('B-1009', 'BUNGA MAS MARGERINE 18KG', 'CTN', 106.00, 18000),
('P-1021', 'PORK COLLAR', 'KG', 23.00, 1000),
('K-1009', 'KACANG TANAH INDIA (20KG)', 'BAG', 140.00, 20000),
('P-1018', 'PANDA OYSTER SAUCE (6X2.2KG)', 'CTN', 138.00, 13200),
('C-1012', 'CHEONG CHAN COOKING CARAMEL (6X3KG)', 'CTN', 188.00, 18000),
('G-1006', 'GARAM HALUS (40KG)', 'BAG', 28.00, 40000),
('K-1005', 'KOPI UNCANG 20 X 18G WITH SUGAR STICK', 'CTN', 102.00, 360),
('K-1006', 'KOPI UNCANG 10 X 18G INDIVIDUALLY PACKED WITH SUGAR STICK', 'CTN', 69.00, 180),
('C-1007', 'CEYLON TEA', 'CTN', 180.00, null),
('H-1006', 'HAM FAKE BELLY', 'KG', 17.00, 1000),
('P-1022', 'PORK BIG BONE', 'KG', 5.90, 1000),
('C-1014', 'CHICKEN BONE', 'PCS', 0.70, null),
('O-1001', 'OLD CHICKEN', 'KG', 10.50, 1000),
('P-1015', 'PLANTA MARGERINE (2X4.8KG)', 'CTN', 140.00, 9600),
('C-1005', 'CILI KERING KERINTING (668) (3KG)', 'BAG', 45.00, 3000),
('W-1007', 'WHITE PEPPER SEED', 'KG', 55.00, 1000);
