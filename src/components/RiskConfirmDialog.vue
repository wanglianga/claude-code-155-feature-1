<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useDataStore } from '../stores/data'
import type { RiskDecision } from '../types'

/**
 * 高难体式二次确认登记弹窗。
 * 会员坚持挑战风险限制内的体式时，教练必须再次告知风险，
 * 并记录「调整为替代方案 / 拒绝该动作 / 坚持完成（已告知风险）」。
 */
const props = defineProps<{
  open: boolean
  memberId: string
  sessionId?: string
  groupClassId?: string
  defaultMove?: string
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const auth = useAuthStore()
const data = useDataStore()

const form = reactive({
  move: '',
  decision: '调整为替代方案' as RiskDecision,
  adjustedMove: '',
  note: '',
  informed: false,
})

const summary = computed(() => data.riskSummaryOf(props.memberId))
const forbiddenOptions = computed(() =>
  Array.from(new Set(summary.value.list.flatMap(r => r.pairs.map(p => p.forbidden)))),
)

watch(() => props.open, (v) => {
  if (v) {
    form.move = props.defaultMove ?? forbiddenOptions.value[0] ?? ''
    form.decision = '调整为替代方案'
    form.adjustedMove = ''
    form.note = ''
    form.informed = false
  }
})

watch(() => form.move, (m) => {
  const pair = summary.value.list.flatMap(r => r.pairs).find(p => p.forbidden === m)
  if (pair) form.adjustedMove = pair.alternative
})

function save() {
  if (!form.move.trim()) { alert('请填写会员想挑战的体式'); return }
  if (!form.informed) { alert('请先勾选「已当面向会员说明风险并确认其知晓」'); return }
  if (form.decision === '调整为替代方案' && !form.adjustedMove.trim()) { alert('请填写调整后的替代方案'); return }
  if (!form.note.trim()) { alert('请填写沟通与处理说明（留痕要求）'); return }
  data.recordRiskConfirmation({
    memberId: props.memberId,
    coachId: auth.current!.id,
    sessionId: props.sessionId,
    groupClassId: props.groupClassId,
    move: form.move.trim(),
    decision: form.decision,
    adjustedMove: form.decision === '调整为替代方案' ? form.adjustedMove.trim() : undefined,
    note: form.note.trim(),
    informed: form.informed,
  }, auth.current!.name)
  emit('saved')
  emit('close')
}
</script>

<template>
  <div v-if="open" class="modal-mask" @click.self="emit('close')">
    <div class="modal card">
      <h3 style="margin-top: 0">⚠️ 高难体式风险二次确认 · {{ data.nameOf(memberId) }}</h3>
      <p class="muted">会员坚持挑战风险限制内的体式时，必须再次告知风险并记录处理方案。</p>

      <div v-if="summary.hasRisk" class="banner danger" style="margin-bottom: 12px">
        当前{{ summary.bodyParts.join('、') }}限制生效中：
        {{ summary.list.flatMap(r => r.pairs.map(p => p.forbidden)).join('、') }}
      </div>

      <div class="form-row">
        <label>会员想挑战的体式 *</label>
        <input v-model="form.move" list="risk-confirm-moves" placeholder="选择或填写体式名" />
        <datalist id="risk-confirm-moves">
          <option v-for="m in forbiddenOptions" :key="m" :value="m" />
        </datalist>
      </div>

      <div class="form-row">
        <label>处理决定 *</label>
        <div class="checks">
          <label :class="{ on: form.decision === '调整为替代方案' }">
            <input type="radio" value="调整为替代方案" v-model="form.decision" />调整为替代方案
          </label>
          <label :class="{ on: form.decision === '拒绝该动作' }">
            <input type="radio" value="拒绝该动作" v-model="form.decision" />拒绝该动作
          </label>
          <label :class="{ on: form.decision === '坚持完成（已告知风险）' }">
            <input type="radio" value="坚持完成（已告知风险）" v-model="form.decision" />坚持完成（已告知风险）
          </label>
        </div>
      </div>

      <div v-if="form.decision === '调整为替代方案'" class="form-row">
        <label>调整后的替代方案 *</label>
        <input v-model="form.adjustedMove" placeholder="如：高位弓步（扶瑜伽椅）" />
      </div>

      <div class="form-row">
        <label>沟通与处理说明 *</label>
        <textarea v-model="form.note" placeholder="如：当场再次说明右膝风险，会员理解并接受调整，约定疼痛降到 2 分内再加大幅度"></textarea>
      </div>

      <label class="ack-line">
        <input type="checkbox" v-model="form.informed" style="width: auto" />
        已当面向会员说明风险并确认其知晓（教练专业责任留痕）*
      </label>

      <div class="row mt16" style="justify-content: flex-end">
        <button class="ghost" @click="emit('close')">取消</button>
        <button class="danger" @click="save">保存确认记录</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: fixed; inset: 0; background: rgba(46, 42, 38, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px;
}
.modal { width: 640px; max-width: 100%; max-height: 90vh; overflow: auto; margin: 0; }
.ack-line { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--danger); margin: 0; }
</style>
