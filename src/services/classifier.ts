import type { StarredRepository } from '../types'

export interface ClassificationRule {
  group: string
  color: string
  keywords: string[]
  languages?: string[]
}

export const classificationRules: ClassificationRule[] = [
  {
    group: 'Vue',
    color: '#42b883',
    keywords: ['vue', 'nuxt', 'vitepress'],
    languages: ['Vue']
  },
  {
    group: 'React',
    color: '#61dafb',
    keywords: ['react', 'nextjs', 'next.js'],
    languages: ['JSX', 'TSX']
  },
  {
    group: 'Electron',
    color: '#9feaf9',
    keywords: ['electron', 'electron-vite']
  },
  {
    group: 'Uni-app',
    color: '#2b9939',
    keywords: ['uni-app', 'uniapp']
  },
  {
    group: 'Micro Frontend',
    color: '#f59e0b',
    keywords: ['micro-frontend', 'microfrontend', 'qiankun', 'wujie', 'module-federation']
  },
  {
    group: 'AI',
    color: '#a78bfa',
    keywords: ['ai', 'llm', 'chatgpt', 'machine-learning', 'artificial-intelligence', 'agent']
  },
  {
    group: 'Styles & UI',
    color: '#f472b6',
    keywords: ['css', 'tailwind', 'design-system', 'component-library', 'ui-library', 'icons']
  },
  {
    group: 'Dev Tools',
    color: '#64748b',
    keywords: ['cli', 'devtools', 'developer-tools', 'build-tool', 'bundler', 'linter', 'formatter']
  },
  {
    group: 'Client',
    color: '#38bdf8',
    keywords: ['desktop', 'client', 'electron', 'tauri']
  }
]

const normalize = (value: string) => value.toLowerCase().replaceAll('_', '-')

export function suggestGroups(repository: StarredRepository): ClassificationRule[] {
  const searchable = normalize(
    [repository.fullName, repository.description, repository.language, ...repository.topics].join(' ')
  )

  return classificationRules.filter(rule => {
    const languageMatch = rule.languages?.some(
      language => normalize(language) === normalize(repository.language)
    )
    const keywordMatch = rule.keywords.some(keyword => {
      const normalizedKeyword = normalize(keyword)
      if (normalizedKeyword.length <= 2) {
        return searchable.split(/[^a-z0-9+#.-]+/).includes(normalizedKeyword)
      }
      return searchable.includes(normalizedKeyword)
    })

    return languageMatch || keywordMatch
  })
}

export function isStale(repository: StarredRepository): boolean {
  if (!repository.pushedAt) return true
  const threeYearsAgo = new Date()
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
  return new Date(repository.pushedAt) < threeYearsAgo
}
