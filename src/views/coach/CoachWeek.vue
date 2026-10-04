<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import { addDays, fmt, today, WEEKDAY_CN } from '../../utils/date'
import type { Session } from '../../types'
import RiskRestrictionCard from '../../components/RiskRestrictionCard.vue'

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

function restrictionsOf(memberId: string) {
  return data.activeRestrictions(memberId)
}

/** 该会员待上课需提前准备的替代器械（去重） */
function prepOf(memberId: string): string[] {
  return [...new Set(restrictionsOf(memberId).flatMap(r => r.alternativeEquipment))]
}

// 我的会员（有进行中课包或体验课待测评）
const myMembers = computed(() => {
  const ids = new Set<string>()
  mySessions.value.forEach(s => ids.add(s.memberId))
  return [...ids].map(id => {
    const pkg = data.activePackage(id)
    const recs = data.recordsOf(id)
    const last = recs[0]
    const next = data.upcomingSessions(id).find(s => s.coachId === coachId)
    const booking = data.bookingOf(id)
    return { id, name: data.nameOf(id), pkg, last, next, goals: booking?.goals ?? [], prog: pkg ? data.progressOf(pkg) : null, risk: data.activeRestrictions(id) }
  })
})

// 全队共享：所有生效中的风险动作限制（含非本教练会员）——换教练/代课时据此避开高风险体式
const allActiveRisks = computed(() => {
  const ids = new Set(data.restrictions.filter(r => r.status === '生效中').map(r => r.memberId))
  return [...ids].map(id => ({
    memberId: id,
    name: data.nameOf(id),
    restrictions: data.activeRestrictions(id),
    mine: !!mySessions.value.find(s => s.memberId === id),
  }))
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
        <div v-for="s in sessionsOn(d)" :key="s.id" class="session-chip" :class="[statusClass[s.status], { exp: s.isExperience, risky: s.status === '待上课' && restrictionsOf(s.memberId).length }]" @click="openSession(s)">
          <div class="who">{{ s.time.slice(0, 5) }} {{ data.nameOf(s.memberId) }}</div>
          <div>{{ s.kind }} · {{ s.status }}</div>
          <div style="color: var(--muted)">{{ s.focus }}</div>
          <div v-if="s.status === '待上课' && restrictionsOf(s.memberId).length" class="risk-line">
            ⚠️ {{ restrictionsOf(s.memberId).map(r => r.bodyPart).join('、') }}受限 · 避开高风险体式
          </div>
          <div v-if="s.status === '待上课' && prepOf(s.memberId).length" class="prep-line">
            🧰 备：{{ prepOf(s.memberId).join('、') }}
          </div>
          <div v-if="s.status === '待上课'" class="mt8">
            <button class="small ghost" @click.stop="coachLeave(s)">请假</button>
          </div>
        </div>
        <div v-if="!sessionsOn(d).length" class="muted" style="font-size: 12px">—</div>
      </div>
    </div>

    <!-- 全队风险动作限制：其他教练/代课都要据此避开高风险体式 -->
    <div v-if="allActiveRisks.length" class="card mt16 risk-team">
      <div class="between">
        <h3 style="margin: 0">⚠️ 会员运动风险动作限制（全队共享 · 排课/代课自动生效）</h3>
        <span class="tag danger">{{ allActiveRisks.length }} 名会员受限</span>
      </div>
      <p class="muted">以下限制由各教练在测评页或课程调整中标记；无论由谁代课，排课时都应避开高风险体式、提前备好替代器械。</p>
      <div class="risk-list">
        <div v-for="m in allActiveRisks" :key="m.memberId" class="risk-member">
          <div class="between">
            <b>{{ m.name }}</b>
            <span v-if="m.mine" class="tag">我的会员</span>
            <span v-else class="tag gray">其他教练会员</span>
          </div>
          <RiskRestrictionCard :member-id="m.memberId" variant="compact" title="" />
          <router-link :to="`/coach/member/${m.memberId}`"><button class="small ghost">查看完整替代方案</button></router-link>
        </div>
      </div>
    </div>

    <div class="card mt16">
      <h3>我的会员（目标 / 上节课反馈 / 本节课重点）</h3>
      <table class="plain">
        <thead>
          <tr><th>会员</th><th>课包进度</th><th>风险限制</th><th>训练目标</th><th>上节课反馈</th><th>本节课重点</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="m in myMembers" :key="m.id">
            <td><b>{{ m.name }}</b></td>
            <td>
              <template v-if="m.pkg && m.prog">
                {{ m.pkg.usedSessions }}/{{ m.pkg.totalSessions }} 节
                <span v-if="m.prog.behind" class="tag clay">落后</span>
                <span v-if="m.prog.expiringSoon" class="tag danger">将到期</span>
              </template>
              <span v-else class="tag clay">体验课</span>
            </td>
            <td>
              <span v-if="m.risk.length">
                <span v-for="r in m.risk" :key="r.id" class="tag danger">⚠️ {{ r.bodyPart }}</span>
              </span>
              <span v-else class="muted">—</span>
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
.session-chip.risky { background: var(--danger-soft); border: 1px solid #ecc9be; }
.risk-line { color: var(--danger); font-weight: 600; font-size: 12px; margin-top: 3px; }
.prep-line { color: var(--amber); font-size: 12px; margin-top: 2px; }
.risk-team { border-color: #ecc9be; }
.risk-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
@media (max-width: 860px) { .risk-list { grid-template-columns: 1fr; } }
.risk-member { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; background: #fff; }
</style>
