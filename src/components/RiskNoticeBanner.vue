<script setup lang="ts">
import { computed } from 'vue'
import { useDataStore } from '../stores/data'

/**
 * 会员风险动作限制提示卡。
 * - 排课/上课页：展示禁忌部位、需要准备的替代器械与辅助动作；
 * - 团课报名/现场：由父组件通过 hits 传入本节课命中的具体体式。
 */
const props = defineProps<{
  memberId: string
  hits?: { pair: { forbidden: string; alternative: string; reason: string }; move: string }[]
  showPrep?: boolean       // 是否展示替代器械/辅助动作准备清单
  title?: string
}>()
const data = useDataStore()

const summary = computed(() => data.riskSummaryOf(props.memberId))
</script>

<template>
  <div v-if="summary.hasRisk" class="risk-box">
    <div class="risk-head">
      ⚠️ 运动风险动作限制
      <span class="tag danger">{{ summary.level }}</span>
      <span v-for="p in summary.bodyParts" :key="p" class="tag clay">{{ p }}禁忌</span>
    </div>

    <div v-if="hits && hits.length" class="risk-hits">
      <div v-for="(h, i) in hits" :key="i" class="hit-row">
        <div><b class="risk-no">✕ {{ h.pair.forbidden }}</b><span class="muted">（本课体式：{{ h.move }}）</span></div>
        <div class="risk-yes">✓ 替代：{{ h.pair.alternative }}</div>
        <div class="muted">{{ h.pair.reason }}</div>
      </div>
    </div>

    <div v-else-if="title" class="risk-title">{{ title }}</div>

    <ul v-if="showPrep" class="prep-list">
      <li v-if="summary.equipment.length">
        <b>请提前准备替代器械：</b>{{ summary.equipment.join('、') }}
      </li>
      <li v-if="summary.assists.length">
        <b>辅助动作/保护要点：</b>{{ summary.assists.join('；') }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.risk-box {
  border: 1px solid #ecc9be;
  background: var(--danger-soft);
  border-radius: var(--radius);
  padding: 12px 16px;
  margin-bottom: 16px;
}
.risk-head { font-weight: 700; color: var(--danger); font-size: 14px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.risk-hits { margin-top: 8px; display: grid; gap: 8px; }
.hit-row { background: #fff; border-radius: 10px; padding: 8px 12px; font-size: 13px; border: 1px solid #f0d7cf; }
.risk-no { color: var(--danger); }
.risk-yes { color: var(--sage-deep); font-weight: 600; }
.risk-title { margin-top: 6px; font-size: 13px; color: #7c3a28; }
.prep-list { margin: 8px 0 0; padding-left: 18px; font-size: 13px; color: #7c3a28; display: grid; gap: 4px; }
</style>
