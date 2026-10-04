<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import TrainingTimeline from '../../components/TrainingTimeline.vue'
import ProfessionalProfile from '../../components/ProfessionalProfile.vue'
import PackageCard from '../../components/PackageCard.vue'
import RiskNoticeBanner from '../../components/RiskNoticeBanner.vue'
import RiskRestrictionCard from '../../components/RiskRestrictionCard.vue'
import RiskRestrictionEditor from '../../components/RiskRestrictionEditor.vue'
import RiskConfirmDialog from '../../components/RiskConfirmDialog.vue'
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
const restrictions = computed(() => data.restrictionsOf(mid))
const confirmations = computed(() => data.riskConfirmationsOf(mid))

const adjust = reactive({ note: '', nextFocus: '' })
const msg = ref('')

const showAddRisk = ref(false)
const riskEditorRef = ref<InstanceType<typeof RiskRestrictionEditor>>()
const showConfirm = ref(false)

function submitAdjust() {
  if (!adjust.note.trim()) { alert('请填写调整说明'); return }
  data.adjustPlan(mid, coachId, adjust.note, adjust.nextFocus || undefined, coachName)
  adjust.note = ''
  adjust.nextFocus = ''
  msg.value = '课程调整已写入训练记录，顾问与会员可见'
  setTimeout(() => (msg.value = ''), 2500)
}

/** 复评：新增一条风险动作限制（即时对排课与团课报名生效） */
function submitRestriction() {
  if (!riskEditorRef.value) return
  const err = riskEditorRef.value.validate()
  if (err) { alert(err); return }
  const input = riskEditorRef.value.getData()
  if (!confirm('新增的风险动作限制将立即生效：其他教练排课自动预警并准备替代器械，团课报名前台收到提示。确认保存？')) return
  data.addRiskRestriction(mid, coachId, input, '复评', undefined, coachName)
  showAddRisk.value = false
  riskEditorRef.value.reset()
  msg.value = '风险动作限制已生效'
  setTimeout(() => (msg.value = ''), 2500)
}

function releaseRestriction(id: string) {
  const note = prompt('解除后该风险动作限制将不再预警，请填写解除依据（如：8 周复评疼痛清零、动作模式稳定）')
  if (note && note.trim()) {
    data.releaseRestriction(id, coachId, note.trim(), coachName)
    msg.value = '风险动作限制已解除'
    setTimeout(() => (msg.value = ''), 2500)
  }
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

    <!-- 会员有风险动作限制时，档案页最顶部强提醒 -->
    <RiskNoticeBanner v-if="restrictions.length" :member-id="mid" show-prep
      title="该会员有生效中的风险动作限制，排课与团课均会自动预警" />

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

    <!-- 风险动作限制管理 -->
    <div class="card">
      <div class="between">
        <h3 style="margin: 0">⚠️ 运动风险动作限制</h3>
        <div class="row">
          <button class="small ghost" @click="showConfirm = true">高难体式二次确认登记</button>
          <button class="small" @click="showAddRisk = !showAddRisk">
            {{ showAddRisk ? '收起' : '＋ 复评新增限制' }}
          </button>
        </div>
      </div>
      <p class="muted">禁止动作与替代动作成对记录，生效后自动提醒所有教练避开、准备替代器械与辅助动作。</p>

      <div v-if="showAddRisk" class="add-risk">
        <RiskRestrictionEditor ref="riskEditorRef" />
        <div class="row" style="justify-content: flex-end">
          <button class="ghost" @click="showAddRisk = false">取消</button>
          <button @click="submitRestriction">保存并立即生效</button>
        </div>
      </div>

      <RiskRestrictionCard :member-id="mid" show-released />
      <div class="row" style="justify-content: flex-end">
        <button
          v-for="r in restrictions" :key="r.id"
          class="small ghost" @click="releaseRestriction(r.id)"
        >解除「{{ r.bodyPart }}」限制</button>
      </div>
    </div>

    <!-- 高难体式二次确认记录 -->
    <div v-if="confirmations.length" class="card">
      <h3>高难体式二次确认记录（会员坚持挑战时留痕）</h3>
      <div v-for="c in confirmations" :key="c.id" class="mb8" style="border-bottom: 1px solid var(--line); padding-bottom: 8px; font-size: 13px">
        <div class="between">
          <b>{{ c.createdAt }} · {{ c.move }}</b>
          <span class="tag" :class="c.decision === '拒绝该动作' ? 'danger' : c.decision === '坚持完成（已告知风险）' ? 'amber' : ''">{{ c.decision }}</span>
        </div>
        <div v-if="c.adjustedMove" class="mt8">调整方案：{{ c.adjustedMove }}</div>
        <div class="muted">{{ c.note }}</div>
      </div>
    </div>

    <div class="card">
      <h3>我的专业档案（顾问只读，不可改写）</h3>
      <ProfessionalProfile :member-id="mid" viewer-role="coach" />
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

    <RiskConfirmDialog :open="showConfirm" :member-id="mid" @close="showConfirm = false" />
  </div>
</template>

<style scoped>
.add-risk { border: 1px solid var(--line); border-radius: var(--radius); padding: 14px 16px; margin-bottom: 14px; background: #fffdf9; }
</style>
