-- ========================================================
-- 批量导入产品库(从 Item Code Summary 报表导入,共 49 款)
-- 使用方法:先运行过 schema.sql(确保 products 表已有 item_code 字段),
-- 再在 Supabase 的 SQL Editor 里粘贴运行本文件。
--
-- 单价(unit_price 在这里用不到,products 表本来就没有单价字段)、
-- 预警线 reorder_threshold、期初库存 opening_stock 都先留空(默认 0),
-- 因为原报表里的 Qty/Amount 是某段时间的销量汇总,不是成本单价或库存数,
-- 后面请到「设置」页里手动为每个产品补上正确的期初库存和预警线。
--
-- 如果某个 item_code 已经导入过一次,重复运行本文件会再插入一条重复记录 ——
-- 只需要跑一次即可。
-- ========================================================

insert into products (item_code, name, unit) values
('B-0003', 'BARBECUED PORK PUFF (28PCS)', 'TRAY'),
('B-0005', 'BIG BOX (250PCS)', 'UNIT'),
('B-0006', 'BLACK COFFEE POWDER (10KG)', 'CTN'),
('B-0008', 'BLACK COFFEE PROCESSING (10KG)', 'CTN'),
('C-0002', 'CURRY PASTE', 'PKT'),
('C-0003', 'CURRY SAMBAL (1KG)', 'PKT'),
('C-0005', 'CRISPY BEANCURD SKIN', 'PKT'),
('C-0006', 'CHICKEN FLOSS & CORN CREAM PUFF (15PCS)', 'TRAY'),
('C-0009', 'CHICKEN FLOSS CUP CAKE (24PCS)', 'TRAY'),
('C-0010', 'CHOCOLATE CUP CAKE (24PCS)', 'TRAY'),
('E-0001', 'EGG SPONGE CAKE (15PCS)', 'PCS'),
('E-0001', 'EGG SPONGE CAKE (15PCS)', 'TRAY'),
('F-0001', 'FISH BALL (50PCS)', 'PKT'),
('F-0002', 'FISH CURRY PASTE (1KG)', 'PKT'),
('F-0004', 'FROZEN FISH PASTE (1KG)', 'PKT'),
('F-0005', 'FROZEN WANTAN PORK MEAT (1KG)', 'PKT'),
('F-0006', 'FROZEN WANTAN PRAWN MEAT (1KG)', 'PKT'),
('F-0007', 'FISH CHILI SAUCE (1KG)', 'PKT'),
('G-0001', 'GLUTINOUS RICE (40PCS)', 'PKT'),
('H-0002', 'HAKKA PORK', 'KG'),
('H-0003', 'HAKKA MEAT POWDER', 'UNIT'),
('H-0005', 'HAKKA NOODLES SAUCE (1KG)', 'PKT'),
('I-0001', 'INSTANT COFFEE POWDER (10PKT@18G)', 'CTN'),
('I-0002', 'INSTANT COFFEE POWDER (20PKT@18G)', 'CTN'),
('K-0001', 'KAMPAR CHILI SAUCE', 'UNIT'),
('K-0002', 'KAMPAR FRIED PORK BALL (50PCS)', 'PKT'),
('K-0003', 'KAMPAR PORK BALL (50PCS)', 'PKT'),
('K-0004', 'KAMPAR TAUHU (50PCS)', 'PKT'),
('K-0005', 'KAYA BUTTER PUFF (32PCS)', 'PCS'),
('K-0005', 'KAYA BUTTER PUFF (32PCS)', 'TRAY'),
('K-0006', 'KAYA PASTE (1KG)', 'PKT'),
('K-0007', 'KAMPAR BEANCURD SKIN (50PCS)', 'PKT'),
('N-0001', 'NASI LEMAK SAMBAL', 'PKT'),
('O-0001', 'OLD CHICKEN PORK BONE SOUP (1KG)', 'PKT'),
('P-0005', 'PRAWN SHELL', 'KG'),
('P-0007', 'PRAWN (1KG)', 'BAG'),
('P-0008', 'PAN MEE CHILI', 'PKT'),
('P-0009', 'PAN MEE BELACAN CHILI', 'PKT'),
('P-0010', 'PIGGY BARBECUED PUFF (30PCS)', 'TRAY'),
('P-0011', 'PAN MEE NOODLES', 'KG'),
('P-0012', 'PRAWN SOUP (1KG)', 'PKT'),
('S-0003', 'SMALL BOX (250PCS)', 'UNIT'),
('S-0006', 'SAGOT FISH CAKE', 'BAG'),
('T-0001', 'TEA POWDER', 'CTN'),
('T-0002', 'TAIWAN SAUSAGE (10PCS)', 'PKT'),
('T-0003', 'TAIWAN SAUSAGE MINI (20PCS)', 'PKT'),
('W-0001', 'WALNUT COOKIES (15PKT@5PCS)', 'CTN'),
('W-0003', 'WHITE COFFEE POWDER (8KG)', 'CTN'),
('W-0005', 'WANTAN NOODLES SAUCE (1KG)', 'PKT');
