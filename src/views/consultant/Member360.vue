<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import TrainingTimeline from '../../components/TrainingTimeline.vue'
import ProfessionalProfile from '../../components/ProfessionalProfile.vue'
import PackageCard from '../../components/PackageCard.vue'
import RiskRestrictionCard from '../../components/RiskRestrictionCard.vue'
import RiskNoticeBanner from '../../components/RiskNoticeBanner.vue'

const route = useRoute()
const auth = useAuthStore()
const data = useDataStore()
const mid = route.params.id as string
const myName = auth.current!.name

const member = computed(() => data.accountById(mid))
const pkg = computed(() => data.activePackage(mid))
const records = computed(() => data.recordsOf(mid))
const trend = computed(() => data.painTrend(mid))
const attendance = computed(() => data.attendanceOf(mid))
const renewals = computed(() => data.renewals.filter(r => r.memberId === mid))
const complaints = computed(() => data.complaints.filter(c => c.memberId === mid && c.status !== '已关闭'))
const risk = computed(() => data.riskSummaryOf(mid))
const riskConfirmations = computed(() => data.riskConfirmationsOf(mid))
const groupBookings = computed(() =>
  data.memberGroupBookings(mid)
    .map(b => ({ b, gc: data.classById(b.classId) }))
    .filter(x => x.gc),
)

const follow = reactive({ summary: '', result: '跟进中' as '跟进中' | '已续费' | '暂缓' })
const renewSpec = reactive({ name: '私教 24 节 · 进阶周期', totalSessions: 24, validDays: 120, weekday: 2, time: '19:00-20:00' })
const complaintReply = reactive<Record<string, string>>({})
const msg = ref('')

/** 基于真实训练数据生成续费沟通要点（而非只看剩余课时） */
function draftSummary() {
  const parts: string[] = []
  if (pkg.value) {
    const prog = data.progressOf(pkg.value)
    parts.push(`课包消耗 ${pkg.value.usedSessions}/${pkg.value.totalSessions} 节，剩余 ${prog.remaining} 节、${prog.daysLeft} 天到期`)
  }
  parts.push(`出勤：完成 ${attendance.value.done} 节、请假 ${attendance.value.leave} 次`)
  if (trend.value.length) {
    const first = trend.value[0]
    const last = trend.value[trend.value.length - 1]
    parts.push(`疼痛变化：${last.part}由首次 ${first.before} 分降至最近 ${last.after} 分`)
  }
  const lastRec = records.value[0]
  if (lastRec) parts.push(`最近一课（${lastRec.createdAt.slice(0, 10)}）：体感 ${lastRec.memberFeel}/10，教练备注「${lastRec.coachNote}」`)
  follow.summary = `基于训练记录沟通：${parts.join('；')}。`
}

function submitFollow() {
  if (!follow.summary.trim()) { alert('请填写沟通纪要'); return }
  data.followUpRenewal(
    mid, auth.current!.id, follow.summary, follow.result, myName,
    follow.result === '已续费'
      ? { name: renewSpec.name, totalSessions: renewSpec.totalSessions, validDays: renewSpec.validDays, slots: [{ weekday: renewSpec.weekday, time: renewSpec.time }] }
      : undefined,
  )
  follow.summary = ''
  msg.value = follow.result === '已续费' ? '已生成新课包并与原课包衔接' : '跟进记录已保存'
  setTimeout(() => (msg.value = ''), 2500)
}

function reply(cId: string) {
  const r = complaintReply[cId]?.trim()
  if (!r) { alert('请填写回复'); return }
  data.replyComplaint(cId, r, myName)
}
</script>

<template>
  <div class="page" v-if="member">
    <h2 class="page-title">{{ member.name }} · 会员 360°</h2>
    <p class="page-sub">顾问视角：续费与跟进全部基于教练留下的真实训练进度；教练的专业档案只读，不可改写为销售话术。</p>

    <div v-if="msg" class="banner warn">{{ msg }}</div>

    <!-- 风险动作限制：顾问只读，排课/团课沟通时必须参照 -->
    <RiskNoticeBanner v-if="risk.hasRisk" :member-id="mid" show-prep
      title="该会员有教练标记的风险动作限制：团课报名须提示风险并建议低强度课程" />

    <div class="grid cols-4">
      <div class="card stat"><div class="num">{{ attendance.done }}</div><div class="lbl">已完成课程</div></div>
      <div class="card stat"><div class="num">{{ attendance.leave }}</div><div class="lbl">请假次数</div></div>
      <div class="card stat"><div class="num">{{ attendance.upcoming }}</div><div class="lbl">待上课程</div></div>
      <div class="card stat"><div class="num">{{ records.length }}</div><div class="lbl">课后记录</div></div>
    </div>

    <div class="card" v-if="pkg">
      <h3>当前课包</h3>
      <PackageCard :pkg="pkg" />
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3>疼痛趋势（真实训练数据）</h3>
        <template v-if="trend.length">
          <div v-for="(t, i) in trend" :key="i" class="pain-bar mb8">
            <span class="muted" style="width: 90px">{{ t.date.slice(0, 10) }}</span>
            <span style="width: 50px">{{ t.part }}</span>
            <span class="pain-dots"><i v-for="n in 10" :key="n" :class="{ on: n <= t.after }"></i></span>
            <span>{{ t.before }}→{{ t.after }}</span>
          </div>
        </template>
        <div v-else class="empty">无疼痛记录</div>
      </div>

      <div class="card">
        <h3>最近课后记录（教练填写）</h3>
        <div v-for="r in records.slice(0, 3)" :key="r.id" class="mb8" style="border-bottom: 1px solid var(--line); padding-bottom: 8px">
          <div class="between">
            <b>{{ r.createdAt.slice(0, 10) }}</b>
            <span class="muted">{{ data.coachById(r.coachId)?.name }} · 体感 {{ r.memberFeel }}/10</span>
          </div>
          <div style="font-size: 13px">完成：{{ r.completedMoves.join('、') }}</div>
          <div class="muted" style="font-size: 13px">备注：{{ r.coachNote }}</div>
        </div>
        <div v-if="!records.length" class="empty">暂无记录</div>
      </div>
    </div>

    <!-- 销售/训练边界：专业档案只读 -->
    <div class="card">
      <h3>教练专业档案</h3>
      <ProfessionalProfile :member-id="mid" viewer-role="consultant" />
    </div>

    <!-- 风险动作限制（教练专业记录，顾问只读） -->
    <div v-if="risk.hasRisk" class="card">
      <h3>⚠️ 运动风险动作限制（教练专业记录 · 顾问只读）</h3>
      <RiskRestrictionCard :member-id="mid" show-released />
    </div>

    <!-- 高难体式二次确认记录 -->
    <div v-if="riskConfirmations.length" class="card">
      <h3>高难体式二次确认记录</h3>
      <div v-for="c in riskConfirmations" :key="c.id" class="mb8" style="border-bottom: 1px solid var(--line); padding-bottom: 8px; font-size: 13px">
        <div class="between">
          <b>{{ c.createdAt }} · {{ c.move }}</b>
          <span class="tag" :class="c.decision === '拒绝该动作' ? 'danger' : c.decision === '坚持完成（已告知风险）' ? 'amber' : ''">{{ c.decision }}</span>
        </div>
        <div v-if="c.adjustedMove" class="mt8">调整方案：{{ c.adjustedMove }}</div>
        <div class="muted">{{ c.note }}</div>
      </div>
    </div>

    <!-- 团课报名与风险告知记录 -->
    <div v-if="groupBookings.length" class="card">
      <h3>团课报名与风险告知</h3>
      <div v-for="{ b, gc } in groupBookings" :key="b.id" class="mb8" style="border-bottom: 1px solid var(--line); padding-bottom: 8px; font-size: 13px">
        <b>{{ gc!.name }}</b>
        <span class="tag" :class="gc!.intensity === '高强度' ? 'danger' : gc!.intensity === '中强度' ? 'amber' : ''">{{ gc!.intensity }}</span>
        <span class="muted">{{ gc!.date }} {{ gc!.time }}</span>
        <div v-if="data.matchMemberMoves(mid, gc!.moves).length" class="tag danger mt8">
          本课命中禁忌：{{ data.matchMemberMoves(mid, gc!.moves).map(h => h.pair.forbidden).join('、') }}
        </div>
        <div class="muted">前台建议：{{ b.advisory }}</div>
      </div>
    </div>

    <!-- 续费跟进 -->
    <div class="card">
      <h3>续费跟进</h3>
      <p class="muted">沟通要点由真实训练数据生成：出勤、疼痛变化、教练备注 —— 不只是「还剩几节课」。</p>
      <div class="form-row">
        <div class="between">
          <label>沟通纪要</label>
          <button class="small ghost" @click="draftSummary">✨ 基于训练记录生成要点</button>
        </div>
        <textarea v-model="follow.summary" rows="3"></textarea>
      </div>
      <div class="row">
        <select v-model="follow.result" style="width: 140px">
          <option>跟进中</option><option>已续费</option><option>暂缓</option>
        </select>
        <template v-if="follow.result === '已续费'">
          <input v-model="renewSpec.name" style="width: 220px" />
          <input v-model.number="renewSpec.totalSessions" type="number" min="1" style="width: 90px" title="课时" />
          <span class="muted">节 /</span>
          <input v-model.number="renewSpec.validDays" type="number" min="7" style="width: 90px" title="有效期" />
          <span class="muted">天</span>
        </template>
        <button @click="submitFollow">保存跟进</button>
      </div>
      <div v-if="renewals.length" class="mt16">
        <div v-for="r in renewals" :key="r.id" class="mb8" style="font-size: 13px; border-bottom: 1px dashed var(--line); padding-bottom: 6px">
          <span class="tag" :class="r.result === '已续费' ? '' : r.result === '暂缓' ? 'gray' : 'amber'">{{ r.result }}</span>
          <span class="muted">{{ r.createdAt }}</span> — {{ r.summary }}
        </div>
      </div>
    </div>

    <!-- 投诉处理 -->
    <div v-if="complaints.length" class="card">
      <h3>投诉处理</h3>
      <div v-for="c in complaints" :key="c.id" class="mb8">
        <div><span class="tag danger">{{ c.status }}</span> {{ c.content }}</div>
        <div v-if="c.reply" class="muted">已回复：{{ c.reply }}</div>
        <div v-else class="row mt8">
          <input v-model="complaintReply[c.id]" placeholder="回复内容" style="flex: 1" />
          <button class="small" @click="reply(c.id)">回复</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>完整训练记录（与会员、教练看到的是同一份）</h3>
      <TrainingTimeline :member-id="mid" />
    </div>
  </div>
  <div v-else class="page"><div class="empty">会员不存在</div></div>
</template>
