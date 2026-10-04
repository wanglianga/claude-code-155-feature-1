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

// ---------------- 风险动作限制（教练在测评页 / 课程调整中标记，全队共享） ----------------
// 会员在体验课或训练中出现某部位不适（如腰椎、膝盖），教练标记禁止动作与替代动作；
// 限制在会员维度生效：后续任何教练排课、前台报团课都会读取同一份限制。

export interface MovementRestriction {
  id: string
  memberId: string
  coachId: string            // 标记教练（创建者；其他教练同样可见并据此避开）
  bodyPart: string           // 不适/受限部位，如 腰椎 / 右膝
  forbiddenMoves: string[]   // 禁止动作（高风险体式）
  alternativeMoves: string[] // 替代动作（低风险/降阶体式）
  alternativeEquipment: string[] // 替代器械（排课时提醒教练提前准备）
  assistActions: string[]    // 辅助动作（保护与手法辅助）
  reason: string             // 标记原因，如「体验课中前屈时腰椎酸胀 5/10」
  source: '体验测评' | '课程调整'
  assessmentId?: string
  sessionId?: string
  status: '生效中' | '已解除'
  createdAt: string
  updatedAt: string
}

// 教练提交测评 / 课程调整时携带的限制草稿（字段由表单文本拆分而来）
export interface RestrictionDraft {
  bodyPart: string
  forbiddenMoves: string[]
  alternativeMoves: string[]
  alternativeEquipment: string[]
  assistActions: string[]
  reason: string
}

// 会员坚持挑战高难度（被限制）体式时，教练再次告知风险并记录的处置结论
export interface RiskAcknowledge {
  id: string
  memberId: string
  coachId: string
  sessionId?: string
  requestedMove: string       // 会员坚持要做的高难度体式
  bodyPart: string            // 涉及的受限部位
  decision: '已拒绝' | '已降阶调整' | '知情同意后挑战'
  plan: string                // 拒绝理由 / 降阶与保护方案 / 知情同意下的保护措施
  memberInformed: boolean     // 是否已再次向会员告知风险
  coachWitness: string        // 在场确认教练签名（姓名）
  createdAt: string
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

// ---------------- 团课（前台为会员报名，报名时读取风险动作限制） ----------------
export type ClassIntensity = '低强度' | '中强度' | '高强度'

export interface GroupClass {
  id: string
  name: string             // 如「脊柱养护 · 阴瑜伽」
  coachId: string
  date: string             // YYYY-MM-DD
  time: string
  intensity: ClassIntensity
  capacity: number
  enrolledMemberIds: string[]
  featuredMoves: string[]  // 本节课主要体式（用于与禁止动作比对）
  note: string
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
  | '风险限制' | '风险确认' | '团课报名'

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
