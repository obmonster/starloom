<template>
  <main class="connect-shell">
    <section class="connect-card">
      <div class="brand-mark brand-mark--large">✦</div>
      <p class="eyebrow">LOCAL-FIRST STAR MANAGER</p>
      <h1>把散落的 Stars<br />编织成你的知识库</h1>
      <p class="connect-card__intro">
        Starloom 从 GitHub 同步收藏，在浏览器本地完成批量分组、标签和清理。你的 Token
        不会离开这台设备。
      </p>

      <form class="token-form" @submit.prevent="handleSubmit">
        <label for="github-token">GitHub Personal Access Token</label>
        <div class="token-form__row">
          <input
            id="github-token"
            v-model="token"
            required
            autocomplete="off"
            placeholder="github_pat_... 或 ghp_..."
            type="password"
          />
          <button class="button button--primary" type="submit" :disabled="loading">
            {{ loading ? '连接中…' : '连接 GitHub' }}
          </button>
        </div>
        <p v-if="error" class="form-error">{{ error }}</p>
      </form>

      <div class="permission-note">
        <strong>建议使用最小权限 Token</strong>
        <span>读取 Stars 即可同步；执行批量 Unstar 时需要允许修改 Star 状态。</span>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  loading: boolean
  error: string
}>()

const emit = defineEmits<{
  connect: [token: string]
}>()

const token = ref('')

const handleSubmit = () => emit('connect', token.value)
</script>
