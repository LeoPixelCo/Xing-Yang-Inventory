-- ========================================================
-- 8 月采购数据更新(从《2026年8月采购汇总.xlsx》整理,已经直接跑在你的正式数据库上了,
-- 这份文件只是留档记录这次改了什么,不需要你再手动运行 —— 除非你是拿一个全新的
-- Supabase 项目重新搭一遍,才需要按顺序跑:schema.sql → seed_materials.sql →
-- seed_products.sql → 本文件。
-- ========================================================

-- 1) 8 款原材料按 8 月最新采购价更新(单位没变,直接改单价)
update materials set unit_price = 10.50 where item_code = 'B-1002'; -- BAWANG BESAR: 10.00 -> 10.50
update materials set unit_price = 4.50  where item_code = 'B-1003'; -- BAWANG KECIL: 4.00 -> 4.50
update materials set unit_price = 7.20  where item_code = 'B-1004'; -- BAWANG PUTIH: 7.00 -> 7.20
update materials set unit_price = 40.00 where item_code = 'C-1002'; -- CILI PADI MERAH (5KG): 48.00 -> 40.00
update materials set unit_price = 6.80  where item_code = 'C-1004'; -- CILI HIJAU: 5.50 -> 6.80
update materials set unit_price = 4.00  where item_code = 'L-1003'; -- LIMAU KASTURI: 3.80 -> 4.00
update materials set unit_price = 20.00 where item_code = 'P-1021'; -- PORK COLLAR: 23.00 -> 20.00
update materials set unit_price = 15.30 where item_code = 'W-1004'; -- WHOLE EGG - GRADE B: 13.20 -> 15.30

-- 2) 3 款原材料 8 月的采购单位跟系统里记的不一样,没有自动改,先留意一下,
--    要不要改单位/换算需要你自己判断(改错了库存和成本会算错):
--    C-1001 CILI MERAH   系统记 KG(RM8),8 月最新一笔是按 BOX 买的(RM38,不确定一箱几公斤)
--    C-1014 CHICKEN BONE 系统记 PCS(RM0.7),8 月最新一笔是按 KG 买的(RM2/KG)
--    O-1001 OLD CHICKEN  系统记 KG(RM10.5),8 月最新一笔是按 UNIT 买的(RM8/只,不确定一只几公斤)

-- 3) 16 款 8 月新出现、原材料库里还没有的品项,已经批量加进去了:
insert into materials (item_code, name, unit, unit_price, pack_qty_grams) values
('A-1001', 'ABC TROPIOCA STARCH (10X1KG)', 'BOX', 38.00, 10000),
('B-1007', 'BEAN CURD SKIN', 'PCS', 0.70, null),
('B-1010', 'BUTTERSUB BUTTER OIL SUBSTITUTE 16KG', 'CTN', 157.50, 16000),
('C-1017', 'CHICKEN FLUFF (6KG)', 'UNIT', 277.20, 6000),
('E-1001', 'EGG TART 1 X 140PCS', 'TRAY', 98.00, null),
('G-1002', 'GULA MELAKA (10KG)', 'BOX', 53.00, 10000),
('I-1003', 'ISI TENGGERI BESAR', 'PKT', 25.00, null),
('P-1002', 'PORK BALL', 'PCS', 0.45, null),
('P-1013', 'PUD 100/200 (700/GRAMS)', 'PKT', 24.50, 700),
('P-1016', 'PORK MIXED BONES', 'KG', 10.00, 1000),
('P-1017', 'PORK TAIL BONES', 'KG', 10.00, 1000),
('P-1027', 'PORK BELLY', 'KG', 19.00, 1000),
('S-1005', 'SODIUM SILICATE (12X900ML)', 'DOZ', 95.00, null),
('S-1016', 'SAGOT', 'UNIT', 15.00, null),
('Y-1001', 'YONG TAUHU', 'PCS', 0.70, null),
('Y-1004', 'YELLOW TAIL FILLET', 'KG', 34.00, 1000)
on conflict do nothing;
