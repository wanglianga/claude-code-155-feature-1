<script setup lang="ts">
/**
 * 标签输入：回车 / 顿号 / 逗号即落成一个标签。
 * 用于风险动作限制里的「禁止动作 / 替代动作 / 替代器械 / 辅助动作」录入。
 */
const model = defineModel<string[]>({ required: true })

const props = defineProps<{
  placeholder?: string
  quick?: string[]          // 快捷可选标签
}>()

function add(raw: string) {
  const v = raw.trim()
  if (!v) return
  if (!model.value!.includes(v)) model.value!.push(v)
}

function onInput(e: KeyboardEvent | InputEvent) {
  const el = e.target as HTMLInputElement
  const v = el.value
  if (/[、,，\n]$/.test(v) || (e instanceof KeyboardEvent && e.key === 'Enter')) {
    const parts = v.split(/[、,，\n]/).map(s => s.trim()).filter(Boolean)
    parts.forEach(add)
    el.value = ''
  }
}

function commit(e: Event) {
  const el = e.target as HTMLInputElement
  add(el.value)
  el.value = ''
}

function remove(tag: string) {
  const i = model.value!.indexOf(tag)
  if (i >= 0) model.value!.splice(i, 1)
}

function toggleQuick(tag: string) {
  if (model.value!.includes(tag)) remove(tag)
  else add(tag)
}
</script>

<template>
  <div class="tag-input">
    <span v-for="t in model" :key="t" class="chip">
      {{ t }}<button type="button" class="x" @click="remove(t)">×</button>
    </span>
    <input
      :placeholder="model.length ? '' : (placeholder ?? '输入后回车')"
      @keydown="onInput" @input="onInput" @blur="commit"
    />
    <div v-if="quick && quick.length" class="quick">
      <button type="button" class="mini" v-for="q in quick" :key="q"
        :class="{ on: model.includes(q) }" @click="toggleQuick(q)">+ {{ q }}</button>
    </div>
  </div>
</template>

<style scoped>
.tag-input {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  border: 1px solid var(--line); border-radius: 10px; padding: 6px 8px; background: #fff;
}
.tag-input:focus-within { outline: 2px solid var(--sage-soft); border-color: var(--sage); }
.tag-input input { border: none; outline: none; flex: 1; min-width: 140px; width: auto; padding: 2px 4px; }
.chip {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--danger-soft); color: var(--danger);
  border-radius: 999px; padding: 2px 8px; font-size: 13px; white-space: nowrap;
}
.chip .x {
  border: none; background: transparent; color: inherit; padding: 0 0 0 2px;
  font-size: 14px; line-height: 1; cursor: pointer;
}
.quick { width: 100%; display: flex; flex-wrap: wrap; gap: 6px; }
.mini {
  border: 1px dashed var(--line); background: #fff; color: var(--muted);
  border-radius: 999px; padding: 1px 10px; font-size: 12px;
}
.mini.on { background: var(--sage-soft); border-color: var(--sage); color: var(--sage-deep); border-style: solid; }
</style>
