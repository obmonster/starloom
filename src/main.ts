import App from './App.vue'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import './style.css'

createApp(App).use(createPinia()).mount('#app')
