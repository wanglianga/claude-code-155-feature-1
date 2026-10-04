<script setup lang="ts">
import { computed } from 'vue'
import { useDataStore } from '../stores/data'
import type { RiskRestriction } from '../types'

/**
 * 风险动作限制只读卡（测评锁定档案 / 会员 360° / 会员训练记录共用）。
 * 专业记录：所有角色可见，仅教练可在测评或复评时变更。
 */
const props = defineProps<{ memberId: string; showReleased?: boolean }>()
const data = useDataStore()

const list = computed<RiskRestriction[]>(() => {
  const all = data.restrictions
    .filter(r => r.memberId === props.memberId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return props.showReleased ? all : all.filter(r => r.status === '生效中')
})
</script>

<template>
  <div v-if="list.length" class="risk-list">
    <div v-for="r in list" :key="r.id" class="risk-card" :class="{ released: r.status === '已解除' }">
      <div class="rc-head">
        ⚠️ {{ r.bodyPart }} · {{ r.level }}动作限制
        <span class="tag clay">{{ r.source }}</span>
        <span class="tag danger" v-if="r.status === '生效中'">生效中</span>
        <span class="tag gray" v-else>已解除 {{ r.releasedAt }}</span>
      </div>
      <div class="muted rc-meta">{{ data.coachById(r.coachId)?.name }} 标记于 {{ r.createdAt }}</div>

      <table class="plain rc-table">
        <thead><tr><th style="width: 34%">禁止动作</th><th>替代动作</th><th style="width: 30%">原因</th></tr></thead>
        <tbody>
          <tr v-for="(p, i) in r.pairs" :key="i">
            <td class="forbidden">✕ {{ p.forbidden }}</td>
            <td class="alternative">✓ {{ p.alternative }}</td>
            <td class="muted">{{ p.reason }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="r.equipment.length" class="rc-line"><b>替代器械：</b>{{ r.equipment.join('、') }}</div>
      <div v-if="r.assists.length" class="rc-line"><b>辅助要点：</b>{{ r.assists.join('；') }}</div>
      <div class="rc-line notice">风险提示：{{ r.generalNotice }}</div>
      <div v-if="r.status === '已解除' && r.releaseNote" class="muted">解除说明：{{ r.releaseNote }}</div>
    </div>
  </div>
  <div v-else class="empty">暂无风险动作限制</div>
</template>

<style scoped>
.risk-card {
  border: 1px solid #ecc9be;
  background: var(--danger-soft);
  border-radius: var(--radius);
  padding: 12px 16px;
  margin-bottom: 12px;
}
.risk-card.released { background: #f0ede8; border-color: var(--line); }
.rc-head { font-weight: 700; color: var(--danger); font-size: 14px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.released .rc-head { color: var(--muted); }
.rc-meta { margin: 2px 0 8px; }
.rc-table { background: #fff; border-radius: 10px; overflow: hidden; }
.forbidden { color: var(--danger); font-weight: 600; }
.alternative { color: var(--sage-deep); }
.rc-line { font-size: 13px; margin-top: 6px; }
.rc-line.notice { color: #7c3a28; }
.released .rc-line.notice { color: var(--muted); }
</style>
