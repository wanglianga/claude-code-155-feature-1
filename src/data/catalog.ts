import type { ClassIntensity, RiskLevel } from '../types'

// ============================================================
// 风险体式库 / 替代器械 / 团课模板
// 教练在测评页标记「禁止动作 ↔ 替代动作」时可直接点选，也可手工录入。
// 团课报名风险匹配依据：体式 name + keywords 与团课体式清单双向命中。
// ============================================================

export interface MoveTemplate {
  name: string              // 标准体式名（与团课清单一致，是风险匹配的主键）
  bodyPart: string
  level: RiskLevel
  keywords: string[]        // 别名/包含词，用于自由文本与团课匹配
  defaultAlternative: string
  reason: string
  suggestEquipment: string[]
  suggestAssist: string
}

export const EQUIPMENT_OPTIONS = [
  '瑜伽砖（2 块）', '伸展带', '抱枕', '瑜伽椅', '瑜伽轮',
  '泡沫轴', '墙壁（辅助支撑）', '平衡垫', '毛毯（垫膝/垫腰）',
]

export const ASSIST_OPTIONS = [
  '教练旁侧保护，控制幅度',
  '口令引导，降低动作速度',
  '关节中立位对线（膝对第二脚趾）',
  '减少停留时间，增加组间休息',
  '全程呼吸提示，避免憋气发力',
  '先激活目标肌群再进入体式',
  '手扶墙/椅辅助，不独立完成',
]

export const MOVE_LIBRARY: MoveTemplate[] = [
  // ---- 腰椎 ----
  {
    name: '深度后弯（轮式）', bodyPart: '腰椎', level: '高风险',
    keywords: ['轮式', '后弯', '桥式推胸', '上轮'],
    defaultAlternative: '桥式（只抬臀不推胸）/ 低位眼镜蛇式',
    reason: '腰椎伸展负荷大，骨盆前倾者易挤压腰椎',
    suggestEquipment: ['瑜伽砖（2 块）', '墙壁（辅助支撑）'],
    suggestAssist: '教练旁侧保护，控制幅度',
  },
  {
    name: '犁式 / 肩倒立', bodyPart: '腰椎', level: '高风险',
    keywords: ['犁式', '肩倒立', '倒立', '颈椎倒置'],
    defaultAlternative: '倒箭式（靠墙抬腿，腰背贴地）',
    reason: '颈椎与胸椎屈曲负重，腰部易代偿',
    suggestEquipment: ['墙壁（辅助支撑）', '抱枕'],
    suggestAssist: '手扶墙/椅辅助，不独立完成',
  },
  {
    name: '坐立前屈（直腿深屈）', bodyPart: '腰椎', level: '中风险',
    keywords: ['前屈', '坐立前屈', '直腿前屈'],
    defaultAlternative: '屈膝前屈 / 单腿背部伸展（膝下垫毛毯）',
    reason: '腘绳肌紧张时腰椎被动屈曲，椎间盘压力高',
    suggestEquipment: ['伸展带', '毛毯（垫膝/垫腰）'],
    suggestAssist: '口令引导，降低动作速度',
  },
  {
    name: '仰卧脊柱深度扭转', bodyPart: '腰椎', level: '中风险',
    keywords: ['扭转', '深度扭转', '仰卧扭转'],
    defaultAlternative: '屈膝温和扭转（膝下垫抱枕，肩胛贴地）',
    reason: '强行扭转剪切力集中在腰椎',
    suggestEquipment: ['抱枕'],
    suggestAssist: '教练旁侧保护，控制幅度',
  },
  // ---- 膝关节 ----
  {
    name: '莲花式', bodyPart: '右膝', level: '高风险',
    keywords: ['莲花', '全莲花', '盘坐'],
    defaultAlternative: '简易坐（坐骨下垫高）/ 仰卧束角式',
    reason: '膝关节外旋+屈曲极限位置，半月板与韧带负荷大',
    suggestEquipment: ['抱枕', '瑜伽砖（2 块）'],
    suggestAssist: '减少停留时间，增加组间休息',
  },
  {
    name: '深度深蹲（屈膝>90°）', bodyPart: '右膝', level: '高风险',
    keywords: ['深蹲', '屈膝', '花环式', '静蹲', '英雄卧'],
    defaultAlternative: '靠墙浅蹲（屈膝<60°，膝不超脚尖）',
    reason: '髌股关节压力随屈膝角度显著上升',
    suggestEquipment: ['墙壁（辅助支撑）', '瑜伽椅'],
    suggestAssist: '关节中立位对线（膝对第二脚趾）',
  },
  {
    name: '跳跃串联（跳穿/波比）', bodyPart: '右膝', level: '高风险',
    keywords: ['跳跃', '跳穿', '波比', '冲击', '串联跳'],
    defaultAlternative: '迈步替代跳跃，低冲击过渡',
    reason: '落地冲击为体重数倍，加重膝外侧疼痛',
    suggestEquipment: ['平衡垫'],
    suggestAssist: '先激活目标肌群再进入体式',
  },
  {
    name: '战士一式（大幅度屈膝）', bodyPart: '右膝', level: '中风险',
    keywords: ['战士一', '战士一式', '弓步', '深弓步'],
    defaultAlternative: '高位弓步（小幅度，扶椅保持稳定）',
    reason: '前膝屈曲过深且易内扣',
    suggestEquipment: ['瑜伽椅'],
    suggestAssist: '关节中立位对线（膝对第二脚趾）',
  },
  // ---- 肩颈 ----
  {
    name: '头倒立 / 肘倒立', bodyPart: '肩颈', level: '高风险',
    keywords: ['头倒立', '肘倒立', '倒立', '支撑倒立'],
    defaultAlternative: '倒箭式（靠墙抬腿）/ 站立前屈抱肘',
    reason: '颈椎直接承重，肩颈力量不足时风险高',
    suggestEquipment: ['墙壁（辅助支撑）'],
    suggestAssist: '教练旁侧保护，控制幅度',
  },
  {
    name: '平板支撑（长时间静态）', bodyPart: '肩颈', level: '中风险',
    keywords: ['平板', '平板支撑', '斜板'],
    defaultAlternative: '跪姿平板（缩短单次时长）',
    reason: '核心疲劳后肩颈代偿耸肩',
    suggestEquipment: [],
    suggestAssist: '全程呼吸提示，避免憋气发力',
  },
  // ---- 手腕 ----
  {
    name: '手腕承重体式（下犬/四点支撑）', bodyPart: '手腕', level: '中风险',
    keywords: ['下犬', '四点支撑', '手腕', '手撑地'],
    defaultAlternative: '拳撑 / 前臂支撑（肘板过渡）',
    reason: '腕关节背屈承重，旧伤易复发',
    suggestEquipment: ['瑜伽砖（2 块）'],
    suggestAssist: '减少停留时间，增加组间休息',
  },
]

export function findMoveTemplate(name: string): MoveTemplate | undefined {
  const n = name.trim()
  // 1. 标准名精确一致
  const exact = MOVE_LIBRARY.find(m => m.name === n)
  if (exact) return exact
  // 2. 自由文本包含完整标准名（或反之）
  const full = MOVE_LIBRARY.find(m => n.includes(m.name) || m.name.includes(n))
  if (full) return full
  // 3. 短词/别名回退（如「波比跳 4×10」→ 跳跃串联）
  return MOVE_LIBRARY.find(m => m.keywords.some(k => k.length >= 2 && n.includes(k)))
}

/** 安全变体修饰词：含这些词的是替代动作，即使名字里带「平板/蹲/扭转」也不按禁忌匹配 */
const SAFE_VARIANT_RE = /跪姿|浅蹲|温和|低冲击|低强度|扶椅|扶墙|扶瑜伽|靠墙|替代|简易坐|小幅度|屈膝前屈|屈膝温和|抱枕/

/** 判断「禁止体式」与某个体式是否为同一动作 */
export function movesMatch(a: string, b: string): boolean {
  const x = a.trim()
  const y = b.trim()
  if (x.length < 2 || y.length < 2) return false
  // 1. 名称直接包含（团课体式均为标准名，覆盖绝大多数情况）
  if (x.includes(y) || y.includes(x)) return true
  // 2. 安全变体（跪姿平板、靠墙浅蹲…）不向禁忌模板归一
  if (SAFE_VARIANT_RE.test(x) || SAFE_VARIANT_RE.test(y)) return false
  // 3. 双方都归一到体式库中同一条模板（支持「波比跳 4×10」这类自由文本）
  const tx = findMoveTemplate(x)
  const ty = findMoveTemplate(y)
  if (tx && ty && tx.name === ty.name) return true
  // 4. 共有长度 ≥3 的精确别名
  const kx = new Set(tx?.keywords ?? [])
  const ky = new Set(ty?.keywords ?? [])
  for (const k of kx) {
    if (k.length >= 3 && ky.has(k)) return true
  }
  return false
}

/** 从一段体式清单中找出命中某会员禁忌的配对（团课报名 / 课后记录预警共用） */
type RestrictionShape = {
  bodyPart: string
  level: RiskLevel
  pairs: { forbidden: string; alternative: string; reason: string }[]
}

export function matchRestrictionMoves<T extends RestrictionShape>(restrictions: T[], moves: string[]) {
  const hits: { restriction: T; pair: T['pairs'][number]; move: string }[] = []
  for (const r of restrictions) {
    for (const pair of r.pairs) {
      const move = moves.find(m => movesMatch(pair.forbidden, m))
      if (move) hits.push({ restriction: r, pair, move })
    }
  }
  return hits
}

// ---------------- 团课模板 ----------------
export interface GroupClassTemplate {
  name: string
  intensity: ClassIntensity
  moves: string[]
  equipment: string[]
  note: string
}

export const GROUP_CLASS_TEMPLATES: GroupClassTemplate[] = [
  {
    name: '晚间力量流（团课）', intensity: '高强度',
    moves: ['跳跃串联（跳穿/波比）', '战士一式（大幅度屈膝）', '深度后弯（轮式）', '平板支撑（长时间静态）'],
    equipment: ['瑜伽垫'],
    note: '节奏快、跳跃多，适合有规律训练基础者',
  },
  {
    name: '阿斯汤加进阶（团课）', intensity: '高强度',
    moves: ['莲花式', '犁式 / 肩倒立', '头倒立 / 肘倒立', '跳跃串联（跳穿/波比）', '深度后弯（轮式）'],
    equipment: ['瑜伽垫'],
    note: '高难体式密集，需教练评估后参加',
  },
  {
    name: '流动脊柱 · 后弯主题（团课）', intensity: '中强度',
    moves: ['深度后弯（轮式）', '坐立前屈（直腿深屈）', '仰卧脊柱深度扭转'],
    equipment: ['抱枕', '瑜伽砖（2 块）'],
    note: '脊柱主题，腰部不适者需谨慎',
  },
  {
    name: '舒缓阴瑜伽 · 脊柱保养（团课）', intensity: '低强度',
    moves: ['倒箭式（靠墙抬腿）', '屈膝温和扭转', '婴儿式', '猫牛式'],
    equipment: ['抱枕', '瑜伽砖（2 块）', '墙壁（辅助支撑）'],
    note: '长时间停留但幅度温和，适合腰椎不适与初学者',
  },
  {
    name: '基础拉伸与肩颈放松（团课）', intensity: '低强度',
    moves: ['猫牛式', '婴儿式', '倒箭式（靠墙抬腿）', '跪姿平板'],
    equipment: ['抱枕', '毛毯（垫膝/垫腰）'],
    note: '零基础友好，课后放松减压',
  },
]
