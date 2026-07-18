<template>
  <div
    v-loading.fullscreen.lock="initializing"
    class="login-view"
    element-loading-text="正在加载"
  >
    <TokenSetup
      v-if="!initializing"
      v-model:dark-mode="darkMode"
      :error="error"
      :loading="loading"
      @connect="handleConnect"
    />
  </div>
</template>

<script setup lang="ts">
import TokenSetup from '../components/TokenSetup.vue'

import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useStarStore } from '../stores/starStore'

const darkMode = defineModel<boolean>('darkMode', { required: true })

const initializing = ref(true)
const router = useRouter()
const store = useStarStore()
const { loading, error } = storeToRefs(store)

onMounted(async () => {
  try {
    await store.initialize()
  } finally {
    initializing.value = false
  }
})

const handleConnect = async (token: string) => {
  try {
    await store.connect(token)
    await router.replace({ name: 'home' })
    await store.syncRepositories()
  } catch {
    return
  }
}
</script>
