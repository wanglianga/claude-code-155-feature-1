import { defineStore } from 'pinia'
import type {
  Account, Assessment, CoachProfile, Complaint, CoursePackage, ExperienceBooking,
  GroupClass, LeaveRequest, MovementRestriction, PainChange, RenewalFollowUp,
  RestrictionDraft, RiskAcknowledge, SchedulePlan, Session, SessionRecord,
  Ticket, TicketType, TimelineEvent, TimelineKind,
} from '../types'
import { buildSeed, SEED_VERSION, type SeedState } from '../data/seed'
import { addDays, daysBetween, nextWeekday, nowStr, today, uid, weekdayCn } from '../utils/date'

const KEY = `yoga_db_v${SEED_VERSION}`

export interface WeekdaySlot { weekday: number; time: string }

/** 团课报名风险评估结果 */
export interface ClassRisk {
  level: 'safe' | 'caution' | 'high'
  restrictions: MovementRestriction[]
  hits: { move: string; reason: string }[]   // 课程体式与禁止动作直接命中
}

/** 把一个动作字段拆成可比对的动作词（兼容「、，/」与括号备注） */
function moveTokens(raw: string): string[] {
  return raw.split(/[、,，/／\n]/).map(s => s.replace(/[（(].*?[)）]/g, '').trim()).filter(Boolean)
}

function tokenIncludes(a: string, b: string): boolean {
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a))
}

/** 判断课程体式是否命中禁止动作，返回命中明细 */
export function matchForbidden(featuredMoves: string[], restrictions: MovementRestriction[]): { move: string; reason: string }[] {
  const hits: { move: string; reason: string }[] = []
  restrictions.forEach(r => {
    const forbidden = r.forbiddenMoves.flatMap(moveTokens)
    featuredMoves.flatMap(moveTokens).forEach(cMove => {
      if (forbidden.some(f => tokenIncludes(f, cMove))) {
        hits.push({ move: cMove, reason: `${r.bodyPart}受限：${r.reason}` })
      }
    })
  })
  return hits
}

export const useDataStore = defineStore('data', {
  state: (): SeedState => buildSeed(),

  getters: {
    accountById: (s) => (id: string): Account | undefined => s.accounts.find(a => a.id === id),
    coachById: (s) => (id: string): CoachProfile | undefined => s.coaches.find(c => c.id === id),
    nameOf(): (id: string) => string {
      return (id) => this.accountById(id)?.name ?? this.coachById(id)?.name ?? id
    },

    memberIds: (s) => s.accounts.filter(a => a.role === 'member').map(a => a.id),

    activePackage: (s) => (memberId: string): CoursePackage | undefined =>
      s.packages.find(p => p.memberId === memberId && p.status === '进行中'),

    packagesOf: (s) => (memberId: string) =>
      s.packages.filter(p => p.memberId === memberId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    sessionsOf: (s) => (memberId: string) =>
      s.sessions.filter(x => x.memberId === memberId).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),

    coachSessions: (s) => (coachId: string) =>
      s.sessions.filter(x => x.coachId === coachId).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),

    upcomingSessions: (s) => (memberId: string) =>
      s.sessions.filter(x => x.memberId === memberId && x.status === '待上课' && x.date >= today())
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),

    recordOf: (s) => (sessionId: string) => s.records.find(r => r.sessionId === sessionId),

    recordsOf: (s) => (memberId: string) =>
      s.records.filter(r => r.memberId === memberId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    timelineOf: (s) => (memberId: string) =>
      s.timeline.filter(e => e.memberId === memberId).sort((a, b) => b.at.localeCompare(a.at)),

    latestAssessment: (s) => (memberId: string): Assessment | undefined =>
      s.assessments.filter(a => a.memberId === memberId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],

    bookingOf: (s) => (memberId: string) =>
      s.bookings.filter(b => b.memberId === memberId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],

    // ---- 顾问看板 ----
    funnel: (s) => {
      const c = { 待安排: 0, 已安排: 0, 已完成测评: 0, 已购课: 0, 已取消: 0 }
      s.bookings.forEach(b => { c[b.status] += 1 })
      return c
    },
    openTickets: (s) => s.tickets.filter(t => t.status !== '已解决'),
    pendingLeaves: (s) => s.leaves.filter(l => l.status === '待处理'),
    openComplaints: (s) => s.complaints.filter(c => c.status !== '已关闭'),

    /** 课包消耗进度：expected = 按时间线性应消耗 */
    progressOf: () => (p: CoursePackage) => {
      const totalDays = Math.max(1, daysBetween(p.startDate, p.expiryDate))
      const elapsed = Math.min(totalDays, Math.max(0, daysBetween(p.startDate, today())))
      const expected = (p.totalSessions * elapsed) / totalDays
      const remaining = p.totalSessions - p.usedSessions
      const daysLeft = daysBetween(today(), p.expiryDate)
      const behind = p.status === '进行中' && elapsed / totalDays > 0.15 && p.usedSessions < expected * 0.7
      const expiringSoon = p.status === '进行中' && (daysLeft <= 21 || remaining <= 4)
      return { totalDays, elapsed, expected: Math.round(expected * 10) / 10, remaining, daysLeft, behind, expiringSoon }
    },

    renewalAlerts(): { pkg: CoursePackage; remaining: number; daysLeft: number }[] {
      return this.packages
        .filter(p => p.status === '进行中')
        .map(p => ({ pkg: p, ...this.progressOf(p) }))
        .filter(x => x.expiringSoon)
        .map(x => ({ pkg: x.pkg, remaining: x.remaining, daysLeft: x.daysLeft }))
    },

    /** 会员疼痛趋势（续费沟通用真实数据） */
    painTrend: (s) => (memberId: string) => {
      const out: { date: string; part: string; before: number; after: number }[] = []
      s.records
        .filter(r => r.memberId === memberId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .forEach(r => r.painChanges.forEach(pc => out.push({ date: r.createdAt, part: pc.part, before: pc.before, after: pc.after })))
      return out
    },

    attendanceOf: (s) => (memberId: string) => {
      const ss = s.sessions.filter(x => x.memberId === memberId && !x.isExperience)
      return {
        done: ss.filter(x => x.status === '已完成').length,
        leave: ss.filter(x => x.status === '会员请假').length,
        upcoming: ss.filter(x => x.status === '待上课').length,
      }
    },

    // ---- 风险动作限制 ----
    /** 会员当前生效中的风险动作限制（按更新时间倒序） */
    activeRestrictions: (s) => (memberId: string): MovementRestriction[] =>
      s.restrictions
        .filter(r => r.memberId === memberId && r.status === '生效中')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),

    restrictionById: (s) => (id: string) => s.restrictions.find(r => r.id === id),

    /** 会员是否存在任何生效中的风险限制（用于全局角标/提示） */
    hasRiskRestriction(): (memberId: string) => boolean {
      return (memberId) => this.activeRestrictions(memberId).length > 0
    },

    /** 会员的风险一句话摘要（部位 + 禁止动作数量），供列表/角标使用 */
    riskSummary(): (memberId: string) => string {
      return (memberId) => {
        const rs = this.activeRestrictions(memberId)
        if (!rs.length) return ''
        return rs.map(r => `${r.bodyPart}受限（禁 ${r.forbiddenMoves.length} 项）`).join('；')
      }
    },

    /** 会员风险确认记录（会员坚持挑战高难度体式的处置结论） */
    riskAcksOf: (s) => (memberId: string) =>
      s.riskAcks.filter(r => r.memberId === memberId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    // ---- 团课 ----
    upcomingGroupClasses: (s) => s.groupClasses
      .filter(c => c.date >= today())
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),

    classById: (s) => (id: string) => s.groupClasses.find(c => c.id === id),

    memberGroupClasses: (s) => (memberId: string) =>
      s.groupClasses.filter(c => c.enrolledMemberIds.includes(memberId)),

    /**
     * 前台报名前的风险评估：
     * - high：课程体式直接命中禁止动作，或高强度课遇到风险限制
     * - caution：会员有风险限制但课程未直接命中（中强度）
     * - safe：无限制或限制与课程无冲突
     */
    classRiskFor(): (memberId: string, gc: GroupClass) => ClassRisk {
      return (memberId, gc) => {
        const restrictions = this.activeRestrictions(memberId)
        const hits = matchForbidden(gc.featuredMoves, restrictions)
        let level: ClassRisk['level'] = 'safe'
        if (hits.length > 0 || (gc.intensity === '高强度' && restrictions.length > 0)) {
          level = 'high'
        } else if (restrictions.length > 0) {
          level = 'caution'
        }
        return { level, restrictions, hits }
      }
    },

    /** 给会员推荐的低强度替代团课（排除已报名与有冲突的课程） */
    lowIntensityAlternatives(): (memberId: string, excludeClassId: string) => GroupClass[] {
      return (memberId, excludeClassId) =>
        this.upcomingGroupClasses
          .filter(c => c.id !== excludeClassId && c.intensity === '低强度')
          .filter(c => !c.enrolledMemberIds.includes(memberId))
          .filter(c => this.classRiskFor(memberId, c).level !== 'high')
    },
  },

  actions: {
    init() {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as SeedState
          Object.assign(this, parsed)
          return
        } catch { /* fallthrough */ }
      }
      this.resetDemo()
    },
    persist() {
      localStorage.setItem(KEY, JSON.stringify(this.$state))
    },
    resetDemo() {
      Object.assign(this, buildSeed())
      this.persist()
    },

    log(memberId: string, kind: TimelineKind, actorRole: 'member' | 'consultant' | 'coach', actorName: string, title: string, detail: string, professional = false) {
      this.timeline.push({ id: uid('tl'), memberId, at: nowStr(), kind, actorRole, actorName, title, detail, professional })
    },

    openTicket(type: TicketType, memberId: string, title: string, detail: string, coachId?: string, sessionId?: string) {
      this.tickets.unshift({ id: uid('tk'), type, memberId, coachId, sessionId, title, detail, createdAt: nowStr(), status: '待处理', resolution: '' })
    },

    // ---------- 会员：预约体验课 ----------
    bookExperience(memberId: string, payload: Omit<ExperienceBooking, 'id' | 'memberId' | 'createdAt' | 'status'>) {
      const b: ExperienceBooking = { ...payload, id: uid('bk'), memberId, createdAt: nowStr(), status: '待安排' }
      this.bookings.unshift(b)
      const m = this.accountById(memberId)
      this.log(memberId, '预约体验', 'member', m?.name ?? '', '预约体验课',
        `运动基础：${payload.fitnessBase}；疼痛：${payload.pains.map(p => `${p.part}${p.level}分`).join('、') || '无'}；柔韧性：${payload.flexibility}；目标：${payload.goals.join('、')}；预算：${payload.budget}；${payload.mindOppositeGenderCoach ? '介意异性教练' : '不介意教练性别'}。`)
      this.persist()
    },

    // ---------- 顾问：安排体验课 ----------
    arrangeExperience(bookingId: string, coachId: string, date: string, time: string, consultantName: string) {
      const b = this.bookings.find(x => x.id === bookingId)
      if (!b || b.status !== '待安排') return
      b.status = '已安排'
      this.sessions.push({
        id: uid('ss'), packageId: '', memberId: b.memberId, coachId, date, time,
        kind: '体验课', status: '待上课', focus: '体态评估与基础筛查', isExperience: true, bookingId: b.id,
      })
      const coach = this.coachById(coachId)
      this.log(b.memberId, '安排体验', 'consultant', consultantName, '安排体验课',
        `匹配${coach?.name}教练（${coach?.specialties.join('/')}），时间 ${date}（${weekdayCn(date)}）${time}。`)
      this.persist()
    },

    // ---------- 教练：填写体验测评（签名后锁定，顾问只读） ----------
    submitAssessment(bookingId: string, coachId: string, payload: { posture: string; movementLimits: string; courseAdvice: string; riskNotice: string; recommendedPackage: string }, restrictions: RestrictionDraft[] = []) {
      const b = this.bookings.find(x => x.id === bookingId)
      if (!b) return
      b.status = '已完成测评'
      const coach = this.coachById(coachId)
      const assessmentId = uid('as')
      this.assessments.push({
        id: assessmentId, bookingId, memberId: b.memberId, coachId, createdAt: nowStr(),
        ...payload, coachSignedAt: nowStr(),
      })
      this.log(b.memberId, '体验测评', 'coach', coach?.name ?? '', '完成体验课测评',
        `${payload.posture.slice(0, 60)}…；建议：${payload.recommendedPackage}；风险提示已签署。`, true)
      // 同步落地结构化的风险动作限制（后续排课 / 团课报名据此自动提醒）
      restrictions
        .filter(d => d.bodyPart.trim() && d.forbiddenMoves.length)
        .forEach(d => this.markRestriction(b.memberId, coachId, d, '体验测评', coach?.name ?? '', { assessmentId }))
      this.persist()
    },

    // ---------- 教练：标记 / 更新风险动作限制（测评页与会员档案共用） ----------
    markRestriction(memberId: string, coachId: string, draft: RestrictionDraft, source: MovementRestriction['source'], coachName: string, ref: { assessmentId?: string; sessionId?: string } = {}) {
      const now = nowStr()
      const r: MovementRestriction = {
        id: uid('rs'), memberId, coachId,
        bodyPart: draft.bodyPart.trim(),
        forbiddenMoves: draft.forbiddenMoves,
        alternativeMoves: draft.alternativeMoves,
        alternativeEquipment: draft.alternativeEquipment,
        assistActions: draft.assistActions,
        reason: draft.reason.trim(),
        source, assessmentId: ref.assessmentId, sessionId: ref.sessionId,
        status: '生效中', createdAt: now, updatedAt: now,
      }
      this.restrictions.push(r)
      this.log(memberId, '风险限制', 'coach', coachName,
        `标记${r.bodyPart}风险动作限制`,
        `禁止：${r.forbiddenMoves.join('、')}；替代：${r.alternativeMoves.join('、') || '待补充'}`
        + `；替代器械：${r.alternativeEquipment.join('、') || '无'}；辅助：${r.assistActions.join('、') || '无'}`
        + `。原因：${r.reason || '—'}。后续排课与团课报名将自动提醒避开。`, true)
      this.persist()
      return r
    },

    /** 解除一条风险限制（会员恢复后由教练操作，保留历史记录） */
    releaseRestriction(restrictionId: string, coachName: string, note: string) {
      const r = this.restrictions.find(x => x.id === restrictionId)
      if (!r || r.status !== '生效中') return
      r.status = '已解除'
      r.updatedAt = nowStr()
      this.log(r.memberId, '风险限制', 'coach', coachName, `解除${r.bodyPart}动作限制`,
        `原限制（禁止 ${r.forbiddenMoves.join('、')}）已解除。说明：${note || '会员已恢复，复测无不适。'}`, true)
      this.persist()
    },

    // ---------- 教练：会员坚持高难度体式时的风险二次确认 ----------
    recordRiskAck(input: { memberId: string; coachId: string; sessionId?: string; requestedMove: string; bodyPart: string; decision: RiskAcknowledge['decision']; plan: string; memberInformed: boolean; coachWitness: string }, coachName: string) {
      const ack: RiskAcknowledge = { id: uid('ra'), createdAt: nowStr(), ...input }
      this.riskAcks.push(ack)
      const decisionText = { 已拒绝: '已拒绝该体式', 已降阶调整: '已降阶调整', 知情同意后挑战: '知情同意后谨慎挑战' }[ack.decision]
      this.log(ack.memberId, '风险确认', 'coach', coachName, '高难度体式风险二次确认',
        `会员坚持挑战「${ack.requestedMove}」（涉及${ack.bodyPart}）；已再次告知风险：${ack.memberInformed ? '是' : '否'}；结论：${decisionText}；方案：${ack.plan}；确认教练：${ack.coachWitness}。`, true)
      this.persist()
      return ack
    },

    // ---------- 前台：团课报名（读取风险动作限制，提醒低强度替代） ----------
    enrollGroupClass(classId: string, memberId: string, actorName: string) {
      const gc = this.groupClasses.find(c => c.id === classId)
      if (!gc) return { ok: false, reason: '团课不存在' }
      if (gc.enrolledMemberIds.includes(memberId)) return { ok: false, reason: '已报名该课程' }
      if (gc.enrolledMemberIds.length >= gc.capacity) return { ok: false, reason: '该团课名额已满' }
      const risk = this.classRiskFor(memberId, gc)
      if (risk.level === 'high') {
        return { ok: false, reason: '风险拦截', risk }
      }
      gc.enrolledMemberIds.push(memberId)
      const detail = risk.level === 'caution'
        ? `报名「${gc.name}」（${gc.intensity}）；存在${risk.restrictions.map(r => r.bodyPart).join('、')}动作限制，已提示课中避开相关体式并使用替代动作。`
        : `报名「${gc.name}」（${gc.intensity}）；已核对风险动作限制，无冲突。`
      this.log(memberId, '团课报名', 'consultant', actorName, '前台报名团课', detail)
      this.persist()
      return { ok: true, risk }
    },

    /** 高风险团课：前台再次告知并经会员知情后登记（保留风险确认留痕） */
    enrollGroupClassOverride(classId: string, memberId: string, actorName: string, informedNote: string) {
      const gc = this.groupClasses.find(c => c.id === classId)
      if (!gc || gc.enrolledMemberIds.includes(memberId) || gc.enrolledMemberIds.length >= gc.capacity) return
      const risk = this.classRiskFor(memberId, gc)
      gc.enrolledMemberIds.push(memberId)
      this.log(memberId, '团课报名', 'consultant', actorName, '高风险团课知情报名',
        `课程「${gc.name}」与动作限制冲突（${risk.hits.map(h => h.move).join('、') || risk.restrictions.map(r => r.bodyPart + '受限').join('、')}）；前台已再次提示风险并建议低强度课，会员仍坚持参加，已签署知情登记：${informedNote}。`)
      this.persist()
    },

    cancelGroupClassEnrollment(classId: string, memberId: string, actorName: string) {
      const gc = this.groupClasses.find(c => c.id === classId)
      if (!gc) return
      const i = gc.enrolledMemberIds.indexOf(memberId)
      if (i < 0) return
      gc.enrolledMemberIds.splice(i, 1)
      this.log(memberId, '团课报名', 'consultant', actorName, '取消团课报名', `取消「${gc.name}」。`)
      this.persist()
    },

    // ---------- 会员：确认购课 → 生成课包 + 排课计划 + 请假规则 + 续费提醒基线 ----------
    purchasePackage(memberId: string, coachId: string, name: string, totalSessions: number, validDays: number, slots: WeekdaySlot[], memberName: string) {
      const pkg: CoursePackage = {
        id: uid('pk'), memberId, coachId, name, totalSessions, usedSessions: 0,
        startDate: today(), expiryDate: addDays(today(), validDays), status: '进行中',
        leaveRule: { maxLeavePerMonth: 2, advanceHours: 12, note: '每月最多请假 2 次，需提前 12 小时；超出视同消课。' },
        createdAt: nowStr(),
      }
      this.packages.push(pkg)
      slots.forEach((s, i) => {
        this.plans.push({ id: uid('pl'), packageId: pkg.id, memberId, coachId, weekday: s.weekday, time: s.time, active: true })
        // 生成未来 3 周课程
        for (let w = 0; w < 3; w++) {
          const date = addDays(nextWeekday(today(), s.weekday), w * 7)
          this.sessions.push({
            id: uid('ss'), packageId: pkg.id, memberId, coachId, date, time: s.time,
            kind: '私教课', status: '待上课', focus: i === 0 && w === 0 ? '开课评估与目标对齐' : '待上节课反馈后确定', isExperience: false,
          })
        }
      })
      const b = this.bookingOf(memberId)
      if (b && b.status === '已完成测评') b.status = '已购课'
      this.log(memberId, '购课', 'member', memberName, '确认购买课包',
        `${name}，共 ${totalSessions} 节，有效期至 ${pkg.expiryDate}；请假规则：每月最多 2 次、提前 12 小时。`)
      this.log(memberId, '排课', 'consultant', '系统', '生成排课计划',
        slots.map(s => `每周${'日一二三四五六'[s.weekday]} ${s.time}`).join('、') + '；课包剩余 4 节或到期前 21 天将自动提醒续费。')
      this.persist()
    },

    // ---------- 教练：课后记录 ----------
    completeSession(sessionId: string, payload: { completedMoves: string[]; memberFeel: number; feelNote: string; painChanges: PainChange[]; homePractice: string; coachNote: string; nextFocus?: string }, coachName: string) {
      const ss = this.sessions.find(x => x.id === sessionId)
      if (!ss || ss.status !== '待上课') return
      ss.status = '已完成'
      this.records.push({
        id: uid('rc'), sessionId, memberId: ss.memberId, coachId: ss.coachId, createdAt: nowStr(),
        completedMoves: payload.completedMoves, memberFeel: payload.memberFeel, feelNote: payload.feelNote,
        painChanges: payload.painChanges, homePractice: payload.homePractice, coachNote: payload.coachNote,
      })
      if (!ss.isExperience) {
        const pkg = this.packages.find(p => p.id === ss.packageId)
        if (pkg) pkg.usedSessions += 1
      }
      if (payload.nextFocus) {
        const next = this.sessions
          .filter(x => x.memberId === ss.memberId && x.status === '待上课' && (x.date + x.time) > (ss.date + ss.time))
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0]
        if (next) next.focus = payload.nextFocus
      }
      const pain = payload.painChanges.map(p => `${p.part} ${p.before}→${p.after} 分`).join('，')
      this.log(ss.memberId, '上课记录', 'coach', coachName, `${ss.kind}完成`,
        `完成动作：${payload.completedMoves.join('、')}；体感 ${payload.memberFeel}/10${pain ? `；疼痛变化：${pain}` : ''}；家庭练习：${payload.homePractice}`, true)
      this.persist()
    },

    // ---------- 请假 ----------
    requestLeave(sessionId: string, byRole: 'member' | 'coach', byId: string, reason: string) {
      const ss = this.sessions.find(x => x.id === sessionId)
      if (!ss || ss.status !== '待上课') return
      let withinRule = true
      if (byRole === 'member') {
        const pkg = this.packages.find(p => p.id === ss.packageId)
        if (pkg) {
          const month = ss.date.slice(0, 7)
          const used = this.leaves.filter(l => l.byRole === 'member' && l.status === '已批准'
            && this.sessions.find(x => x.id === l.sessionId)?.date.slice(0, 7) === month
            && this.sessions.find(x => x.id === l.sessionId)?.memberId === ss.memberId).length
          const hoursAhead = (new Date(ss.date + 'T' + ss.time.slice(0, 5)).getTime() - Date.now()) / 3600000
          withinRule = used < pkg.leaveRule.maxLeavePerMonth && hoursAhead >= pkg.leaveRule.advanceHours
        }
      }
      this.leaves.unshift({ id: uid('lv'), sessionId, byRole, byId, reason, createdAt: nowStr(), status: '待处理', withinRule })
      const name = this.nameOf(byId)
      if (byRole === 'coach') {
        this.openTicket('教练请假', ss.memberId, `${name}教练请假`, `教练请假：${reason}。${ss.date} ${ss.time} 课程需要改期或换教练代课。`, ss.coachId, sessionId)
        this.log(ss.memberId, '请假', 'coach', name, '教练请假', `${ss.date} ${ss.time} 课程待协调：${reason}`)
      } else {
        this.log(ss.memberId, '请假', 'member', name, '会员请假申请', `${ss.date} ${ss.time}：${reason}${withinRule ? '' : '（超出请假规则，请顾问确认）'}`)
      }
      this.persist()
    },

    decideLeave(leaveId: string, approve: boolean, actorName: string) {
      const lv = this.leaves.find(l => l.id === leaveId)
      if (!lv || lv.status !== '待处理') return
      lv.status = approve ? '已批准' : '已拒绝'
      const ss = this.sessions.find(x => x.id === lv.sessionId)
      if (ss && approve) ss.status = lv.byRole === 'member' ? '会员请假' : '教练请假'
      if (ss) {
        this.log(ss.memberId, '请假', 'consultant', actorName, `请假${approve ? '已批准' : '已拒绝'}`,
          `${ss.date} ${ss.time}，${lv.byRole === 'member' ? '会员' : '教练'}请假：${lv.reason}${lv.withinRule ? '' : '（超出请假规则）'}`)
      }
      this.persist()
    },

    // ---------- 改期 ----------
    rescheduleSession(sessionId: string, newDate: string, newTime: string, actorRole: 'member' | 'consultant' | 'coach', actorName: string) {
      const ss = this.sessions.find(x => x.id === sessionId)
      // 允许对「待上课」以及「教练请假」的课程改期（教练请假后补课）
      if (!ss || (ss.status !== '待上课' && ss.status !== '教练请假')) return
      const old = `${ss.date}（${weekdayCn(ss.date)}）${ss.time}`
      const wasCoachLeave = ss.status === '教练请假'
      ss.date = newDate
      ss.time = newTime
      ss.status = '待上课'
      this.log(ss.memberId, '改期', actorRole, actorName, wasCoachLeave ? '教练请假课程补课改期' : '课程改期',
        `${old} → ${newDate}（${weekdayCn(newDate)}）${newTime}`)
      this.persist()
    },

    // ---------- 会员：不适上报 ----------
    reportDiscomfort(memberId: string, detail: string, memberName: string) {
      const pkg = this.activePackage(memberId)
      this.openTicket('会员不适', memberId, '会员身体不适上报', detail, pkg?.coachId)
      this.log(memberId, '不适上报', 'member', memberName, '上报身体不适', detail)
      this.persist()
    },

    // ---------- 教练：课程调整（专业记录） ----------
    adjustPlan(memberId: string, coachId: string, note: string, nextFocus: string | undefined, coachName: string) {
      this.log(memberId, '课程调整', 'coach', coachName, '调整训练计划', note, true)
      if (nextFocus) {
        const next = this.upcomingSessions(memberId)[0]
        if (next) next.focus = nextFocus
      }
      // 关联的不适工单推进为处理中
      const tk = this.tickets.find(t => t.memberId === memberId && t.type === '会员不适' && t.status !== '已解决')
      if (tk) tk.status = '处理中'
      this.persist()
    },

    // ---------- 会员：申请换教练 ----------
    requestCoachChange(memberId: string, reason: string, memberName: string) {
      const pkg = this.activePackage(memberId)
      this.openTicket('更换教练', memberId, '会员申请更换教练', reason, pkg?.coachId)
      this.log(memberId, '更换教练', 'member', memberName, '申请更换教练', reason)
      this.persist()
    },

    // ---------- 顾问：换教练（训练记录完整交接，不从零开始） ----------
    assignNewCoach(ticketId: string, newCoachId: string, consultantName: string) {
      const tk = this.tickets.find(t => t.id === ticketId)
      if (!tk || tk.type !== '更换教练') return
      const pkg = this.activePackage(tk.memberId)
      const oldCoach = pkg ? this.coachById(pkg.coachId)?.name : ''
      const nc = this.coachById(newCoachId)
      if (pkg) pkg.coachId = newCoachId
      this.plans.filter(p => p.memberId === tk.memberId && p.active).forEach(p => { p.coachId = newCoachId })
      this.sessions.filter(s => s.memberId === tk.memberId && s.status === '待上课').forEach(s => { s.coachId = newCoachId })
      tk.status = '已解决'
      tk.resolution = `已由${oldCoach}更换为${nc?.name}；历史测评、${this.recordsOf(tk.memberId).length} 条课后记录与疼痛趋势完整交接，新教练从既有计划继续。`
      this.log(tk.memberId, '更换教练', 'consultant', consultantName, '完成换教练',
        tk.resolution)
      this.persist()
    },

    // ---------- 顾问：工单处理 ----------
    resolveTicket(ticketId: string, resolution: string, consultantName: string) {
      const tk = this.tickets.find(t => t.id === ticketId)
      if (!tk) return
      tk.status = '已解决'
      tk.resolution = resolution
      this.log(tk.memberId, '工单处理', 'consultant', consultantName, `处理「${tk.title}」`, resolution)
      this.persist()
    },

    // ---------- 顾问：续费跟进（基于真实训练进度） ----------
    followUpRenewal(memberId: string, consultantId: string, summary: string, result: '跟进中' | '已续费' | '暂缓', consultantName: string, renew?: { name: string; totalSessions: number; validDays: number; slots: WeekdaySlot[] }) {
      this.renewals.unshift({ id: uid('rn'), memberId, consultantId, createdAt: nowStr(), summary, result })
      this.log(memberId, '续费', 'consultant', consultantName, '续费跟进', summary)
      if (result === '已续费' && renew) {
        const old = this.activePackage(memberId)
        if (old) old.status = '已续费衔接'
        this.purchasePackage(memberId, old?.coachId ?? '', renew.name, renew.totalSessions, renew.validDays, renew.slots, consultantName)
        // purchasePackage 内部已 persist
      }
      const tk = this.tickets.find(t => t.memberId === memberId && t.type === '课包到期' && t.status !== '已解决')
      if (tk && result !== '跟进中') { tk.status = '已解决'; tk.resolution = `续费跟进结果：${result}` }
      this.persist()
    },

    // ---------- 投诉 ----------
    addComplaint(memberId: string, content: string, memberName: string) {
      this.complaints.unshift({ id: uid('cp'), memberId, content, createdAt: nowStr(), status: '待处理', reply: '' })
      this.log(memberId, '投诉', 'member', memberName, '提交投诉', content)
      this.persist()
    },
    replyComplaint(id: string, reply: string, consultantName: string) {
      const c = this.complaints.find(x => x.id === id)
      if (!c) return
      c.status = '已回复'
      c.reply = reply
      this.log(c.memberId, '工单处理', 'consultant', consultantName, '回复投诉', reply)
      this.persist()
    },

    setSessionFocus(sessionId: string, focus: string) {
      const ss = this.sessions.find(x => x.id === sessionId)
      if (ss) { ss.focus = focus; this.persist() }
    },
  },
})
