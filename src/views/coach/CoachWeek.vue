<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import { addDays, fmt, today, WEEKDAY_CN } from '../../utils/date'
import type { Session } from '../../types'

const auth = useAuthStore()
const data = useDataStore()
const router = useRouter()
const coachId = auth.current!.id

const weekOffset = ref(0)

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const wd = (d.getDay() + 6) % 7 // 周一=0
  d.setDate(d.getDate() - wd)
  return fmt(d)
}

const weekDays = computed(() => {
  const mon = addDays(mondayOf(today()), weekOffset.value * 7)
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
})

const mySessions = computed(() => data.coachSessions(coachId))

function sessionsOn(date: string): Session[] {
  return mySessions.value.filter(s => s.date === date)
}

/** 我带的团课（含每位报名会员的风险命中） */
const myGroupClasses = computed(() =>
  data.upcomingGroupClasses
    .filter(c => c.coachId === coachId)
    .map(c => ({
      gc: c,
      booked: data.classBookings(c.id).map(b => {
        const member = data.accountById(b.memberId)
        const summary = data.riskSummaryOf(b.memberId)
        const hits = data.matchMemberMoves(b.memberId, c.moves)
        return { bookingId: b.id, memberId: b.memberId, name: member?.name ?? b.memberId, summary, hits, acknowledged: b.acknowledged }
      }),
    })),
)

// 我的会员（有进行中课包或体验课待测评）
const myMembers = computed(() => {
  const ids = new Set<string>()
  mySessions.value.forEach(s => ids.add(s.memberId))
  myGroupClasses.value.forEach(g => g.booked.forEach(b => ids.add(b.memberId)))
  return [...ids].map(id => {
    const pkg = data.activePackage(id)
    const recs = data.recordsOf(id)
    const last = recs[0]
    const next = data.upcomingSessions(id).find(s => s.coachId === coachId)
    const booking = data.bookingOf(id)
    const risk = data.riskSummaryOf(id)
    return { id, name: data.nameOf(id), pkg, last, next, goals: booking?.goals ?? [], prog: pkg ? data.progressOf(pkg) : null, risk }
  })
})

function openSession(s: Session) {
  if (s.isExperience && s.status === '待上课') {
    router.push(`/coach/session/${s.id}`)
  } else if (s.status === '待上课') {
    router.push(`/coach/session/${s.id}`)
  } else {
    router.push(`/coach/member/${s.memberId}`)
  }
}

function coachLeave(s: Session) {
  const reason = prompt(`请填写请假原因（${s.date} ${s.time} ${data.nameOf(s.memberId)} 的课程将待顾问协调）`)
  if (reason) data.requestLeave(s.id, 'coach', coachId, reason)
}

const statusClass: Record<string, string> = { 待上课: '', 已完成: 'off', 会员请假: 'off', 教练请假: 'off', 已取消: 'off', 已改期: 'off' }
</script>

<template>
  <div class="page">
    <div class="between">
      <div>
        <h2 class="page-title">本周课表 · {{ auth.current?.name }}</h2>
        <p class="page-sub">{{ weekDays[0] }} ~ {{ weekDays[6] }}</p>
      </div>
      <div class="row">
        <button class="ghost small" @click="weekOffset--">← 上一周</button>
        <button class="ghost small" @click="weekOffset = 0">本周</button>
        <button class="ghost small" @click="weekOffset++">下一周 →</button>
      </div>
    </div>

    <div class="week-grid">
      <div v-for="d in weekDays" :key="d" class="day-col" :class="{ today: d === today() }">
        <div class="day-head">
          <span>{{ WEEKDAY_CN[new Date(d + 'T00:00:00').getDay()] }}</span>
          <span>{{ d.slice(5) }}</span>
        </div>
        <div v-for="s in sessionsOn(d)" :key="s.id" class="session-chip" :class="[statusClass[s.status], { exp: s.isExperience, risky: data.riskSummaryOf(s.memberId).hasRisk }]" @click="openSession(s)">
          <div class="who">
            {{ s.time.slice(0, 5) }} {{ data.nameOf(s.memberId) }}
            <span v-if="data.riskSummaryOf(s.memberId).hasRisk" class="risk-dot" :title="`风险限制：${data.riskSummaryOf(s.memberId).bodyParts.join('、')}`">⚠️</span>
          </div>
          <div>{{ s.kind }} · {{ s.status }}</div>
          <div style="color: var(--muted)">{{ s.focus }}</div>
          <div v-if="data.riskSummaryOf(s.memberId).hasRisk && s.status === '待上课'" class="risk-mini">
            避开：{{ data.riskSummaryOf(s.memberId).bodyParts.join('、') }}禁忌体式 · 备{{ data.riskSummaryOf(s.memberId).equipment.slice(0, 2).join('/') || '辅助' }}
          </div>
          <div v-if="s.status === '待上课'" class="mt8">
            <button class="small ghost" @click.stop="coachLeave(s)">请假</button>
          </div>
        </div>
        <div v-if="!sessionsOn(d).length" class="muted" style="font-size: 12px">—</div>
      </div>
    </div>

    <!-- 我带的团课：报名会员的风险提示与替代器械准备 -->
    <div v-if="myGroupClasses.length" class="card mt16">
      <h3>我带的团课 · 风险会员与器械准备</h3>
      <p class="muted">开课前请核对风险会员：避开其禁忌体式、引导替代动作，并提前准备对应器械。</p>
      <div v-for="g in myGroupClasses" :key="g.gc.id" class="gc-block">
        <div class="between">
          <div>
            <b>{{ g.gc.name }}</b>
            <span class="tag" :class="g.gc.intensity === '高强度' ? 'danger' : g.gc.intensity === '中强度' ? 'amber' : ''">{{ g.gc.intensity }}</span>
            <span class="muted">{{ g.gc.date }} {{ g.gc.time }} · {{ g.booked.length }}/{{ g.gc.capacity }} 人</span>
          </div>
          <router-link :to="`/coach/group/${g.gc.id}`"><button class="small">课前核对 / 现场登记</button></router-link>
        </div>
        <div class="muted" style="font-size: 13px">本课体式：{{ g.gc.moves.join('、') }}</div>
        <div v-if="g.booked.length" class="mt8">
          <span v-for="b in g.booked" :key="b.bookingId" class="attendee">
            {{ b.name }}
            <span v-if="b.hits.length" class="tag danger">⚠️ {{ b.hits.map(h => h.pair.forbidden).join('、') }}</span>
            <span v-else-if="b.summary.hasRisk" class="tag amber">{{ b.summary.bodyParts.join('、') }}限制（本课未命中）</span>
          </span>
        </div>
      </div>
    </div>

    <div class="card mt16">
      <h3>我的会员（目标 / 上节课反馈 / 本节课重点）</h3>
      <table class="plain">
        <thead>
          <tr><th>会员</th><th>风险动作限制</th><th>课包进度</th><th>训练目标</th><th>上节课反馈</th><th>本节课重点</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="m in myMembers" :key="m.id" :class="{ 'row-risk': m.risk.hasRisk }">
            <td><b>{{ m.name }}</b></td>
            <td style="max-width: 200px">
              <template v-if="m.risk.hasRisk">
                <router-link :to="`/coach/member/${m.id}`" class="risk-link">
                  ⚠️ {{ m.risk.bodyParts.join('、') }} · {{ m.risk.level }}
                </router-link>
                <div class="muted" style="font-size: 12px">{{ m.risk.count }} 张限制卡 · 排课需备替代器械</div>
              </template>
              <span v-else class="muted">无</span>
            </td>
            <td>
              <template v-if="m.pkg && m.prog">
                {{ m.pkg.usedSessions }}/{{ m.pkg.totalSessions }} 节
                <span v-if="m.prog.behind" class="tag clay">落后</span>
                <span v-if="m.prog.expiringSoon" class="tag danger">将到期</span>
              </template>
              <span v-else class="tag clay">体验课</span>
            </td>
            <td>{{ m.goals.join('、') || '—' }}</td>
            <td style="max-width: 240px">
              <template v-if="m.last">
                体感 {{ m.last.memberFeel }}/10
                <span v-if="m.last.painChanges.length">；{{ m.last.painChanges.map(p => `${p.part}${p.before}→${p.after}`).join('，') }}</span>
                <div class="muted">{{ m.last.coachNote }}</div>
              </template>
              <span v-else class="muted">—</span>
            </td>
            <td style="max-width: 200px">{{ m.next?.focus ?? '—' }}</td>
            <td><router-link :to="`/coach/member/${m.id}`"><button class="small ghost">档案</button></router-link></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.session-chip.risky { border-color: var(--danger); }
.risk-dot { font-size: 12px; }
.risk-mini { font-size: 11px; color: var(--danger); margin-top: 4px; line-height: 1.4; }
.gc-block { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; }
.attendee { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; margin: 0 12px 6px 0; }
.risk-link { color: var(--danger); font-weight: 600; }
tr.row-risk { background: #fffaf7; }
</style>
