<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import type { GroupClass } from '../../types'
import { weekdayCn } from '../../utils/date'
import RiskRestrictionCard from '../../components/RiskRestrictionCard.vue'

const auth = useAuthStore()
const data = useDataStore()
const myName = auth.current!.name

const classes = computed(() => data.upcomingGroupClasses)
const members = computed(() => data.accounts.filter(a => a.role === 'member'))

// 每个团课当前选中的待报名会员
const picked = reactive<Record<string, string>>({})
// 高风险拦截弹层状态
const override = reactive<{ classId: string; memberId: string; note: string }>({ classId: '', memberId: '', note: '' })
const overrideOpen = ref(false)
const msg = ref('')
function flash(t: string) { msg.value = t; setTimeout(() => (msg.value = ''), 3000) }

const intensityClass: Record<string, string> = { 低强度: '', 中强度: 'amber', 高强度: 'danger' }

function riskOf(memberId: string, gc: GroupClass) {
  return data.classRiskFor(memberId, gc)
}
function altsFor(memberId: string, gc: GroupClass) {
  return data.lowIntensityAlternatives(memberId, gc.id)
}

function enroll(gc: GroupClass) {
  const memberId = picked[gc.id]
  if (!memberId) { alert('请先选择要报名的会员'); return }
  const res = data.enrollGroupClass(gc.id, memberId, myName)
  if (res.ok) {
    const caution = res.risk?.level === 'caution'
    picked[gc.id] = ''
    flash(caution
      ? '报名成功：已记录该会员动作限制，课中请教练使用替代动作'
      : '报名成功，风险动作限制核对无冲突')
  } else if (res.reason === '风险拦截' && res.risk) {
    // 打开高风险知情登记
    override.classId = gc.id
    override.memberId = memberId
    override.note = ''
    overrideOpen.value = true
  } else {
    alert(res.reason)
  }
}

function confirmOverride() {
  if (!override.note.trim()) { alert('请填写知情登记说明（前台已告知、会员仍坚持）'); return }
  data.enrollGroupClassOverride(override.classId, override.memberId, myName, override.note.trim())
  overrideOpen.value = false
  picked[override.classId] = ''
  flash('已登记知情报名，并同步通知带课教练重点看护')
}

function quickEnrollAlt(altClassId: string) {
  const res = data.enrollGroupClass(altClassId, override.memberId, myName)
  overrideOpen.value = false
  if (res.ok) {
    picked[altClassId] = ''
    flash('已为会员改报低强度替代课程')
  } else {
    flash('改报未成功：' + res.reason)
  }
}

function cancelEnroll(gc: GroupClass, memberId: string) {
  if (confirm(`确认取消 ${data.nameOf(memberId)} 的「${gc.name}」报名？`)) {
    data.cancelGroupClassEnrollment(gc.id, memberId, myName)
  }
}

const overrideClass = computed(() => data.classById(override.classId))
const overrideMember = computed(() => data.accountById(override.memberId))
</script>

<template>
  <div class="page">
    <h2 class="page-title">团课前台 · 报名与风险提示</h2>
    <p class="page-sub">为会员报名团课前，系统会自动读取其 <b>风险动作限制</b>：高风险体式直接提示拦截并推荐低强度课程；已报名花名册同步标注，方便带课教练避开。</p>

    <div v-if="msg" class="banner warn">{{ msg }}</div>

    <div v-for="gc in classes" :key="gc.id" class="card gc-card">
      <div class="between">
        <h3 style="margin: 0">
          {{ gc.name }}
          <span class="tag" :class="intensityClass[gc.intensity]">{{ gc.intensity }}</span>
        </h3>
        <span class="muted">{{ gc.date }}（{{ weekdayCn(gc.date) }}）{{ gc.time }} · {{ data.coachById(gc.coachId)?.name }}</span>
      </div>
      <div class="mt8" style="font-size: 14px">
        <span class="muted">主要体式：</span>{{ gc.featuredMoves.join('、') }}
      </div>
      <div class="muted" style="font-size: 13px">{{ gc.note }}</div>

      <!-- 选中会员后即时风险预判 -->
      <div class="row mt8 enroll-row">
        <select v-model="picked[gc.id]" style="width: 200px">
          <option value="" disabled>选择会员报名</option>
          <option v-for="m in members" :key="m.id" :value="m.id">
            {{ m.name }}<template v-if="data.hasRiskRestriction(m.id)">（⚠️ 有动作限制）</template>
          </option>
        </select>
        <button @click="enroll(gc)">报名</button>
        <span class="muted">{{ gc.enrolledMemberIds.length }}/{{ gc.capacity }} 人</span>
      </div>

      <div v-if="picked[gc.id]" class="mt8">
        <div v-if="riskOf(picked[gc.id], gc).level === 'high'" class="banner danger">
          🚫 <b>{{ data.nameOf(picked[gc.id]) }} 不适合「{{ gc.name }}」</b>：
          <template v-if="riskOf(picked[gc.id], gc).hits.length">
            课程含被禁体式 {{ riskOf(picked[gc.id], gc).hits.map(h => h.move).join('、') }}；
          </template>
          <template v-else>该课程为高强度，会员存在动作限制。</template>
          建议改报低强度课程：{{ altsFor(picked[gc.id], gc).map(a => a.name).join('、') || '近期暂无低强度团课' }}。
        </div>
        <div v-else-if="riskOf(picked[gc.id], gc).level === 'caution'" class="banner warn">
          ⚠️ 该会员有 {{ riskOf(picked[gc.id], gc).restrictions.map(r => r.bodyPart).join('、') }} 动作限制；本课程未直接命中禁忌体式，报名后请带课教练课中避开并使用替代动作。
        </div>
        <RiskRestrictionCard v-if="data.hasRiskRestriction(picked[gc.id])" :member-id="picked[gc.id]" variant="compact" class="mt8" />
      </div>

      <!-- 花名册：风险标记 -->
      <div class="roster mt16">
        <div class="muted" style="margin-bottom: 6px">报名花名册（带课教练可见风险标记）</div>
        <div v-if="gc.enrolledMemberIds.length" class="chips">
          <span v-for="mid in gc.enrolledMemberIds" :key="mid" class="roster-chip" :class="{ risky: data.hasRiskRestriction(mid) }">
            {{ data.nameOf(mid) }}
            <span v-for="r in data.activeRestrictions(mid)" :key="r.id" class="tag danger">⚠️ {{ r.bodyPart }}</span>
            <button class="x" @click="cancelEnroll(gc, mid)" title="取消报名">×</button>
          </span>
        </div>
        <div v-else class="muted" style="font-size: 13px">暂无人报名</div>
      </div>
    </div>

    <!-- 高风险：再次告知 + 低强度替代 + 知情登记 -->
    <div v-if="overrideOpen && overrideClass" class="modal-mask" @click.self="overrideOpen = false">
      <div class="modal card">
        <h3>🚫 高风险团课报名确认</h3>
        <p><b>{{ overrideMember?.name }}</b> 拟报名「{{ overrideClass.name }}」（{{ overrideClass.intensity }}）。</p>
        <RiskRestrictionCard :member-id="override.memberId" variant="compact" />
        <div v-if="riskOf(override.memberId, overrideClass).hits.length" class="banner danger">
          课程体式直接命中禁忌：{{ riskOf(override.memberId, overrideClass).hits.map(h => h.move).join('、') }}
        </div>

        <div class="form-row">
          <label>推荐改报低强度课程</label>
          <div class="row">
            <button v-for="a in altsFor(override.memberId, overrideClass)" :key="a.id" class="small" @click="quickEnrollAlt(a.id)">
              改报「{{ a.name }}」· {{ a.date.slice(5) }}
            </button>
            <span v-if="!altsFor(override.memberId, overrideClass).length" class="muted">近期暂无低强度团课，可建议预约私教理疗课</span>
          </div>
        </div>

        <div class="form-row">
          <label>会员仍坚持参加本课程 —— 知情登记（将留痕并通知教练）</label>
          <textarea v-model="override.note" placeholder="如：前台已当面告知腰椎/高风险体式风险并建议低强度课，会员知情仍坚持参加，承诺课中听从教练保护安排。"></textarea>
        </div>
        <div class="row">
          <button class="danger" @click="confirmOverride">已再次告知，登记并报名</button>
          <button class="ghost" @click="overrideOpen = false">放弃报名</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gc-card { border-left: 4px solid var(--sage); }
.enroll-row { align-items: center; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.roster-chip {
  display: inline-flex; align-items: center; gap: 4px;
  border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; font-size: 13px; background: #fff;
}
.roster-chip.risky { border-color: #ecc9be; background: var(--danger-soft); color: var(--danger); }
.roster-chip .x { border: none; background: transparent; color: var(--muted); padding: 0 0 0 4px; font-size: 14px; }
.modal-mask {
  position: fixed; inset: 0; background: rgba(46, 42, 38, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px;
}
.modal { width: 640px; max-width: 100%; max-height: 88vh; overflow: auto; margin: 0; }
</style>
