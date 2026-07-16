<template>
  <main class="connect-shell">
    <section class="connect-card">
      <div class="brand-mark brand-mark--large">✦</div>
      <p class="eyebrow">NATIVE GITHUB LISTS, BATCHED</p>
      <h1>批量整理 GitHub<br />原生 Lists</h1>
      <p class="connect-card__intro">
        Starloom 同步 Stars 与原生 Lists，在本地预览批量分类结果，并在确认后通过 GitHub
        GraphQL API 安全写回。
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
        <span>Token 需要允许读取 Stars 与 Lists；修改 Lists 或执行 Unstar 时还需要对应写权限。</span>
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
