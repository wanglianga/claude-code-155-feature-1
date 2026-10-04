<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import TrainingTimeline from '../../components/TrainingTimeline.vue'
import ProfessionalProfile from '../../components/ProfessionalProfile.vue'
import PackageCard from '../../components/PackageCard.vue'
import RiskRestrictionCard from '../../components/RiskRestrictionCard.vue'
import TagInput from '../../components/TagInput.vue'
import type { RestrictionDraft } from '../../types'
import { weekdayCn } from '../../utils/date'

const route = useRoute()
const auth = useAuthStore()
const data = useDataStore()
const mid = route.params.id as string
const coachId = auth.current!.id
const coachName = auth.current!.name

const member = computed(() => data.accountById(mid))
const booking = computed(() => data.bookingOf(mid))
const pkg = computed(() => data.activePackage(mid))
const records = computed(() => data.recordsOf(mid))
const upcoming = computed(() => data.upcomingSessions(mid).filter(s => s.coachId === coachId))
const openTickets = computed(() => data.tickets.filter(t => t.memberId === mid && t.status !== '已解决'))
const activeRisks = computed(() => data.activeRestrictions(mid))
const allRisks = computed(() => data.restrictions.filter(r => r.memberId === mid)
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
const riskAcks = computed(() => data.riskAcksOf(mid))

const adjust = reactive({ note: '', nextFocus: '' })
const msg = ref('')

function submitAdjust() {
  if (!adjust.note.trim()) { alert('请填写调整说明'); return }
  data.adjustPlan(mid, coachId, adjust.note, adjust.nextFocus || undefined, coachName)
  adjust.note = ''
  adjust.nextFocus = ''
  msg.value = '课程调整已写入训练记录，顾问与会员可见'
  setTimeout(() => (msg.value = ''), 2500)
}

// ---- 风险动作限制：训练中新增不适时由教练标记 ----
const showRiskForm = ref(false)
const riskForm = reactive<RestrictionDraft>({
  bodyPart: '', forbiddenMoves: [], alternativeMoves: [], alternativeEquipment: [], assistActions: [], reason: '',
})

function openRiskForm() {
  riskForm.bodyPart = booking.value?.pains[0]?.part ?? ''
  riskForm.forbiddenMoves = []
  riskForm.alternativeMoves = []
  riskForm.alternativeEquipment = []
  riskForm.assistActions = []
  riskForm.reason = ''
  showRiskForm.value = true
}

function submitRisk() {
  if (!riskForm.bodyPart.trim()) { alert('请填写受限部位'); return }
  if (!riskForm.forbiddenMoves.length) { alert('请至少标记一个禁止动作'); return }
  data.markRestriction(mid, coachId, { ...riskForm }, '课程调整', coachName)
  showRiskForm.value = false
  msg.value = '风险动作限制已生效，排课与团课报名将自动提醒'
  setTimeout(() => (msg.value = ''), 2500)
}

function releaseRisk(id: string) {
  const note = prompt('解除原因（将保留历史限制记录）：', '会员已恢复，复测无不适')
  if (note === null) return
  data.releaseRestriction(id, coachName, note.trim())
}
</script>

<template>
  <div class="page">
    <h2 class="page-title">{{ member?.name }} · 训练档案</h2>
    <p class="page-sub">教练视角：测评、目标、疼痛趋势与每节课记录，是排课与调整的唯一依据。</p>

    <div v-if="msg" class="banner warn">{{ msg }}</div>

    <div v-if="openTickets.length" class="banner danger">
      ⚠️ 进行中的事项：{{ openTickets.map(t => t.title).join('；') }}
    </div>

    <div class="grid cols-2">
      <div class="card">
        <h3>会员基础信息（预约时填写）</h3>
        <dl v-if="booking" class="kv">
          <dt>运动基础</dt><dd>{{ booking.fitnessBase }}</dd>
          <dt>身体疼痛</dt><dd>{{ booking.pains.map(p => `${p.part} ${p.level}分（${p.note}）`).join('；') || '无' }}</dd>
          <dt>柔韧性</dt><dd>{{ booking.flexibility }}</dd>
          <dt>训练目标</dt><dd>{{ booking.goals.join('、') }}<span v-if="booking.goalNote">（{{ booking.goalNote }}）</span></dd>
          <dt>可上课时间</dt><dd>{{ booking.availableSlots.join('、') }}</dd>
        </dl>
        <div v-else class="empty">无预约信息</div>
      </div>

      <div class="card">
        <h3>当前课包</h3>
        <PackageCard v-if="pkg" :pkg="pkg" />
        <div v-else class="empty">暂无进行中课包（体验课阶段）</div>
        <h3 class="mt16">待上课程</h3>
        <div v-for="s in upcoming.slice(0, 3)" :key="s.id" class="row mb8" style="font-size: 14px">
          <span class="tag">{{ s.date }} {{ weekdayCn(s.date) }}</span>
          <span>{{ s.time }}</span>
          <span class="muted">{{ s.focus }}</span>
        </div>
        <div v-if="!upcoming.length" class="empty">暂无待上课程</div>
      </div>
    </div>

    <div class="card">
      <h3>我的专业档案（顾问只读，不可改写）</h3>
      <ProfessionalProfile :member-id="mid" viewer-role="coach" />
    </div>

    <!-- 运动风险动作限制：生效中全员共享，可新增/解除 -->
    <div class="card">
      <div class="between">
        <h3 style="margin: 0">运动风险动作限制</h3>
        <button v-if="!showRiskForm" class="small" @click="openRiskForm">+ 训练中新增限制</button>
      </div>
      <p class="muted">标记后在会员维度生效：其他教练排课/代课、前台团课报名都会自动提醒避开高风险体式，并准备替代器械与辅助动作。</p>

      <RiskRestrictionCard v-if="activeRisks.length" :member-id="mid" />
      <div v-if="activeRisks.length" class="row mb8">
        <button v-for="r in activeRisks" :key="r.id" class="small ghost" @click="releaseRisk(r.id)">解除「{{ r.bodyPart }}」限制</button>
      </div>
      <div v-if="!activeRisks.length" class="empty">当前无生效中的动作限制</div>

      <!-- 新增限制表单 -->
      <div v-if="showRiskForm" class="risk-form">
        <div class="grid cols-2">
          <div class="form-row">
            <label>受限/不适部位 *</label>
            <input v-model="riskForm.bodyPart" placeholder="如：腰椎 / 右膝" />
          </div>
          <div class="form-row">
            <label>标记原因 / 课中表现</label>
            <input v-model="riskForm.reason" placeholder="如：今日后弯时腰部酸胀" />
          </div>
        </div>
        <div class="form-row">
          <label>禁止动作（高风险体式）*</label>
          <TagInput v-model="riskForm.forbiddenMoves" placeholder="输入后回车" />
        </div>
        <div class="form-row">
          <label>替代动作（降阶体式）</label>
          <TagInput v-model="riskForm.alternativeMoves" placeholder="输入后回车" />
        </div>
        <div class="grid cols-2">
          <div class="form-row">
            <label>替代器械（排课提醒准备）</label>
            <TagInput v-model="riskForm.alternativeEquipment" placeholder="如：瑜伽抱枕、瑜伽砖" />
          </div>
          <div class="form-row">
            <label>辅助动作 / 保护手法</label>
            <TagInput v-model="riskForm.assistActions" placeholder="如：腰下卷毛毯支撑" />
          </div>
        </div>
        <div class="row">
          <button class="warn" @click="submitRisk">保存并生效</button>
          <button class="ghost" @click="showRiskForm = false">取消</button>
        </div>
      </div>

      <!-- 高难度体式二次确认留痕 -->
      <div v-if="riskAcks.length" class="mt16">
        <div class="muted" style="margin-bottom: 6px">高难度体式风险确认记录</div>
        <div v-for="a in riskAcks" :key="a.id" class="ack-item">
          <div class="between">
            <b>会员坚持「{{ a.requestedMove }}」</b>
            <span><span class="tag" :class="a.decision === '已拒绝' ? 'gray' : a.decision === '已降阶调整' ? 'amber' : 'danger'">{{ a.decision }}</span></span>
          </div>
          <div class="muted" style="font-size: 13px">{{ a.bodyPart }} · 已再次告知：{{ a.memberInformed ? '是' : '否' }} · {{ a.createdAt }} · {{ a.coachWitness }}</div>
          <div style="font-size: 13px">{{ a.plan }}</div>
        </div>
      </div>

      <!-- 已解除的历史限制 -->
      <details v-if="allRisks.some(r => r.status === '已解除')" class="mt16">
        <summary class="muted">已解除的历史限制</summary>
        <div v-for="r in allRisks.filter(x => x.status === '已解除')" :key="r.id" class="muted" style="font-size: 13px; padding-top: 6px">
          {{ r.bodyPart }}（{{ r.updatedAt.slice(0, 10) }} 解除）：曾禁止 {{ r.forbiddenMoves.join('、') }}
        </div>
      </details>
    </div>

    <div class="card">
      <h3>课程调整（写入训练记录）</h3>
      <p class="muted">会员不适、疼痛反复或进度变化时，在这里调整计划 —— 调整原因会保留，成为后续排课依据。</p>
      <div class="form-row">
        <label>调整说明（如：暂停屈膝负重，改为理疗序列）</label>
        <textarea v-model="adjust.note"></textarea>
      </div>
      <div class="form-row">
        <label>同步更新下节课重点（可选）</label>
        <input v-model="adjust.nextFocus" placeholder="如：膝关节减负版序列" />
      </div>
      <button @click="submitAdjust">保存调整</button>
    </div>

    <div class="card">
      <h3>课后记录</h3>
      <div v-for="r in records" :key="r.id" class="mb8" style="border-bottom: 1px solid var(--line); padding-bottom: 10px">
        <div class="between">
          <b>{{ r.createdAt.slice(0, 10) }}</b>
          <span class="muted">体感 {{ r.memberFeel }}/10<span v-if="r.painChanges.length"> · {{ r.painChanges.map(p => `${p.part} ${p.before}→${p.after}`).join('，') }}</span></span>
        </div>
        <div style="font-size: 14px">完成：{{ r.completedMoves.join('、') }}</div>
        <div class="muted" style="font-size: 13px">家庭练习：{{ r.homePractice }} · 备注：{{ r.coachNote }}</div>
      </div>
      <div v-if="!records.length" class="empty">暂无课后记录</div>
    </div>

    <div class="card">
      <h3>完整时间线</h3>
      <TrainingTimeline :member-id="mid" />
    </div>
  </div>
</template>

<style scoped>
.risk-form { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-top: 12px; background: #fffaf8; }
.ack-item { border-bottom: 1px dashed var(--line); padding: 8px 0; font-size: 14px; }
</style>
