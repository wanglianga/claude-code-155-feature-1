<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import RiskRestrictionCard from '../../components/RiskRestrictionCard.vue'
import { GROUP_CLASS_TEMPLATES } from '../../data/catalog'
import { weekdayCn } from '../../utils/date'

const auth = useAuthStore()
const data = useDataStore()

// ---------- 会员选择 ----------
const memberId = ref('')
const members = computed(() => data.accounts.filter(a => a.role === 'member'))
const member = computed(() => data.accountById(memberId.value))
const risk = computed(() => memberId.value ? data.riskSummaryOf(memberId.value) : null)
const myBookings = computed(() =>
  memberId.value
    ? data.memberGroupBookings(memberId.value)
        .map(b => ({ b, gc: data.classById(b.classId) }))
        .filter(x => x.gc)
    : [])

const classes = computed(() => data.upcomingGroupClasses)

function hitsOf(classId: string) {
  const gc = data.classById(classId)
  return memberId.value && gc ? data.matchMemberMoves(memberId.value, gc.moves) : []
}
function bookedCount(classId: string) { return data.classBookings(classId).length }
function full(classId: string) { const gc = data.classById(classId); return gc ? bookedCount(classId) >= gc.capacity : false }

/** 推荐给当前会员的安全课程：低强度且不命中任何禁忌 */
const safePicks = computed(() => {
  if (!memberId.value) return classes.value.filter(c => c.intensity === '低强度')
  return classes.value.filter(c => c.intensity === '低强度' && hitsOf(c.id).length === 0)
})

// ---------- 报名 ----------
const flow = reactive<Record<string, { open: boolean; acknowledged: boolean; advisory: string }>>({})
function flowOf(id: string) {
  if (!flow[id]) flow[id] = { open: false, acknowledged: false, advisory: '' }
  return flow[id]
}
const msg = ref('')
function flash(t: string) { msg.value = t; setTimeout(() => (msg.value = ''), 3000) }

function defaultAdvisory(classId: string, hits: { pair: { forbidden: string } }[]): string {
  const gc = data.classById(classId)
  if (hits.length) {
    const pick = safePicks.value[0]
    return `该课含会员禁忌体式（${hits.map(h => h.pair.forbidden).join('、')}），已建议改选${pick ? `「${pick.name}」` : '低强度课程'}；会员仍选择报名，已当面告知风险与替代动作安排。`
  }
  return `已核对会员风险动作限制，「${gc?.name}」无禁忌体式（${gc?.intensity}），可正常参加；已提醒课上不适及时告知教练。`
}

function book(classId: string, risky: boolean) {
  if (!memberId.value) { alert('请先选择会员'); return }
  const f = flowOf(classId)
  if (risky && !f.acknowledged) { alert('高风险课程报名必须勾选「已告知风险并确认会员知晓」'); return }
  if (!f.advisory.trim()) { alert('请填写前台建议/告知说明（写入训练记录）'); return }
  data.bookGroupClass(classId, memberId.value, auth.current!.id, risky ? f.acknowledged : true, f.advisory.trim(), auth.current!.name)
  f.open = false
  f.acknowledged = false
  f.advisory = ''
  flash(risky ? '已报名并完成风险告知留痕（建议后续优先安排低强度课程）' : '报名成功')
}

function quickBook(classId: string) {
  if (!memberId.value) { alert('请先选择会员'); return }
  const hits = hitsOf(classId)
  if (hits.length) { flowOf(classId).open = true; return }
  const f = flowOf(classId)
  f.advisory = defaultAdvisory(classId, [])
  book(classId, false)
}

function cancel(bookingId: string) {
  const reason = prompt('退订原因（将写入会员记录）')
  if (reason && reason.trim()) {
    data.cancelGroupBooking(bookingId, reason.trim(), 'consultant', auth.current!.name)
    flash('已取消报名')
  }
}

// ---------- 团课管理（顾问可用模板快速新增团课，便于演示完整链路） ----------
const showCreate = ref(false)
const newClass = reactive({ template: GROUP_CLASS_TEMPLATES[0].name, coachId: '', date: '', time: '19:00-20:00' })

function createClass() {
  if (!newClass.date || !newClass.coachId) { alert('请选择教练与日期'); return }
  const tpl = GROUP_CLASS_TEMPLATES.find(t => t.name === newClass.template)!
  data.publishGroupClass({
    name: tpl.name, coachId: newClass.coachId, date: newClass.date, time: newClass.time,
    intensity: tpl.intensity, moves: [...tpl.moves], equipment: [...tpl.equipment], note: tpl.note,
  })
  showCreate.value = false
  newClass.date = ''
  flash('团课已发布')
}

const intensityClass: Record<string, string> = { 低强度: '', 中强度: 'amber', 高强度: 'danger' }

const safeRef = ref<HTMLElement | null>(null)
function scrollToSafe() { safeRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
</script>

<template>
  <div class="page">
    <h2 class="page-title">团课报名 · 前台</h2>
    <p class="page-sub">报名前自动核对会员的风险动作限制：命中禁忌体式时提示风险并建议低强度课程；会员坚持参加须完成风险告知留痕。</p>

    <div v-if="msg" class="banner warn">{{ msg }}</div>

    <!-- 会员选择 -->
    <div class="card">
      <div class="grid cols-2">
        <div class="form-row" style="margin-bottom: 0">
          <label>选择会员</label>
          <select v-model="memberId">
            <option value="" disabled>请选择要报名团课的会员</option>
            <option v-for="m in members" :key="m.id" :value="m.id">
              {{ m.name }}{{ data.riskSummaryOf(m.id).hasRisk ? ` · ⚠️${data.riskSummaryOf(m.id).bodyParts.join('/')}风险` : '' }}
            </option>
          </select>
        </div>
        <div v-if="risk" class="risk-overview">
          <template v-if="risk.hasRisk">
            <b class="danger-text">⚠️ {{ risk.bodyParts.join('、') }} · {{ risk.level }}（{{ risk.count }} 张限制卡）</b>
            <div class="muted">禁忌：{{ risk.list.flatMap(r => r.pairs.map(p => p.forbidden)).join('、') }}</div>
          </template>
          <template v-else>该会员暂无风险动作限制，可正常选课。</template>
        </div>
      </div>
    </div>

    <template v-if="memberId">
      <!-- 该会员的风险档案 -->
      <div v-if="risk?.hasRisk" class="card">
        <h3>会员风险动作限制（教练专业记录）</h3>
        <RiskRestrictionCard :member-id="memberId" />
      </div>

      <!-- 低强度推荐 -->
      <div ref="safeRef" class="card safe-card">
        <h3>🌿 推荐选择的低强度课程（已避开该会员全部禁忌体式）</h3>
        <div v-if="safePicks.length" class="grid cols-2">
          <div v-for="c in safePicks" :key="c.id" class="class-mini">
            <b>{{ c.name }}</b>
            <div class="muted">{{ c.date }}（{{ weekdayCn(c.date) }}）{{ c.time }} · {{ data.coachById(c.coachId)?.name }}</div>
            <div class="row mt8">
              <button class="small" @click="quickBook(c.id)" :disabled="full(c.id) || data.classMemberBooked(c.id, memberId)">
                {{ data.classMemberBooked(c.id, memberId) ? '已报名' : full(c.id) ? '已满员' : '报名此课' }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty">近期暂无排期的低强度课程，可建议会员等待新课或选择私教调整</div>
      </div>

      <!-- 已报团课 -->
      <div v-if="myBookings.length" class="card">
        <h3>{{ member?.name }} 已报名的团课</h3>
        <div v-for="{ b, gc } in myBookings" :key="b.id" class="between booked-row">
          <div>
            <b>{{ gc!.name }}</b>
            <span class="tag" :class="intensityClass[gc!.intensity]">{{ gc!.intensity }}</span>
            <span v-if="hitsOf(gc!.id).length" class="tag danger">⚠️ 已做风险告知</span>
            <span class="muted">{{ gc!.date }} {{ gc!.time }}</span>
            <div class="muted" style="font-size: 13px">前台建议：{{ b.advisory }}</div>
          </div>
          <button class="small ghost" @click="cancel(b.id)">退订</button>
        </div>
      </div>
    </template>

    <!-- 全部可报团课 -->
    <div class="card">
      <div class="between">
        <h3 style="margin: 0">近期团课（{{ classes.length }}）</h3>
        <button class="small ghost" @click="showCreate = !showCreate">{{ showCreate ? '收起' : '＋ 发布新团课' }}</button>
      </div>

      <div v-if="showCreate" class="create-box">
        <div class="grid cols-3">
          <div class="form-row">
            <label>课程模板</label>
            <select v-model="newClass.template">
              <option v-for="t in GROUP_CLASS_TEMPLATES" :key="t.name" :value="t.name">{{ t.name }}（{{ t.intensity }}）</option>
            </select>
          </div>
          <div class="form-row">
            <label>带课教练</label>
            <select v-model="newClass.coachId">
              <option value="" disabled>选择教练</option>
              <option v-for="c in data.coaches" :key="c.id" :value="c.id">{{ c.name }}（{{ c.specialties.join('/') }}）</option>
            </select>
          </div>
          <div class="form-row">
            <label>日期 / 时间</label>
            <div class="row">
              <input v-model="newClass.date" type="date" style="width: 150px" />
              <select v-model="newClass.time" style="width: 140px">
                <option>10:00-11:00</option><option>19:00-20:00</option><option>20:00-21:00</option>
              </select>
            </div>
          </div>
        </div>
        <button @click="createClass">发布团课</button>
      </div>

      <div v-for="c in classes" :key="c.id" class="class-card" :class="{ risky: memberId && hitsOf(c.id).length }">
        <div class="between">
          <div>
            <b>{{ c.name }}</b>
            <span class="tag" :class="intensityClass[c.intensity]">{{ c.intensity }}</span>
            <span class="muted">{{ c.date }}（{{ weekdayCn(c.date) }}）{{ c.time }} · {{ data.coachById(c.coachId)?.name }} · {{ bookedCount(c.id) }}/{{ c.capacity }} 人</span>
          </div>
          <div v-if="memberId" class="row">
            <template v-if="data.classMemberBooked(c.id, memberId)">
              <span class="tag">已报名</span>
            </template>
            <template v-else-if="full(c.id)">
              <span class="tag gray">已满员</span>
            </template>
            <template v-else-if="hitsOf(c.id).length">
              <button class="small" @click="scrollToSafe">查看低强度推荐 ↑</button>
              <button class="small danger" @click="flowOf(c.id).open = true">会员坚持报名（风险告知）</button>
            </template>
            <template v-else>
              <button class="small" @click="quickBook(c.id)">报名</button>
            </template>
          </div>
        </div>
        <div class="muted mt8" style="font-size: 13px">体式：{{ c.moves.join('、') }}</div>

        <!-- 风险命中提示 -->
        <div v-if="memberId && hitsOf(c.id).length" class="hit-box">
          <div class="danger-text"><b>⚠️ 该会员有 {{ hitsOf(c.id).length }} 项禁忌体式出现在本节课：</b></div>
          <div v-for="(h, i) in hitsOf(c.id)" :key="i" style="font-size: 13px; margin-top: 4px">
            ✕ {{ h.pair.forbidden }} → 建议替代：{{ h.pair.alternative }}
          </div>
          <div class="mt8" style="font-size: 13px"><b>建议：请会员优先选择下方低强度课程；如仍参加，教练课上须避开禁忌体式并准备替代器械。</b></div>
        </div>

        <!-- 坚持报名的风险告知留痕 -->
        <div v-if="memberId && flowOf(c.id).open && !data.classMemberBooked(c.id, memberId)" class="ack-box">
          <div class="form-row">
            <label>前台建议 / 风险告知说明（写入会员训练记录）</label>
            <textarea v-model="flowOf(c.id).advisory" :placeholder="defaultAdvisory(c.id, hitsOf(c.id))"></textarea>
            <button class="small ghost mt8" @click="flowOf(c.id).advisory = defaultAdvisory(c.id, hitsOf(c.id))">套用建议话术</button>
          </div>
          <label class="ack-line">
            <input type="checkbox" v-model="flowOf(c.id).acknowledged" style="width: auto" />
            已当面向会员说明风险、建议低强度课程，会员知晓并仍选择报名
          </label>
          <div class="row mt8" style="justify-content: flex-end">
            <button class="ghost small" @click="flowOf(c.id).open = false">取消</button>
            <button class="danger small" @click="book(c.id, true)">确认风险告知并报名</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.risk-overview { align-self: end; font-size: 14px; }
.danger-text { color: var(--danger); }
.safe-card { border-color: var(--sage); background: #f6faf7; }
.class-mini { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: #fff; }
.booked-row { border-bottom: 1px solid var(--line); padding: 10px 0; }
.create-box { border: 1px dashed var(--sage); border-radius: 10px; padding: 12px 14px; margin: 12px 0; background: #fffdf9; }
.class-card { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-top: 10px; background: #fff; }
.class-card.risky { border-color: #ecc9be; background: var(--danger-soft); }
.hit-box { margin-top: 10px; background: #fff; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0d7cf; }
.ack-box { margin-top: 10px; background: #fff; border-radius: 10px; padding: 12px; border: 1px dashed var(--danger); }
.ack-line { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--danger); }
</style>
