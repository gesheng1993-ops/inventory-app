-- Supabase 数据库迁移脚本
-- 在 Supabase SQL Editor 中执行

-- 库存表
CREATE TABLE IF NOT EXISTS inventory_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    min_threshold DECIMAL(10,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 出入库记录表
CREATE TABLE IF NOT EXISTS stock_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('in','out')),
    quantity DECIMAL(10,2) NOT NULL,
    operator TEXT NOT NULL DEFAULT '',
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 班次表
CREATE TABLE IF NOT EXISTS shifts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    time_range TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0
);

-- 班次职责表
CREATE TABLE IF NOT EXISTS shift_duties (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shift_id BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    duties TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0
);

-- ==================== 出入库函数（保证原子性） ====================

-- 入库
CREATE OR REPLACE FUNCTION stock_in(
    p_item_id BIGINT,
    p_quantity DECIMAL,
    p_operator TEXT,
    p_note TEXT DEFAULT ''
) RETURNS inventory_items AS $$
DECLARE
    v_item inventory_items;
BEGIN
    UPDATE inventory_items
    SET quantity = quantity + p_quantity, updated_at = NOW()
    WHERE id = p_item_id;

    INSERT INTO stock_logs (item_id, type, quantity, operator, note)
    VALUES (p_item_id, 'in', p_quantity, p_operator, p_note);

    SELECT * INTO v_item FROM inventory_items WHERE id = p_item_id;
    RETURN v_item;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 出库
CREATE OR REPLACE FUNCTION stock_out(
    p_item_id BIGINT,
    p_quantity DECIMAL,
    p_operator TEXT,
    p_note TEXT DEFAULT ''
) RETURNS inventory_items AS $$
DECLARE
    v_item inventory_items;
BEGIN
    SELECT * INTO v_item FROM inventory_items WHERE id = p_item_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '食材不存在';
    END IF;
    IF v_item.quantity < p_quantity THEN
        RAISE EXCEPTION '库存不足，当前仅剩 % %', v_item.quantity, v_item.unit;
    END IF;

    UPDATE inventory_items
    SET quantity = quantity - p_quantity, updated_at = NOW()
    WHERE id = p_item_id;

    INSERT INTO stock_logs (item_id, type, quantity, operator, note)
    VALUES (p_item_id, 'out', p_quantity, p_operator, p_note);

    SELECT * INTO v_item FROM inventory_items WHERE id = p_item_id;
    RETURN v_item;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== 示例数据 ====================

INSERT INTO inventory_items (name, category, quantity, unit, min_threshold) VALUES
('猪五花肉', '肉类', 25, '斤', 10),
('牛腩', '肉类', 15.5, '斤', 8),
('鸡胸肉', '肉类', 30, '斤', 12),
('鸡蛋', '蛋奶', 60, '个', 30),
('纯牛奶', '蛋奶', 20, '瓶', 10),
('大白菜', '蔬菜', 40, '斤', 15),
('土豆', '蔬菜', 50, '斤', 20),
('青椒', '蔬菜', 8, '斤', 10),
('西红柿', '蔬菜', 5, '斤', 12),
('大蒜', '调料', 3, '斤', 5),
('生姜', '调料', 4, '斤', 5),
('生抽', '调料', 12, '瓶', 6),
('老抽', '调料', 8, '瓶', 4),
('料酒', '调料', 10, '瓶', 5),
('食用油', '调料', 15, '桶', 5),
('大米', '主食', 80, '斤', 30),
('面粉', '主食', 25, '斤', 15),
('可乐', '饮品', 40, '瓶', 20),
('矿泉水', '饮品', 50, '瓶', 24),
('豆腐', '豆制品', 6, '斤', 8),
('金针菇', '蔬菜', 2, '斤', 5),
('排骨', '肉类', 12, '斤', 8);

-- 班次示例数据
INSERT INTO shifts (name, time_range, sort_order) VALUES
('早班', '06:00 - 14:00', 1),
('中班', '14:00 - 22:00', 2),
('晚班', '22:00 - 06:00', 3);

WITH early AS (SELECT id FROM shifts WHERE name = '早班' LIMIT 1),
     mid AS (SELECT id FROM shifts WHERE name = '中班' LIMIT 1),
     late AS (SELECT id FROM shifts WHERE name = '晚班' LIMIT 1)
INSERT INTO shift_duties (shift_id, role, duties, sort_order)
SELECT id, '主厨', '1. 到岗后先检查昨日剩余食材状态，确认新鲜度
2. 根据今日预订情况，预估各菜品用量并提前解冻肉类
3. 负责早市所有热菜出品，确保出餐速度和质量
4. 每日10:00前完成供应商到货验收
5. 下班前做好交接记录，标注午市需关注的食材库存', 1
FROM early
UNION ALL
SELECT id, '帮厨', '1. 提前到岗清洗、切配蔬菜和配料
2. 协助主厨完成备料工作，保证高峰期不掉链子
3. 负责厨房台面、砧板、刀具的清洁消毒
4. 定时检查冰箱温度并记录
5. 协助主厨进行到货验收和入库登记', 2
FROM early
UNION ALL
SELECT id, '服务员', '1. 到岗后检查餐厅卫生，擦拭所有桌面和椅子
2. 补充调料台上的酱油、醋、辣椒油等消耗品
3. 摆放餐具、餐巾纸，确保每桌配置齐全
4. 负责收银和外卖打包
5. 营业结束后清理地面、倒垃圾、关灯关空调', 3
FROM early
UNION ALL
SELECT id, '主厨', '1. 与早班主厨交接，了解食材库存和预订情况
2. 负责晚市所有热菜出品，把控菜品质量和摆盘
3. 根据客流情况灵活调整备菜节奏
4. 每日20:00盘点库存，填写次日采购清单
5. 收档前检查所有灶具是否关闭，厨房卫生是否达标', 1
FROM mid
UNION ALL
SELECT id, '帮厨', '1. 与早班帮厨交接，确认食材备料状态
2. 负责晚市配菜、配料补充
3. 协助主厨出菜，高峰期负责主食制作
4. 晚市结束后清理厨房，所有器皿归位
5. 协助主厨盘点库存并记录消耗数据', 2
FROM mid
UNION ALL
SELECT id, '服务员', '1. 与早班服务员交接，了解预订信息和特殊需求
2. 负责引导客人入座、点单下单
3. 上菜时核对菜品与订单是否一致
4. 主动巡台，及时响应客人需求
5. 晚市结束后负责结账对账，清点现金和线上收款', 3
FROM mid
UNION ALL
SELECT id, '值班厨师', '1. 负责深夜外卖订单的制作和打包
2. 处理突发用餐需求
3. 定时巡查厨房设备运行状态
4. 凌晨4:00开始准备早餐备料
5. 交班前确保厨房整洁，填写值班日志', 1
FROM late
UNION ALL
SELECT id, '值班服务员', '1. 负责深夜到店客人的接待和服务
2. 处理外卖平台的接单和打包
3. 定时巡查用餐区安全和卫生
4. 凌晨整理当日营业数据，生成日报
5. 交班前清理用餐区，补充次日所需消耗品', 2
FROM late;

-- 启用 RLS（行级安全），允许匿名访问
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_duties ENABLE ROW LEVEL SECURITY;

-- 允许所有操作（因为是内部工具，不设严格权限）
CREATE POLICY "allow_all" ON inventory_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON stock_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON shift_duties FOR ALL USING (true) WITH CHECK (true);
