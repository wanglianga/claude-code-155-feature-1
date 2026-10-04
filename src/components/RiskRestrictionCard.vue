<script setup lang="ts">
import { computed } from 'vue'
import { useDataStore } from '../stores/data'
import type { MovementRestriction } from '../types'

/**
 * 风险动作限制卡：所有角色共享同一份限制。
 * - compact：仅部位 + 禁止动作（用于课表/报名行的内嵌提示）
 * - full：含替代动作、替代器械、辅助动作（用于课前准备/会员档案）
 */
const props = withDefaults(defineProps<{
  memberId: string
  variant?: 'compact' | 'full'
  title?: string
}>(), { variant: 'full' })

const data = useDataStore()
const restrictions = computed(() => data.activeRestrictions(props.memberId))
const coachName = (id: string) => data.coachById(id)?.name ?? ''

/** 排课/课前用：去重后的替代器械与辅助动作汇总 */
const equipment = computed(() => [...new Set(restrictions.value.flatMap(r => r.alternativeEquipment))])
const assists = computed(() => [...new Set(restrictions.value.flatMap(r => r.assistActions))])
</script>

<template>
  <div v-if="restrictions.length" class="risk">
    <div v-if="title" class="risk-head">
      ⚠️ {{ title }}
      <span v-for="r in restrictions" :key="r.id" class="tag danger">{{ r.bodyPart }}</span>
    </div>

    <!-- compact：只给禁忌清单 -->
    <template v-if="variant === 'compact'">
      <ul v-for="r in restrictions" :key="r.id" class="forbid">
        <li v-for="m in r.forbiddenMoves" :key="m">🚫 {{ m }}<span class="muted">（{{ r.bodyPart }}）</span></li>
      </ul>
    </template>

    <!-- full：完整替代方案 -->
    <template v-else>
      <div v-for="r in restrictions" :key="r.id" class="block">
        <div class="part">
          <b>{{ r.bodyPart }}</b>
          <span class="muted">由 {{ coachName(r.coachId) }} 于 {{ r.updatedAt.slice(0, 10) }} 标记 · 来源：{{ r.source }}</span>
        </div>
        <div v-if="r.reason" class="reason">{{ r.reason }}</div>
        <div class="cols">
          <div>
            <div class="lbl danger-txt">禁止动作 / 高风险体式</div>
            <span v-for="m in r.forbiddenMoves" :key="m" class="pill forbid-pill">🚫 {{ m }}</span>
          </div>
          <div>
            <div class="lbl safe-txt">替代动作 / 降阶体式</div>
            <span v-for="m in r.alternativeMoves" :key="m" class="pill safe-pill">✅ {{ m }}</span>
            <span v-if="!r.alternativeMoves.length" class="muted">—</span>
          </div>
        </div>
      </div>

      <div v-if="equipment.length" class="prep">
        <span class="lbl">🧰 课前请准备替代器械：</span>
        <span v-for="e in equipment" :key="e" class="pill equip-pill">{{ e }}</span>
      </div>
      <div v-if="assists.length" class="prep">
        <span class="lbl">🤝 辅助动作 / 保护手法：</span>
        <span v-for="a in assists" :key="a" class="pill assist-pill">{{ a }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.risk {
  border: 1px solid #ecc9be; background: var(--danger-soft);
  border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;
}
.risk-head { font-weight: 700; color: var(--danger); font-size: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.block { padding: 8px 0; border-top: 1px dashed #e3c0b4; }
.block:first-of-type { border-top: none; }
.part { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.part .muted { font-size: 12px; }
.reason { font-size: 13px; color: #7c3a28; margin: 4px 0 8px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 720px) { .cols { grid-template-columns: 1fr; } }
.lbl { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
.danger-txt { color: var(--danger); }
.safe-txt { color: var(--sage-deep); }
.pill { display: inline-block; font-size: 12.5px; border-radius: 999px; padding: 2px 10px; margin: 0 6px 6px 0; white-space: nowrap; }
.forbid-pill { background: #fff; color: var(--danger); border: 1px solid #ecc9be; }
.safe-pill { background: var(--sage-soft); color: var(--sage-deep); border: 1px solid #cfe0d5; }
.equip-pill { background: var(--amber-soft); color: var(--amber); border: 1px solid #e8d9b8; }
.assist-pill { background: #eef4f0; color: var(--sage-deep); border: 1px solid #cfe0d5; }
.prep { margin-top: 6px; font-size: 13px; }
ul.forbid { margin: 0; padding-left: 2px; list-style: none; }
ul.forbid li { font-size: 13px; color: #7c3a28; padding: 1px 0; }
</style>
