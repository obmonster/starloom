import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import ruleCatalog from '../src/services/classificationRules.json' with { type: 'json' }

const [, , inputArgument, outputArgument] = process.argv

if (!inputArgument || !outputArgument) {
  throw new Error('用法：node scripts/reclassify-backup.mjs <输入备份> <输出备份>')
}

const normalize = value => value.toLowerCase().replaceAll('_', '-')

const tokenize = value => {
  const compounds = value.match(/[a-z0-9+#]+(?:[.-][a-z0-9+#]+)*/g) ?? []
  return new Set(compounds.flatMap(token => [token, ...token.split(/[.-]/)]))
}

const suggestGroups = repository => {
  const nameTokens = tokenize(normalize(repository.fullName))
  const topicTokens = tokenize(normalize(repository.topics.join(' ')))
  const descriptionTokens = tokenize(normalize(repository.description))
  let bestRule
  let bestScore = 0

  for (const rule of ruleCatalog) {
    const languageMatch = rule.languages?.some(
      language => normalize(language) === normalize(repository.language)
    )
    const score = rule.keywords.reduce((total, keyword) => {
      const token = normalize(keyword)
      if (nameTokens.has(token)) return total + 5
      if (topicTokens.has(token)) return total + 3
      if (descriptionTokens.has(token)) return total + 1
      return total
    }, languageMatch ? 6 : 0)

    if (score > bestScore) {
      bestRule = rule
      bestScore = score
    }
  }

  return bestRule ? [bestRule] : []
}

const inputPath = resolve(inputArgument)
const outputPath = resolve(outputArgument)
const backup = JSON.parse(await readFile(inputPath, 'utf8'))
const createdAt = new Date().toISOString()
const groups = ruleCatalog.map((rule, index) => ({
  id: `local:catalog:${index + 1}`,
  name: rule.group,
  description: rule.description,
  isPrivate: false,
  color: rule.color,
  createdAt,
  updatedAt: createdAt
}))
const groupIdByName = new Map(groups.map(group => [group.name, group.id]))
const repositories = backup.repositories.map(repository => {
  const groupIds = suggestGroups(repository).map(rule => groupIdByName.get(rule.group))
  return {
    ...repository,
    status: groupIds.length ? 'organized' : 'inbox',
    groupIds
  }
})
const output = {
  ...backup,
  exportedAt: createdAt,
  repositories,
  groups
}

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

const assigned = repositories.filter(repository => repository.groupIds.length)
const multiGroup = assigned.filter(repository => repository.groupIds.length > 1)

console.log(`输出：${outputPath}`)
console.log(`仓库：${repositories.length}`)
console.log(`已分类：${assigned.length}`)
console.log(`待整理：${repositories.length - assigned.length}`)
console.log(`多重归属：${multiGroup.length}`)
for (const group of groups) {
  const count = repositories.filter(repository => repository.groupIds.includes(group.id)).length
  console.log(`${group.name}: ${count}`)
}
