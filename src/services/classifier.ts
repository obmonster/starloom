import ruleCatalog from './classificationRules.json'

import type { StarredRepository } from '../types'

export interface ClassificationRule {
  group: string
  description: string
  color: string
  keywords: string[]
  languages?: string[]
}

export const classificationRules = ruleCatalog as ClassificationRule[]

const normalize = (value: string) => value.toLowerCase().replaceAll('_', '-')

const tokenize = (value: string) => {
  const compounds = value.match(/[a-z0-9+#]+(?:[.-][a-z0-9+#]+)*/g) ?? []
  return new Set(compounds.flatMap(token => [token, ...token.split(/[.-]/)]))
}

const scoreRule = (repository: StarredRepository, rule: ClassificationRule) => {
  const nameTokens = tokenize(normalize(repository.fullName))
  const topicTokens = tokenize(normalize(repository.topics.join(' ')))
  const descriptionTokens = tokenize(normalize(repository.description))
  const languageMatch = rule.languages?.some(
    language => normalize(language) === normalize(repository.language)
  )

  return rule.keywords.reduce((score, keyword) => {
    const token = normalize(keyword)
    if (nameTokens.has(token)) return score + 5
    if (topicTokens.has(token)) return score + 3
    if (descriptionTokens.has(token)) return score + 1
    return score
  }, languageMatch ? 6 : 0)
}

export function suggestGroups(repository: StarredRepository): ClassificationRule[] {
  let bestRule: ClassificationRule | undefined
  let bestScore = 0

  for (const rule of classificationRules) {
    const score = scoreRule(repository, rule)
    if (score > bestScore) {
      bestRule = rule
      bestScore = score
    }
  }

  return bestRule ? [bestRule] : []
}

export function isStale(repository: StarredRepository): boolean {
  if (!repository.pushedAt) return true
  const threeYearsAgo = new Date()
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
  return new Date(repository.pushedAt) < threeYearsAgo
}
