<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import type { PainChange, RiskAcknowledge } from '../../types'
import { weekdayCn } from '../../utils/date'
import RiskRestrictionCard from '../../components/RiskRestrictionCard.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const data = useDataStore()

const session = computed(() => data.sessions.find(s => s.id === (route.params.id as string)))
const member = computed(() => session.value ? data.accountById(session.value.memberId) : undefined)
const booking = computed(() => session.value ? data.bookingOf(session.value.memberId) : undefined)
const lastRecord = computed(() => {
  if (!session.value) return undefined
  return data.recordsOf(session.value.memberId).find(r => r.sessionId !== session.value!.id)
})
const existingRecord = computed(() => session.value ? data.recordOf(session.value.id) : undefined)

// ---- 风险动作限制（排课/课前自动提醒） ----
const restrictions = computed(() => session.value ? data.activeRestrictions(session.value.memberId) : [])
const riskHistory = computed(() => session.value ? data.riskAcksOf(session.value.memberId) : [])

const form = reactive({
  movesText: '',
  memberFeel: 6,
  feelNote: '',
  painChanges: [] as PainChange[],
  homePractice: '',
  coachNote: '',
  nextFocus: '',
})
const newPain = reactive({ part: '右膝', before: 3, after: 3 })
const partOptions = ['肩颈', '腰椎', '左膝', '右膝', '手腕', '髋部', '踝部', '其他']

function addPain() {
  form.painChanges.push({ ...newPain })
}

function submit() {
  const s = session.value
  if (!s) return
  const moves = form.movesText.split(/[、,，\n]/).map(x => x.trim()).filter(Boolean)
  if (!moves.length) { alert('请填写完成动作'); return }
  if (!form.homePractice.trim()) { alert('请布置家庭练习'); return }
  data.completeSession(s.id, {
    completedMoves: moves,
    memberFeel: form.memberFeel,
    feelNote: form.feelNote,
    painChanges: [...form.painChanges],
    homePractice: form.homePractice,
    coachNote: form.coachNote,
    nextFocus: form.nextFocus || undefined,
  }, auth.current!.name)
  if (s.isExperience && s.bookingId) {
    router.push(`/coach/assess/${s.bookingId}`)
  } else {
    router.push('/coach')
  }
}

// ---- 会员坚持挑战高难度（被限制）体式：再次告知风险并记录处置 ----
const showAck = ref(false)
const ack = reactive({
  requestedMove: '',
  bodyPart: '',
  decision: '已降阶调整' as RiskAcknowledge['decision'],
  plan: '',
  memberInformed: true,
})
const ackMsg = ref('')

function openAck() {
  ack.requestedMove = restrictions.value[0]?.forbiddenMoves[0] ?? ''
  ack.bodyPart = restrictions.value[0]?.bodyPart ?? ''
  ack.decision = '已降阶调整'
  ack.plan = ''
  ack.memberInformed = true
  showAck.value = true
}

function submitAck() {
  const s = session.value
  if (!s) return
  if (!ack.requestedMove.trim()) { alert('请填写会员坚持挑战的体式'); return }
  if (!ack.bodyPart.trim()) { alert('请选择涉及的受限部位'); return }
  if (!ack.memberInformed) { alert('请先再次向会员告知风险后再记录'); return }
  if (!ack.plan.trim()) { alert('请填写拒绝理由或降阶/保护方案'); return }
  data.recordRiskAck({
    memberId: s.memberId, coachId: auth.current!.id, sessionId: s.id,
    requestedMove: ack.requestedMove.trim(), bodyPart: ack.bodyPart.trim(),
    decision: ack.decision, plan: ack.plan.trim(), memberInformed: ack.memberInformed,
    coachWitness: auth.current!.name,
  }, auth.current!.name)
  showAck.value = false
  ackMsg.value = '已记录风险二次确认与处置结论'
  setTimeout(() => (ackMsg.value = ''), 2500)
}

const decisionClass: Record<RiskAcknowledge['decision'], string> = {
  已拒绝: 'gray', 已降阶调整: 'amber', 知情同意后挑战: 'danger',
}
</script>

<template>
  <div class="page" v-if="session">
    <h2 class="page-title">
      {{ session.isExperience ? '体验课' : '私教课' }} · {{ member?.name }}
      <span class="tag" :class="session.isExperience ? 'clay' : ''">{{ session.kind }}</span>
    </h2>
    <p class="page-sub">{{ session.date }}（{{ weekdayCn(session.date) }}）{{ session.time }} · 本节课重点：{{ session.focus }}</p>

    <div v-if="ackMsg" class="banner warn">{{ ackMsg }}</div>

    <!-- 排课/课前自动提醒：风险动作限制 + 替代器械与辅助动作 -->
    <RiskRestrictionCard v-if="restrictions.length && session.status === '待上课'" :member-id="session.memberId"
      title="课前风险提醒 · 请提前备好替代器械并避开高风险体式" />

    <div class="grid cols-2">
      <div class="card">
        <h3>会员背景</h3>
        <dl v-if="booking" class="kv">
          <dt>训练目标</dt><dd>{{ booking.goals.join('、') }}</dd>
          <dt>身体疼痛</dt><dd>{{ booking.pains.map(p => `${p.part} ${p.level}分`).join('、') || '无' }}</dd>
          <dt>运动基础</dt><dd>{{ booking.fitnessBase }} · 柔韧性 {{ booking.flexibility }}</dd>
        </dl>
        <h3 class="mt16">上节课反馈</h3>
        <template v-if="lastRecord">
          <div style="font-size: 14px">
            体感 {{ lastRecord.memberFeel }}/10 · {{ lastRecord.feelNote }}<br />
            <span v-if="lastRecord.painChanges.length">疼痛：{{ lastRecord.painChanges.map(p => `${p.part} ${p.before}→${p.after}`).join('，') }}<br /></span>
            教练备注：{{ lastRecord.coachNote }}
          </div>
        </template>
        <div v-else class="empty">第一节课，无历史反馈</div>
      </div>

      <!-- 已完成：只读展示 -->
      <div v-if="existingRecord" class="card">
        <h3>课后记录（已提交）</h3>
        <dl class="kv">
          <dt>完成动作</dt><dd>{{ existingRecord.completedMoves.join('、') }}</dd>
          <dt>会员体感</dt><dd>{{ existingRecord.memberFeel }}/10 {{ existingRecord.feelNote }}</dd>
          <dt>疼痛变化</dt><dd>{{ existingRecord.painChanges.map(p => `${p.part} ${p.before}→${p.after}`).join('，') || '无' }}</dd>
          <dt>家庭练习</dt><dd>{{ existingRecord.homePractice }}</dd>
          <dt>教练备注</dt><dd>{{ existingRecord.coachNote }}</dd>
        </dl>
      </div>

      <!-- 待上课：填写记录 -->
      <div v-else-if="session.status === '待上课'" class="card">
        <h3>课后记录</h3>
        <div class="form-row">
          <label>完成动作（用顿号或换行分隔）</label>
          <textarea v-model="form.movesText" placeholder="如：泡沫轴髂胫束松解、蚌式开合 3×15、臀桥 3×12"></textarea>
        </div>
        <div class="grid cols-2">
          <div class="form-row">
            <label>会员体感（1 很轻松 - 10 非常吃力）：{{ form.memberFeel }}</label>
            <input v-model.number="form.memberFeel" type="range" min="1" max="10" />
          </div>
          <div class="form-row"><label>体感说明</label><input v-model="form.feelNote" placeholder="如：松解时酸胀明显" /></div>
        </div>
        <div class="form-row">
          <label>疼痛变化（课前 → 课后）</label>
          <div v-for="(p, i) in form.painChanges" :key="i" class="row mb8">
            <span class="tag clay">{{ p.part }}：{{ p.before }} → {{ p.after }} 分</span>
            <span v-if="p.after > p.before" class="tag danger">加重，请在下节课降强度</span>
            <button class="small ghost" @click="form.painChanges.splice(i, 1)">删除</button>
          </div>
          <div class="row">
            <select v-model="newPain.part" style="width: 100px"><option v-for="o in partOptions" :key="o">{{ o }}</option></select>
            <input v-model.number="newPain.before" type="number" min="0" max="10" style="width: 80px" title="课前" />
            <span>→</span>
            <input v-model.number="newPain.after" type="number" min="0" max="10" style="width: 80px" title="课后" />
            <button class="small" type="button" @click="addPain">添加</button>
          </div>
        </div>
        <div class="form-row"><label>家庭练习布置</label><input v-model="form.homePractice" placeholder="如：每天蚌式开合 2 组" /></div>
        <div class="form-row"><label>教练备注（下节课依据）</label><textarea v-model="form.coachNote" placeholder="如：臀中肌力量偏弱，先不上负重"></textarea></div>
        <div class="form-row"><label>下节课重点（可选，自动同步到排课）</label><input v-model="form.nextFocus" /></div>
        <button @click="submit">
          {{ session.isExperience ? '完成上课并填写体验测评 →' : '提交课后记录' }}
        </button>
      </div>

      <div v-else class="card">
        <h3>课程状态：{{ session.status }}</h3>
        <p class="muted">该课程未正常进行，无需填写课后记录。</p>
      </div>
    </div>

    <!-- 会员坚持挑战高难度体式：教练再次确认风险并记录拒绝/调整方案 -->
    <div v-if="restrictions.length && session.status === '待上课'" class="card risk-ack">
      <div class="between">
        <h3 style="margin: 0">会员坚持挑战高难度体式？</h3>
        <button v-if="!showAck" class="small danger" @click="openAck">再次告知风险并记录</button>
      </div>
      <p class="muted">若会员希望尝试被限制的体式，教练须 <b>再次当面告知风险</b>，并将「拒绝 / 降阶调整 / 知情同意后谨慎挑战」的处置方案留痕。</p>

      <div v-if="showAck" class="ack-form">
        <div class="grid cols-2">
          <div class="form-row">
            <label>会员坚持挑战的体式 *</label>
            <input v-model="ack.requestedMove" placeholder="如：轮式 / 深度深蹲" />
            <select v-model="ack.requestedMove" style="margin-top: 6px">
              <option value="" disabled>或从禁止动作中选择</option>
              <option v-for="m in restrictions.flatMap(r => r.forbiddenMoves)" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>涉及受限部位 *</label>
            <select v-model="ack.bodyPart">
              <option v-for="r in restrictions" :key="r.id" :value="r.bodyPart">{{ r.bodyPart }}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <label>处置结论 *</label>
          <div class="checks">
            <label v-for="d in (['已拒绝','已降阶调整','知情同意后挑战'] as const)" :key="d" :class="{ on: ack.decision === d }">
              <input type="radio" :value="d" v-model="ack.decision" />{{ d }}
            </label>
          </div>
        </div>
        <div class="form-row">
          <label>拒绝理由 / 降阶与保护方案 *</label>
          <textarea v-model="ack.plan" :placeholder="ack.decision === '已拒绝'
            ? '如：该体式需腰椎深度后弯，当前骨盆前倾未改善，本次拒绝，建议 8 周后复测。'
            : '如：降阶为抱枕支撑桥式，腰下卷毛毯，教练旁侧保护，仅做胸椎段后弯。'"></textarea>
        </div>
        <label class="confirm-line">
          <input type="checkbox" v-model="ack.memberInformed" style="width: auto" />
          我已当面向会员再次告知该体式对{{ ack.bodyPart || '受限部位' }}的风险
        </label>
        <div class="row mt8">
          <button class="warn" @click="submitAck">保存风险确认记录</button>
          <button class="ghost" @click="showAck = false">取消</button>
        </div>
      </div>

      <div v-if="riskHistory.length" class="mt16">
        <div class="muted" style="margin-bottom: 6px">历史风险确认记录</div>
        <div v-for="a in riskHistory" :key="a.id" class="ack-history">
          <div class="between">
            <b>「{{ a.requestedMove }}」</b>
            <span><span class="tag" :class="decisionClass[a.decision]">{{ a.decision }}</span><span class="muted">{{ a.createdAt }} · {{ a.coachWitness }}</span></span>
          </div>
          <div class="muted" style="font-size: 13px">{{ a.bodyPart }} · {{ a.plan }}</div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="page"><div class="empty">课程不存在</div></div>
</template>

<style scoped>
.risk-ack { border-color: #ecc9be; }
.ack-form { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-top: 10px; background: #fff; }
.confirm-line { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--ink); }
.ack-history { border-bottom: 1px dashed var(--line); padding: 8px 0; font-size: 14px; }
</style>
