<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDataStore } from '../../stores/data'
import type { RestrictionDraft } from '../../types'
import TagInput from '../../components/TagInput.vue'
import RiskRestrictionCard from '../../components/RiskRestrictionCard.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const data = useDataStore()

const booking = computed(() => data.bookings.find(b => b.id === (route.params.bookingId as string)))
const member = computed(() => booking.value ? data.accountById(booking.value.memberId) : undefined)
const existing = computed(() => booking.value ? data.assessments.find(a => a.bookingId === booking.value!.id) : undefined)

const form = reactive({
  posture: '',
  movementLimits: '',
  courseAdvice: '',
  riskNotice: '',
  recommendedPackage: '私教 16 节 · 综合提升（有效期 90 天）',
})

// ---- 风险动作限制：体验课中发现不适时逐部位标记（至少支持一个部位） ----
interface RestrictionRow extends RestrictionDraft {}
function emptyRow(bodyPart = ''): RestrictionRow {
  return {
    bodyPart,
    forbiddenMoves: [],
    alternativeMoves: [],
    alternativeEquipment: [],
    assistActions: [],
    reason: '',
  }
}
// 预填会员预约时填写的首个疼痛部位，方便教练直接标记
const rows = reactive<RestrictionRow[]>([emptyRow(booking.value?.pains[0]?.part ?? '')])

function addRow() { rows.push(emptyRow()) }
function removeRow(i: number) { rows.splice(i, 1) }

function validRows(): RestrictionRow[] {
  return rows.filter(r => r.bodyPart.trim() && r.forbiddenMoves.length)
}

function submit() {
  const b = booking.value
  if (!b) return
  for (const k of ['posture', 'movementLimits', 'courseAdvice', 'riskNotice'] as const) {
    if (!form[k].trim()) { alert('体态评估、动作限制、课程建议、风险提示均为必填'); return }
  }
  const picked = validRows()
  for (const r of rows) {
    if ((r.bodyPart.trim() && !r.forbiddenMoves.length) || (!r.bodyPart.trim() && r.forbiddenMoves.length)) {
      alert('风险动作限制需同时填写「受限部位」和至少一个「禁止动作」；如无限制请清空该行')
      return
    }
  }
  const msg = picked.length
    ? `提交后测评将签名锁定，并为 ${picked.map(r => r.bodyPart).join('、')} 生成风险动作限制，后续排课与团课报名会自动提醒其他教练/前台避开。确认提交？`
    : '提交后测评将签名锁定，顾问端只读不可修改。本次未标记风险动作限制。确认提交？'
  if (!confirm(msg)) return
  data.submitAssessment(b.id, auth.current!.id, { ...form }, picked)
  router.push('/coach')
}
</script>

<template>
  <div class="page" v-if="booking">
    <h2 class="page-title">体验课测评 · {{ member?.name }}</h2>
    <p class="page-sub">测评提交后即签名锁定：顾问可据此跟进，但专业内容不会被简化成销售话术。</p>

    <div class="grid cols-2">
      <div class="card">
        <h3>会员预约信息</h3>
        <dl class="kv">
          <dt>运动基础</dt><dd>{{ booking.fitnessBase }}</dd>
          <dt>身体疼痛</dt><dd>{{ booking.pains.map(p => `${p.part} ${p.level}分（${p.note}）`).join('；') || '无' }}</dd>
          <dt>柔韧性</dt><dd>{{ booking.flexibility }}</dd>
          <dt>训练目标</dt><dd>{{ booking.goals.join('、') }}<span v-if="booking.goalNote">（{{ booking.goalNote }}）</span></dd>
          <dt>预算</dt><dd>{{ booking.budget }}</dd>
        </dl>
      </div>

      <div v-if="existing" class="card">
        <h3>测评已提交（锁定）</h3>
        <dl class="kv">
          <dt>体态评估</dt><dd>{{ existing.posture }}</dd>
          <dt>动作限制</dt><dd>{{ existing.movementLimits }}</dd>
          <dt>课程建议</dt><dd>{{ existing.courseAdvice }}</dd>
          <dt>风险提示</dt><dd style="color: var(--danger)">{{ existing.riskNotice }}</dd>
          <dt>推荐套餐</dt><dd>{{ existing.recommendedPackage }}</dd>
          <dt>签署时间</dt><dd>{{ existing.coachSignedAt }}</dd>
        </dl>
        <RiskRestrictionCard :member-id="booking.memberId" class="mt16" />
      </div>

      <div v-else class="card span2">
        <h3>填写测评（教练专业档案）</h3>
        <div class="grid cols-2">
          <div class="form-row">
            <label>体态评估 *</label>
            <textarea v-model="form.posture" placeholder="如：骨盆轻度前倾，胸椎活动度不足，前屈手尖离地 18cm"></textarea>
          </div>
          <div class="form-row">
            <label>动作限制 *（文字总结）</label>
            <textarea v-model="form.movementLimits" placeholder="如：避免深度后弯；犁式、轮式暂不建议"></textarea>
          </div>
          <div class="form-row">
            <label>课程建议 *</label>
            <textarea v-model="form.courseAdvice" placeholder="如：以阴瑜伽为主，每周 1-2 节，8 周后复测"></textarea>
          </div>
          <div class="form-row">
            <label>风险提示 *（医疗边界声明）</label>
            <textarea v-model="form.riskNotice" placeholder="如：若出现下肢放射痛或麻木，请立即停止练习并就医；课程不能替代医疗诊断"></textarea>
          </div>
        </div>
        <div class="form-row">
          <label>推荐套餐</label>
          <input v-model="form.recommendedPackage" />
        </div>

        <!-- ===== 运动风险动作限制（结构化，全队共享） ===== -->
        <div class="risk-edit">
          <div class="between">
            <h3 style="margin: 0">运动风险动作限制</h3>
            <button type="button" class="small ghost" @click="addRow">+ 增加受限部位</button>
          </div>
          <p class="muted">体验课中发现某部位不适时，在此标记 <b>禁止动作</b> 与 <b>替代动作</b>，并填写替代器械与辅助动作。
            提交后将在会员维度生效：其他教练排课、课前准备与前台团课报名都会自动看到提醒。</p>

          <div v-for="(r, i) in rows" :key="i" class="risk-row">
            <div class="between">
              <b>受限部位 {{ i + 1 }}</b>
              <button v-if="rows.length > 1" type="button" class="small ghost danger-txt" @click="removeRow(i)">删除该部位</button>
            </div>
            <div class="grid cols-2">
              <div class="form-row">
                <label>受限/不适部位 *（如 腰椎、右膝）</label>
                <input v-model="r.bodyPart" list="body-parts" placeholder="腰椎" />
                <datalist id="body-parts">
                  <option v-for="p in ['腰椎','颈椎','肩颈','肩部','手腕','髋部','左膝','右膝','踝部']" :key="p" :value="p" />
                </datalist>
              </div>
              <div class="form-row">
                <label>标记原因 / 课中表现</label>
                <input v-model="r.reason" placeholder="如：前屈时腰椎酸胀 4/10，久坐后腰酸" />
              </div>
            </div>
            <div class="form-row">
              <label>禁止动作（高风险体式）* —— 回车或顿号添加</label>
              <TagInput v-model="r.forbiddenMoves"
                :quick="['轮式（深度后弯）','犁式','长时间坐立前屈','跑跳 / 波比跳','深度屈膝（>90°）静蹲','莲花式','站立深度前屈触地']"
                placeholder="如：轮式、犁式、深度后弯" />
            </div>
            <div class="form-row">
              <label>替代动作（降阶/低风险体式）</label>
              <TagInput v-model="r.alternativeMoves"
                :quick="['婴儿式','猫牛式','仰卧脊柱扭转','抱枕支撑桥式','靠墙倒箭式','靠墙浅蹲（≤60°）','直腿抬高']"
                placeholder="如：婴儿式、猫牛式、抱枕支撑桥式" />
            </div>
            <div class="grid cols-2">
              <div class="form-row">
                <label>替代器械（排课时提醒教练准备）</label>
                <TagInput v-model="r.alternativeEquipment"
                  :quick="['瑜伽抱枕','瑜伽砖 ×2','瑜伽毯','弹力带','泡沫轴','平衡垫']"
                  placeholder="如：瑜伽抱枕、瑜伽砖、瑜伽毯" />
              </div>
              <div class="form-row">
                <label>辅助动作 / 保护手法</label>
                <TagInput v-model="r.assistActions"
                  :quick="['腰下卷毛毯支撑','前屈屈膝手下垫砖','旁侧保护防膝内扣','后弯只到胸椎段']"
                  placeholder="如：腰下卷毛毯支撑保持生理曲度" />
              </div>
            </div>
          </div>
        </div>

        <button @click="submit">签名并提交测评</button>
      </div>
    </div>
  </div>
  <div v-else class="page"><div class="empty">预约不存在</div></div>
</template>

<style scoped>
.span2 { grid-column: 1 / -1; }
.risk-edit { border: 1px solid #ecc9be; background: #fffaf8; border-radius: 12px; padding: 14px 16px; margin: 8px 0 18px; }
.risk-row { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-top: 12px; background: #fff; }
.danger-txt { color: var(--danger); border-color: #ecc9be; }
</style>
