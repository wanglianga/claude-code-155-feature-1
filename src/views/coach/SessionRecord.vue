<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import RiskNoticeBanner from '../../components/RiskNoticeBanner.vue'
import RiskConfirmDialog from '../../components/RiskConfirmDialog.vue'
import type { PainChange } from '../../types'
import { weekdayCn } from '../../utils/date'

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
const riskSummary = computed(() => session.value ? data.riskSummaryOf(session.value.memberId) : null)
const recentConfirmations = computed(() =>
  session.value ? data.riskConfirmationsOf(session.value.memberId).slice(0, 3) : [])

const showConfirm = ref(false)

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

/** 已填写动作中命中会员禁忌的项（红色预警，提醒改用替代动作） */
const typedMoves = computed(() =>
  form.movesText.split(/[、,，\n]/).map(x => x.trim()).filter(Boolean))
const moveHits = computed(() => session.value ? data.matchMemberMoves(session.value.memberId, typedMoves.value) : [])

function addPain() {
  form.painChanges.push({ ...newPain })
}

function submit() {
  const s = session.value
  if (!s) return
  const moves = form.movesText.split(/[、,，\n]/).map(x => x.trim()).filter(Boolean)
  if (!moves.length) { alert('请填写完成动作'); return }
  if (!form.homePractice.trim()) { alert('请布置家庭练习'); return }
  // 完成动作含禁忌体式：必须先做风险二次确认并留痕
  if (moveHits.value.length) {
    const confirmed = data.riskConfirmationsOf(s.memberId).some(c => c.sessionId === s.id)
    if (!confirmed) {
      alert(`完成动作中包含风险限制内体式（${moveHits.value.map(h => h.pair.forbidden).join('、')}）。\n若会员坚持完成，请先点击「高难体式二次确认」记录风险告知与处理方案；否则请改为替代动作。`)
      return
    }
  }
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
</script>

<template>
  <div class="page" v-if="session">
    <h2 class="page-title">
      {{ session.isExperience ? '体验课' : '私教课' }} · {{ member?.name }}
      <span class="tag" :class="session.isExperience ? 'clay' : ''">{{ session.kind }}</span>
    </h2>
    <p class="page-sub">{{ session.date }}（{{ weekdayCn(session.date) }}）{{ session.time }} · 本节课重点：{{ session.focus }}</p>

    <!-- 排课生效的风险动作限制：自动提醒避开禁忌、准备替代器械与辅助动作 -->
    <RiskNoticeBanner
      v-if="riskSummary?.hasRisk && session.status === '待上课'"
      :member-id="session.memberId"
      show-prep
      title="本节课请避开该会员禁忌体式，使用替代动作教学"
    />

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
          <div v-if="moveHits.length" class="banner danger" style="margin-top: 8px">
            <b>检测到风险限制内体式：</b>
            <div v-for="(h, i) in moveHits" :key="i" style="margin-top: 4px">
              ✕ {{ h.pair.forbidden }}（已填：{{ h.move }}）→ 请改用「{{ h.pair.alternative }}」
            </div>
            <div class="mt8">若会员坚持完成，请先登记「高难体式二次确认」，否则无法提交含禁忌动作的记录。</div>
          </div>
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

        <div class="between">
          <button @click="submit">
            {{ session.isExperience ? '完成上课并填写体验测评 →' : '提交课后记录' }}
          </button>
          <button v-if="riskSummary?.hasRisk" type="button" class="ghost warn" @click="showConfirm = true">
            ⚠️ 会员坚持高难体式？二次确认登记
          </button>
        </div>
      </div>

      <div v-else class="card">
        <h3>课程状态：{{ session.status }}</h3>
        <p class="muted">该课程未正常进行，无需填写课后记录。</p>
      </div>
    </div>

    <!-- 高难体式二次确认历史 -->
    <div v-if="recentConfirmations.length" class="card">
      <h3>⚠️ 高难体式二次确认记录</h3>
      <div v-for="c in recentConfirmations" :key="c.id" class="mb8" style="border-bottom: 1px solid var(--line); padding-bottom: 8px; font-size: 13px">
        <div class="between">
          <b>{{ c.createdAt }} · {{ c.move }}</b>
          <span class="tag" :class="c.decision === '拒绝该动作' ? 'danger' : c.decision === '坚持完成（已告知风险）' ? 'amber' : ''">{{ c.decision }}</span>
        </div>
        <div v-if="c.adjustedMove" class="mt8">调整方案：{{ c.adjustedMove }}</div>
        <div class="muted">{{ c.note }}</div>
      </div>
    </div>

    <RiskConfirmDialog
      :open="showConfirm"
      :member-id="session.memberId"
      :session-id="session.id"
      @close="showConfirm = false"
    />
  </div>
  <div v-else class="page"><div class="empty">课程不存在</div></div>
</template>
