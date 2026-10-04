<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  ASSIST_OPTIONS, EQUIPMENT_OPTIONS, findMoveTemplate, MOVE_LIBRARY,
} from '../data/catalog'
import type { RiskMovePair } from '../types'

/**
 * 风险动作限制编辑器：测评页（随测评签名提交）与会员档案复评共用。
 * 父组件通过 ref 调用 validate() / getData() / reset()。
 */
const emit = defineEmits<{ (e: 'data-change'): void }>()

const props = defineProps<{ initialBodyPart?: string }>()

const bodyParts = ['腰椎', '右膝', '左膝', '肩颈', '手腕', '髋部', '踝部']

const form = reactive({
  bodyPart: props.initialBodyPart || '腰椎',
  level: '高风险' as '高风险' | '中风险',
  generalNotice: '',
})

const pairs = ref<RiskMovePair[]>([{ forbidden: '', alternative: '', reason: '' }])
const equipment = ref<string[]>([])
const assists = ref<string[]>([])
const customAssist = ref('')

function addPair(prefill?: RiskMovePair) {
  pairs.value.push(prefill ?? { forbidden: '', alternative: '', reason: '' })
}

function removePair(i: number) {
  if (pairs.value.length === 1) {
    pairs.value[0] = { forbidden: '', alternative: '', reason: '' }
    return
  }
  pairs.value.splice(i, 1)
}

/** 从体式库选择 → 自动带出替代动作、原因、器械与辅助建议 */
function onForbidden(i: number) {
  const tpl = findMoveTemplate(pairs.value[i].forbidden)
  if (!tpl) return
  pairs.value[i] = { forbidden: tpl.name, alternative: tpl.defaultAlternative, reason: tpl.reason }
  tpl.suggestEquipment.forEach(e => { if (!equipment.value.includes(e)) equipment.value.push(e) })
  if (!assists.value.includes(tpl.suggestAssist)) assists.value.push(tpl.suggestAssist)
  emit('data-change')
}

function addFromTemplate(name: string) {
  const tpl = MOVE_LIBRARY.find(m => m.name === name)
  if (!tpl) return
  if (pairs.value.some(p => p.forbidden === tpl.name)) return
  if (!pairs.value[0].forbidden) pairs.value.splice(0, 1)
  addPair({ forbidden: tpl.name, alternative: tpl.defaultAlternative, reason: tpl.reason })
  tpl.suggestEquipment.forEach(e => { if (!equipment.value.includes(e)) equipment.value.push(e) })
  if (!assists.value.includes(tpl.suggestAssist)) assists.value.push(tpl.suggestAssist)
}

function addCustomAssist() {
  const v = customAssist.value.trim()
  if (v && !assists.value.includes(v)) assists.value.push(v)
  customAssist.value = ''
}

/** 按当前受限部位过滤体式库（匹配不上时显示全部） */
const filteredLibrary = computed(() => {
  const part = form.bodyPart.trim()
  if (!part) return MOVE_LIBRARY
  const exact = MOVE_LIBRARY.filter(m => m.bodyPart.includes(part) || part.includes(m.bodyPart))
  return exact.length ? exact : MOVE_LIBRARY
})

function validate(): string | null {
  const valid = pairs.value.filter(p => p.forbidden.trim() && p.alternative.trim())
  if (!valid.length) return '请至少填写一组「禁止动作 + 替代动作」'
  if (pairs.value.some(p => (p.forbidden.trim() && !p.alternative.trim()) || (!p.forbidden.trim() && p.alternative.trim()))) {
    return '每组限制都需要同时填写禁止动作与替代动作'
  }
  if (!form.generalNotice.trim()) return '请填写总体风险提示（医疗边界声明）'
  return null
}

function getData() {
  return {
    bodyPart: form.bodyPart,
    level: form.level,
    pairs: pairs.value.filter(p => p.forbidden.trim() && p.alternative.trim()),
    equipment: [...equipment.value],
    assists: [...assists.value],
    generalNotice: form.generalNotice.trim(),
  }
}

function reset() {
  form.bodyPart = props.initialBodyPart || '腰椎'
  form.level = '高风险'
  form.generalNotice = ''
  pairs.value = [{ forbidden: '', alternative: '', reason: '' }]
  equipment.value = []
  assists.value = []
  customAssist.value = ''
}

defineExpose({ validate, getData, reset })
</script>

<template>
  <div class="risk-editor">
    <div class="grid cols-2">
      <div class="form-row">
        <label>受限部位 *</label>
        <input v-model="form.bodyPart" list="body-part-list" placeholder="如：腰椎 / 右膝" />
        <datalist id="body-part-list">
          <option v-for="b in bodyParts" :key="b" :value="b" />
        </datalist>
      </div>
      <div class="form-row">
        <label>风险等级 *</label>
        <select v-model="form.level">
          <option>高风险</option>
          <option>中风险</option>
        </select>
      </div>
    </div>

    <div class="form-row">
      <label>从常用风险体式库添加（自动带出替代动作/器械/辅助建议）</label>
      <select value="" @change="addFromTemplate(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
        <option value="" disabled>选择体式…（已按「{{ form.bodyPart }}」过滤）</option>
        <option v-for="m in filteredLibrary" :key="m.name" :value="m.name">
          【{{ m.bodyPart }}·{{ m.level }}】{{ m.name }} → {{ m.defaultAlternative }}
        </option>
      </select>
    </div>

    <div class="form-row">
      <label>禁止动作 ↔ 替代动作 *（至少一组）</label>
      <div v-for="(p, i) in pairs" :key="i" class="pair-card">
        <div class="pair-row">
          <input v-model="p.forbidden" list="forbidden-list" placeholder="禁止体式，如：深度后弯（轮式）" @change="onForbidden(i)" />
          <span class="arrow">→</span>
          <input v-model="p.alternative" placeholder="替代动作，如：桥式" />
          <button type="button" class="small ghost danger-btn" @click="removePair(i)">删除</button>
        </div>
        <input v-model="p.reason" class="reason-input" placeholder="限制原因（如：骨盆前倾者深度后弯易挤压腰椎）" />
      </div>
      <datalist id="forbidden-list">
        <option v-for="m in MOVE_LIBRARY" :key="m.name" :value="m.name" />
      </datalist>
      <button type="button" class="small ghost" @click="addPair()">＋ 再添加一组</button>
    </div>

    <div class="form-row">
      <label>替代器械（排课时提醒其他教练提前准备）</label>
      <div class="checks">
        <label v-for="e in EQUIPMENT_OPTIONS" :key="e" :class="{ on: equipment.includes(e) }">
          <input type="checkbox" :value="e" v-model="equipment" />{{ e }}
        </label>
      </div>
    </div>

    <div class="form-row">
      <label>辅助动作 / 保护手法建议</label>
      <div class="checks">
        <label v-for="a in ASSIST_OPTIONS" :key="a" :class="{ on: assists.includes(a) }">
          <input type="checkbox" :value="a" v-model="assists" />{{ a }}
        </label>
      </div>
      <div class="row mt8">
        <input v-model="customAssist" placeholder="自定义辅助建议（可选）" style="flex: 1" @keyup.enter="addCustomAssist" />
        <button type="button" class="small ghost" @click="addCustomAssist">添加</button>
      </div>
    </div>

    <div class="form-row">
      <label>总体风险提示 *（医疗边界声明，排课与团课报名均会展示）</label>
      <textarea v-model="form.generalNotice" placeholder="如：若出现下肢放射痛或麻木，请立即停止练习并就医；课程不能替代医疗诊断"></textarea>
    </div>
  </div>
</template>

<style scoped>
.pair-card { border: 1px solid var(--line); border-radius: 10px; padding: 10px; margin-bottom: 8px; background: #fffdf9; }
.pair-row { display: flex; align-items: center; gap: 8px; }
.pair-row input { flex: 1; }
.arrow { color: var(--danger); font-weight: 700; }
.reason-input { margin-top: 8px; }
.danger-btn { color: var(--danger); border-color: var(--danger); }
</style>
