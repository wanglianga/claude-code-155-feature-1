<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import TrainingTimeline from '../../components/TrainingTimeline.vue'
import ProfessionalProfile from '../../components/ProfessionalProfile.vue'
import RiskRestrictionCard from '../../components/RiskRestrictionCard.vue'
import { weekdayCn } from '../../utils/date'

const auth = useAuthStore()
const data = useDataStore()
const mid = auth.current!.id

const records = computed(() => data.recordsOf(mid))
const trend = computed(() => data.painTrend(mid))
const attendance = computed(() => data.attendanceOf(mid))
const risk = computed(() => data.riskSummaryOf(mid))
const confirmations = computed(() => data.riskConfirmationsOf(mid))
const groupBookings = computed(() =>
  data.memberGroupBookings(mid)
    .map(b => ({ b, gc: data.classById(b.classId) }))
    .filter(x => x.gc),
)

function sessionOf(id: string) {
  return data.sessions.find(s => s.id === id)
}
</script>

<template>
  <div class="page">
    <h2 class="page-title">我的训练记录</h2>
    <p class="page-sub">从第一次预约开始的完整档案 —— 换教练或续费时，这些记录会完整交接，不需要从零讲起。</p>

    <div class="grid cols-3">
      <div class="card stat"><div class="num">{{ attendance.done }}</div><div class="lbl">已完成课程</div></div>
      <div class="card stat"><div class="num">{{ attendance.leave }}</div><div class="lbl">请假次数</div></div>
      <div class="card stat"><div class="num">{{ records.length }}</div><div class="lbl">课后记录</div></div>
    </div>

    <div v-if="trend.length" class="card">
      <h3>疼痛变化趋势</h3>
      <div v-for="(t, i) in trend" :key="i" class="pain-bar mb8">
        <span class="muted" style="width: 150px">{{ t.date.slice(0, 10) }}</span>
        <span style="width: 60px">{{ t.part }}</span>
        <span class="pain-dots">
          <i v-for="n in 10" :key="n" :class="{ on: n <= t.before }"></i>
        </span>
        <span>{{ t.before }} → {{ t.after }} 分</span>
        <span v-if="t.after > t.before" class="tag danger">加重</span>
        <span v-else-if="t.after < t.before" class="tag">缓解</span>
      </div>
    </div>

    <div class="card" v-if="risk.hasRisk">
      <h3>⚠️ 我的风险动作限制（教练标记，排课与团课自动生效）</h3>
      <RiskRestrictionCard :member-id="mid" show-released />
    </div>

    <div v-if="confirmations.length" class="card">
      <h3>高难体式风险确认记录</h3>
      <div v-for="c in confirmations" :key="c.id" class="mb8" style="border-bottom: 1px solid var(--line); padding-bottom: 8px; font-size: 13px">
        <div class="between">
          <b>{{ c.createdAt }} · {{ c.move }}</b>
          <span class="tag" :class="c.decision === '拒绝该动作' ? 'danger' : c.decision === '坚持完成（已告知风险）' ? 'amber' : ''">{{ c.decision }}</span>
        </div>
        <div v-if="c.adjustedMove" class="mt8">调整方案：{{ c.adjustedMove }}</div>
        <div class="muted">{{ c.note }}</div>
      </div>
    </div>

    <div v-if="groupBookings.length" class="card">
      <h3>我的团课报名</h3>
      <div v-for="{ b, gc } in groupBookings" :key="b.id" class="mb8" style="font-size: 13px; border-bottom: 1px dashed var(--line); padding-bottom: 6px">
        <b>{{ gc!.name }}</b>
        <span class="tag" :class="gc!.intensity === '高强度' ? 'danger' : gc!.intensity === '中强度' ? 'amber' : ''">{{ gc!.intensity }}</span>
        <span class="muted">{{ gc!.date }}（{{ weekdayCn(gc!.date) }}）{{ gc!.time }} · {{ data.coachById(gc!.coachId)?.name }}</span>
        <div v-if="data.matchMemberMoves(mid, gc!.moves).length" class="tag clay mt8">
          本课教练会为你避开：{{ data.matchMemberMoves(mid, gc!.moves).map(h => h.pair.forbidden).join('、') }}
        </div>
      </div>
    </div>

    <div class="card">
      <h3>教练专业档案</h3>
      <ProfessionalProfile :member-id="mid" viewer-role="member" />
    </div>

    <div class="card">
      <h3>课后记录（教练填写）</h3>
      <div v-for="r in records" :key="r.id" class="mb8" style="border-bottom: 1px solid var(--line); padding-bottom: 12px">
        <div class="between">
          <b>{{ sessionOf(r.sessionId)?.date }} {{ sessionOf(r.sessionId)?.time }}</b>
          <span class="muted">教练：{{ data.coachById(r.coachId)?.name }} · 体感 {{ r.memberFeel }}/10</span>
        </div>
        <div class="mt8" style="font-size: 14px">
          <div>完成动作：{{ r.completedMoves.join('、') }}</div>
          <div v-if="r.painChanges.length">疼痛变化：{{ r.painChanges.map(p => `${p.part} ${p.before}→${p.after} 分`).join('，') }}</div>
          <div>家庭练习：{{ r.homePractice }}</div>
          <div class="muted">教练备注：{{ r.coachNote }}</div>
        </div>
      </div>
      <div v-if="!records.length" class="empty">暂无课后记录</div>
    </div>

    <div class="card">
      <h3>完整时间线</h3>
      <TrainingTimeline :member-id="mid" />
    </div>
  </div>
</template>
