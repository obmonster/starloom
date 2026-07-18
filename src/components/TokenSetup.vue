<template>
  <div class="connect-shell">
    <div class="connect-card">
      <div class="connect-card__identity">
        <span class="brand-mark">
          <ElIcon>
            <StarFilled />
          </ElIcon>
        </span>
        <span>Starloom</span>
      </div>

      <div class="connect-card__content">
        <div class="connect-card__heading">
          <div class="connect-card__title">连接 GitHub</div>
          <ElSwitch
            v-model="darkMode"
            inline-prompt
            aria-label="切换深色或浅色主题"
            active-text="暗"
            inactive-text="亮"
            :active-action-icon="Moon"
            :inactive-action-icon="Sunny"
          />
        </div>
        <ElForm
          class="token-form"
          label-position="top"
          @submit.prevent="handleSubmit"
        >
          <ElFormItem label="Personal Access Token">
            <ElInput
              v-model="token"
              show-password
              size="large"
              type="password"
              placeholder="github_pat_... 或 ghp_..."
              autocomplete="off"
            />
          </ElFormItem>
          <ElButton
            size="large"
            type="primary"
            class="w-full"
            native-type="submit"
            :loading="loading"
          >连接</ElButton>
          <ElAlert
            v-if="error"
            show-icon
            type="error"
            :title="error"
            :closable="false"
          />
        </ElForm>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Moon, StarFilled, Sunny } from '@element-plus/icons-vue'

const darkMode = defineModel<boolean>('darkMode', { required: true })

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
