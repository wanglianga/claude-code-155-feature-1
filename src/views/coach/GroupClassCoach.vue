<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDataStore, type RiskHit } from '../../stores/data'
import RiskConfirmDialog from '../../components/RiskConfirmDialog.vue'
import { weekdayCn } from '../../utils/date'

const route = useRoute()
const router = useRouter()
const data = useDataStore()

const gc = computed(() => data.classById(route.params.id as string))

interface AttendeeRow {
  bookingId: string
  memberId: string
  name: string
  hits: RiskHit[]
  hasRisk: boolean
  prepared: boolean
}

const attendees = computed<AttendeeRow[]>(() => {
  if (!gc.value) return []
  return data.classBookings(gc.value.id).map(b => {
    const hits = data.matchMemberMoves(b.memberId, gc.value!.moves)
    return {
      bookingId: b.id, memberId: b.memberId, name: data.nameOf(b.memberId),
      hits, hasRisk: data.riskSummaryOf(b.memberId).hasRisk,
      prepared: prepared[b.id] ?? false,
    }
  })
})

// 现场核对：已为该会员准备替代方案/器械（仅本次演示态）
const prepared = reactive<Record<string, boolean>>({})
const openId = ref<string | null>(null)

const confirmState = reactive({ open: false, memberId: '', defaultMove: '' })

function openConfirm(memberId: string, move?: string) {
  confirmState.open = true
  confirmState.memberId = memberId
  confirmState.defaultMove = move ?? ''
}

function neededEquipment(memberId: string) {
  return data.riskSummaryOf(memberId).equipment
}
</script>

<template>
  <div class="page" v-if="gc">
    <button class="ghost small" @click="router.push('/coach')">← 返回周课表</button>
    <h2 class="page-title mt8">{{ gc.name }} · 课前核对</h2>
    <p class="page-sub">
      {{ gc.date }}（{{ weekdayCn(gc.date) }}）{{ gc.time }} · {{ gc.intensity }} ·
      {{ attendees.length }}/{{ gc.capacity }} 人 · 带课教练 {{ data.coachById(gc.coachId)?.name }}
    </p>

    <div class="card">
      <h3>本节团课体式与器械</h3>
      <div><b>体式：</b>{{ gc.moves.join('、') }}</div>
      <div class="mt8"><b>常规器械：</b>{{ gc.equipment.join('、') }}</div>
      <div class="muted mt8">{{ gc.note }}</div>
    </div>

    <div class="card">
      <h3>报名会员风险核对（{{ attendees.filter(a => a.hits.length).length }} 人命中禁忌）</h3>
      <p class="muted">命中禁忌的会员，开课前请逐一告知替代动作、准备替代器械；会员若坚持原动作，请登记二次确认。</p>

      <div v-for="a in attendees" :key="a.bookingId" class="attendee" :class="{ risky: a.hits.length }">
        <div class="between">
          <div>
            <b>{{ a.name }}</b>
            <span v-if="a.hits.length" class="tag danger">⚠️ 命中 {{ a.hits.length }} 项禁忌</span>
            <span v-else-if="a.hasRisk" class="tag amber">有风险限制（本课未命中）</span>
            <span v-else class="tag">无风险限制</span>
          </div>
          <div class="row">
            <button class="small ghost" @click="openId = openId === a.bookingId ? null : a.bookingId">
              {{ openId === a.bookingId ? '收起' : '查看限制与替代方案' }}
            </button>
            <button v-if="a.hits.length" class="small danger" @click="openConfirm(a.memberId, a.hits[0].pair.forbidden)">
              坚持高难体式？二次确认
            </button>
          </div>
        </div>

        <div v-if="a.hits.length" class="hit-lines">
          <div v-for="(h, i) in a.hits" :key="i">
            ✕ {{ h.pair.forbidden }} <span class="muted">（本课：{{ h.move }}）</span>
            → <span class="alt">✓ {{ h.pair.alternative }}</span>
          </div>
        </div>

        <div v-if="openId === a.bookingId">
          <div class="risk-detail">
            <div v-if="neededEquipment(a.memberId).length" class="mt8">
              <b>请提前准备替代器械：</b>{{ neededEquipment(a.memberId).join('、') }}
            </div>
            <div v-for="r in data.restrictionsOf(a.memberId)" :key="r.id" class="mt8">
              <div class="muted">{{ r.bodyPart }} · {{ r.level }}（{{ data.coachById(r.coachId)?.name }} 标记）</div>
              <div style="color: #7c3a28; font-size: 13px">{{ r.generalNotice }}</div>
              <div class="muted" style="font-size: 13px">辅助：{{ r.assists.join('；') }}</div>
            </div>
          </div>
          <label class="prep-check" v-if="a.hits.length">
            <input type="checkbox" v-model="prepared[a.bookingId]" style="width: auto" />
            已为该会员准备好替代器械，并沟通替代动作与辅助方式
          </label>
        </div>
      </div>

      <div v-if="!attendees.length" class="empty">暂无会员报名</div>
    </div>

    <RiskConfirmDialog
      :open="confirmState.open"
      :member-id="confirmState.memberId"
      :group-class-id="gc.id"
      :default-move="confirmState.defaultMove"
      @close="confirmState.open = false"
    />
  </div>
  <div v-else class="page"><div class="empty">团课不存在</div></div>
</template>

<style scoped>
.attendee { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; background: #fff; }
.attendee.risky { border-color: #ecc9be; background: var(--danger-soft); }
.hit-lines { font-size: 13px; margin-top: 8px; display: grid; gap: 4px; color: var(--danger); }
.alt { color: var(--sage-deep); font-weight: 600; }
.risk-detail { background: #fff; border-radius: 10px; padding: 10px 12px; margin-top: 8px; font-size: 13px; }
.prep-check { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; color: var(--ink); }
</style>
