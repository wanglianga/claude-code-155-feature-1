// ============================================================
// 领域模型：城市瑜伽馆私教全流程
// 会员 / 顾问 / 教练 三角色围绕「同一套训练记录」协作
// ============================================================

export type Role = 'member' | 'consultant' | 'coach'

export interface Account {
  id: string
  role: Role
  name: string
  password: string
  phone: string
}

// ---------------- 体验课预约（会员填写） ----------------
export type FitnessBase = '零基础' | '偶尔运动' | '规律运动' | '长期训练'
export type Flexibility = '很僵硬' | '偏僵硬' | '一般' | '较好'

export interface PainInfo {
  part: string          // 部位，如 膝盖/腰椎/肩颈
  level: number         // 0-10 疼痛等级
  note: string
}

export interface ExperienceBooking {
  id: string
  memberId: string
  createdAt: string
  fitnessBase: FitnessBase
  pains: PainInfo[]
  flexibility: Flexibility
  goals: string[]               // 减脂塑形/体态矫正/柔韧提升/康复舒缓/减压助眠
  goalNote: string
  availableSlots: string[]      // 可上课时间，如 ['周一 19:00-20:00']
  budget: string                // 预算区间
  mindOppositeGenderCoach: boolean  // 是否介意异性教练
  status: '待安排' | '已安排' | '已完成测评' | '已购课' | '已取消'
  note: string
}

// ---------------- 体验课测评（教练填写，专业档案，顾问只读） ----------------
export interface Assessment {
  id: string
  bookingId: string
  memberId: string
  coachId: string
  createdAt: string
  posture: string          // 体态评估
  movementLimits: string   // 动作限制
  courseAdvice: string     // 课程建议
  riskNotice: string       // 风险提示（医疗边界声明）
  recommendedPackage: string  // 推荐套餐
  coachSignedAt: string    // 教练签名确认时间（签名后内容锁定，顾问不可改）
}

// ---------------- 风险动作限制（教练在测评/复评时标记） ----------------
// 一条限制 = 一个禁止的高风险体式 + 配套的替代体式；
// 限制生效后：排课自动提醒其他教练避开、团课报名时前台收到预警、
// 排课同时提醒教练准备替代器械与辅助动作。
export interface RiskMovePair {
  forbidden: string      // 禁止体式/动作，如 深度深蹲（屈膝>90°）
  alternative: string    // 替代动作，如 靠墙浅蹲（屈膝<60°）
  reason: string         // 为什么禁，如 右膝髌股关节负荷大
}

export type RiskLevel = '高风险' | '中风险'

export interface RiskRestriction {
  id: string
  memberId: string
  coachId: string          // 标记教练（专业责任人）
  source: '体验测评' | '复评'
  assessmentId?: string
  createdAt: string
  bodyPart: string         // 受限部位：腰椎/右膝/肩颈...
  level: RiskLevel
  pairs: RiskMovePair[]    // 禁止动作 ↔ 替代动作
  equipment: string[]      // 替代器械：瑜伽砖/伸展带/抱枕/瑜伽椅/墙壁...
  assists: string[]        // 辅助动作/手法建议
  generalNotice: string    // 总体风险提示（医疗边界）
  status: '生效中' | '已解除'
  releasedAt?: string
  releasedBy?: string
  releaseNote?: string
}

// 会员坚持挑战高难度体式时，教练再次告知风险后的处理记录
export type RiskDecision = '调整为替代方案' | '拒绝该动作' | '坚持完成（已告知风险）'

export interface RiskConfirmation {
  id: string
  memberId: string
  coachId: string
  sessionId?: string
  groupClassId?: string
  move: string             // 会员想挑战的体式
  createdAt: string
  decision: RiskDecision
  adjustedMove?: string    // 调整后的方案（decision=调整为替代方案 时）
  note: string             // 沟通与处理说明
  informed: boolean        // 是否已明确告知风险并确认会员知晓
}

// ---------------- 团课 ----------------
export type ClassIntensity = '低强度' | '中强度' | '高强度'

export interface GroupClass {
  id: string
  name: string             // 如「晚间力量流（团课）」
  coachId: string
  date: string             // YYYY-MM-DD
  time: string
  intensity: ClassIntensity
  capacity: number
  moves: string[]          // 本节团课涉及的高难度/常见体式（用于风险匹配）
  equipment: string[]      // 需要会员使用的器械
  note: string
}

export interface GroupBooking {
  id: string
  classId: string
  memberId: string
  consultantId: string     // 前台/顾问
  createdAt: string
  acknowledged: boolean    // 风险已告知，会员已知晓
  advisory: string         // 前台建议（如建议改选低强度课程）
  cancelReason?: string
  status: '已报名' | '已取消'
}

// ---------------- 课包与排课 ----------------
export interface CoursePackage {
  id: string
  memberId: string
  coachId: string
  name: string             // 如「私教 24 节 · 体态矫正」
  totalSessions: number
  usedSessions: number
  startDate: string
  expiryDate: string
  status: '进行中' | '已用完' | '已过期' | '已续费衔接'
  leaveRule: LeaveRule
  createdAt: string
}

export interface LeaveRule {
  maxLeavePerMonth: number     // 每月最多请假次数
  advanceHours: number         // 需提前多少小时请假
  note: string
}

// 排课计划：每周固定时段
export interface SchedulePlan {
  id: string
  packageId: string
  memberId: string
  coachId: string
  weekday: number          // 0-6
  time: string             // '19:00-20:00'
  active: boolean
}

export type SessionStatus = '待上课' | '已完成' | '会员请假' | '教练请假' | '已改期' | '已取消'

export interface Session {
  id: string
  packageId: string
  memberId: string
  coachId: string
  date: string             // YYYY-MM-DD
  time: string
  kind: '体验课' | '私教课'
  status: SessionStatus
  focus: string            // 本节课重点（教练基于上节反馈制定）
  isExperience: boolean
  bookingId?: string
}

// ---------------- 课后训练记录（教练填写） ----------------
export interface PainChange {
  part: string
  before: number   // 课前 0-10
  after: number    // 课后 0-10
}

export interface SessionRecord {
  id: string
  sessionId: string
  memberId: string
  coachId: string
  createdAt: string
  completedMoves: string[]   // 完成动作
  memberFeel: number         // 会员体感 1-10（RPE）
  feelNote: string
  painChanges: PainChange[]  // 疼痛变化
  homePractice: string       // 家庭练习布置
  coachNote: string          // 教练备注（下节课依据）
}

// ---------------- 请假 ----------------
export interface LeaveRequest {
  id: string
  sessionId: string
  byRole: 'member' | 'coach'
  byId: string
  reason: string
  createdAt: string
  status: '待处理' | '已批准' | '已拒绝'
  withinRule: boolean        // 是否符合请假规则（提前时长/当月次数）
}

// ---------------- 异常工单（六类场景统一处理） ----------------
export type TicketType =
  | '会员不适'       // 如膝盖不适
  | '教练请假'
  | '临时改期'
  | '进度落后'
  | '更换教练'
  | '课包到期'

export interface Ticket {
  id: string
  type: TicketType
  memberId: string
  coachId?: string
  sessionId?: string
  title: string
  detail: string
  createdAt: string
  status: '待处理' | '处理中' | '已解决'
  resolution: string         // 处理结论（写回训练记录）
}

// ---------------- 续费 ----------------
export interface RenewalFollowUp {
  id: string
  memberId: string
  consultantId: string
  createdAt: string
  summary: string            // 顾问基于训练进度撰写的沟通纪要
  result: '跟进中' | '已续费' | '暂缓'
}

// ---------------- 投诉 ----------------
export interface Complaint {
  id: string
  memberId: string
  content: string
  createdAt: string
  status: '待处理' | '已回复' | '已关闭'
  reply: string
}

// ---------------- 统一训练时间线（三方共享的同一套记录） ----------------
export type TimelineKind =
  | '预约体验' | '安排体验' | '体验测评' | '购课' | '排课'
  | '上课记录' | '请假' | '改期' | '不适上报' | '课程调整'
  | '更换教练' | '续费' | '投诉' | '工单处理'
  | '风险限制' | '风险确认' | '限制解除' | '团课报名' | '团课退订'

export interface TimelineEvent {
  id: string
  memberId: string
  at: string
  kind: TimelineKind
  actorRole: Role
  actorName: string
  title: string
  detail: string
  professional?: boolean     // true = 教练专业记录，顾问端只读展示
}

// ---------------- 教练档案 ----------------
export interface CoachProfile {
  id: string
  name: string
  gender: '女' | '男'
  specialties: string[]      // 理疗瑜伽/体态矫正/力量流/阴瑜伽...
  bio: string
}
