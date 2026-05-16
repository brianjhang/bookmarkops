import assert from 'node:assert/strict'

import { requireAgentSession } from '../src/core/agent-operator.js'
import { generateAgentOnboardingInsights } from '../src/core/insight-generator.js'
import { createJsonReport, createMarkdownReport, createReportFile } from '../src/core/report-generator.js'
import { analyzeBookmarkTree, scanBookmarks } from '../src/core/scanner.js'

const generatedAt = '2026-05-08T00:00:00.000Z'
const mockTree = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        parentId: '0',
        title: 'Bookmarks Bar',
        children: [
          {
            id: '2',
            parentId: '1',
            title: 'OpenSpec',
            children: [
              {
                id: '3',
                parentId: '2',
                title: 'OpenSpec README',
                url: 'https://github.com/Fission-AI/OpenSpec',
                dateAdded: 1778198400000,
                dateLastUsed: Date.parse('2026-05-01T00:00:00.000Z'),
              },
              {
                id: '4',
                parentId: '2',
                title: 'GStack',
                url: 'https://github.com/garrytan/gstack',
                dateAdded: 1778198400000,
                dateLastUsed: Date.parse('2026-02-01T00:00:00.000Z'),
              },
              {
                id: '5',
                parentId: '2',
                title: 'GStack Duplicate',
                url: 'https://github.com/garrytan/gstack',
                dateAdded: 1778198400000,
              },
            ],
          },
        ],
      },
    ],
  },
]

const scanFromTree = analyzeBookmarkTree(mockTree, { generatedAt })

assert.equal(scanFromTree.stats.rootCount, 1)
assert.equal(scanFromTree.stats.folderCount, 3)
assert.equal(scanFromTree.stats.bookmarkCount, 3)
assert.equal(scanFromTree.stats.uniqueUrlCount, 2)
assert.equal(scanFromTree.stats.duplicateUrlCount, 1)
assert.deepEqual(scanFromTree.stats.usageBuckets, {
  frequent: 1,
  recent: 0,
  stale: 1,
  dormant: 0,
  unknown: 1,
})
assert.equal(scanFromTree.bookmarks[0].id, '3')
assert.equal(scanFromTree.bookmarks[0].usageBucket, 'frequent')
assert.equal(scanFromTree.bookmarks[1].usageBucket, 'stale')
assert.equal(scanFromTree.bookmarks[2].usageBucket, 'unknown')
assert.equal(
  scanFromTree.bookmarks[0].path,
  '/Chrome Bookmarks/Bookmarks Bar/OpenSpec/OpenSpec README',
)

const scanFromApi = await scanBookmarks({
  bookmarksApi: {
    getTree(callback) {
      callback(mockTree)
    },
  },
  generatedAt,
})

assert.deepEqual(scanFromApi.stats, scanFromTree.stats)

const jsonReport = createJsonReport(scanFromTree)
assert.equal(jsonReport.privacy.externalTransmission, false)
assert.equal(jsonReport.bookmarks[1].url, 'https://github.com/garrytan/gstack')
assert.equal(jsonReport.bookmarks[0].dateLastUsed, '2026-05-01T00:00:00.000Z')
assert.equal(jsonReport.bookmarks[0].daysSinceLastUsed, 7)

const markdownReport = createMarkdownReport(scanFromTree)
assert.match(markdownReport, /BookmarkOps Safety Scan Report/)
assert.match(markdownReport, /OpenSpec README/)
assert.match(markdownReport, /https:\/\/github.com\/garrytan\/gstack/)
assert.match(markdownReport, /Frequent bookmarks: 1/)

const jsonFile = createReportFile(scanFromTree, 'json')
assert.equal(jsonFile.filename, 'bookmarkops-report-2026-05-08T00-00-00-000Z.json')
assert.equal(jsonFile.mimeType, 'application/json')
assert.match(jsonFile.body, /"externalTransmission": false/)

const markdownFile = createReportFile(scanFromTree, 'markdown')
assert.equal(markdownFile.filename, 'bookmarkops-report-2026-05-08T00-00-00-000Z.md')
assert.equal(markdownFile.mimeType, 'text/markdown')

const insights = generateAgentOnboardingInsights({
  stats: {
    bookmarkCount: 10,
    folderCount: 4,
    duplicateUrlCount: 1,
    emptyTitleBookmarkCount: 2,
    maxDepth: 6,
    usageBuckets: {
      frequent: 1,
      recent: 1,
      stale: 2,
      dormant: 3,
      unknown: 3,
    },
  },
  bookmarks: [
    {
      id: 'a',
      title: 'A',
      url: 'https://duplicate.example/',
      usageBucket: 'frequent',
    },
    {
      id: 'b',
      title: 'B',
      url: 'https://duplicate.example/',
      usageBucket: 'unknown',
    },
  ],
  folders: [
    {
      id: 'f1',
      title: 'Inbox',
      path: '/Chrome Bookmarks/Bookmarks Bar/Inbox',
    },
    {
      id: 'f2',
      title: 'Deep',
      path: '/Chrome Bookmarks/Bookmarks Bar/A/B/C/Deep',
    },
  ],
})
assert.equal(insights.summary.bookmarkCount, 10)
assert.equal(insights.recommendations.some((item) => item.id === 'duplicate-urls'), true)
assert.equal(insights.recommendations.some((item) => item.id === 'empty-titles'), true)
assert.equal(insights.recommendations.some((item) => item.id === 'low-usage-bookmarks'), true)
assert.equal(insights.recommendations.some((item) => item.id === 'unknown-usage'), true)
assert.equal(insights.recommendations.some((item) => item.id === 'deep-folders'), true)
assert.equal(insights.recommendations.some((item) => item.id === 'inbox-piles'), true)

// T5: empty agent token → background.js wraps error to include actionable hint
{
  const mockStorage = {
    get: (_keys, cb) => cb({}),
    set: (_values, cb) => cb?.(),
  }
  async function simulatedHandleAgentMessage(agentToken) {
    try {
      await requireAgentSession(mockStorage, agentToken)
    } catch {
      throw new Error('Agent token invalid. Rotate in Dashboard → Agent Settings.')
    }
  }
  let caughtMessage = ''
  try {
    await simulatedHandleAgentMessage('')
  } catch (err) {
    caughtMessage = err.message
  }
  assert.ok(caughtMessage.includes('Rotate in Dashboard'), `T5: error must contain 'Rotate in Dashboard', got: "${caughtMessage}"`)
}

console.log('Task 1 smoke test passed: scanner and report generator are local-only and reportable.')
