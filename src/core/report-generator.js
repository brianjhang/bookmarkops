const REPORT_VERSION = 1

export function createJsonReport(scanResult) {
  assertScanResult(scanResult)

  return {
    reportType: 'bookmarkops.bookmark_report',
    version: REPORT_VERSION,
    generatedAt: scanResult.generatedAt,
    privacy: {
      externalTransmission: false,
      dataBoundary: 'Generated locally inside the BookmarkOps extension.',
    },
    stats: scanResult.stats,
    bookmarks: scanResult.bookmarks.map(pickBookmarkReportFields),
    folders: scanResult.folders.map(pickFolderReportFields),
  }
}

export function createMarkdownReport(scanResult) {
  const report = createJsonReport(scanResult)
  const lines = [
    '# BookmarkOps Safety Scan Report',
    '',
    `Generated: ${report.generatedAt}`,
    'Data boundary: generated locally inside the BookmarkOps extension.',
    '',
    '## Summary',
    '',
    `- Total nodes: ${report.stats.totalNodeCount}`,
    `- Folders: ${report.stats.folderCount}`,
    `- Bookmarks: ${report.stats.bookmarkCount}`,
    `- Unique URLs: ${report.stats.uniqueUrlCount}`,
    `- Duplicate URLs: ${report.stats.duplicateUrlCount}`,
    `- Empty bookmark titles: ${report.stats.emptyTitleBookmarkCount}`,
    `- Max depth: ${report.stats.maxDepth}`,
    `- Frequent bookmarks: ${report.stats.usageBuckets?.frequent || 0}`,
    `- Recently used bookmarks: ${report.stats.usageBuckets?.recent || 0}`,
    `- Stale bookmarks: ${report.stats.usageBuckets?.stale || 0}`,
    `- Dormant bookmarks: ${report.stats.usageBuckets?.dormant || 0}`,
    `- Unknown usage bookmarks: ${report.stats.usageBuckets?.unknown || 0}`,
    '',
    '## Bookmarks',
    '',
  ]

  if (report.bookmarks.length === 0) {
    lines.push('No bookmarks found.', '')
  } else {
    lines.push('| ID | Path | Title | URL | Last Used | Usage |')
    lines.push('| --- | --- | --- | --- | --- | --- |')

    for (const bookmark of report.bookmarks) {
      lines.push(
        `| ${escapeTableCell(bookmark.id)} | ${escapeTableCell(bookmark.path)} | ${escapeTableCell(bookmark.title)} | ${escapeTableCell(bookmark.url)} | ${escapeTableCell(bookmark.dateLastUsed || '')} | ${escapeTableCell(bookmark.usageBucket || 'unknown')} |`,
      )
    }

    lines.push('')
  }

  lines.push('## Folders', '')

  if (report.folders.length === 0) {
    lines.push('No folders found.', '')
  } else {
    lines.push('| ID | Path | Title |')
    lines.push('| --- | --- | --- |')

    for (const folder of report.folders) {
      lines.push(
        `| ${escapeTableCell(folder.id)} | ${escapeTableCell(folder.path)} | ${escapeTableCell(folder.title)} |`,
      )
    }

    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

export function createReportFile(scanResult, format) {
  const timestamp = toFilenameTimestamp(scanResult.generatedAt)

  if (format === 'json') {
    return {
      filename: `bookmarkops-report-${timestamp}.json`,
      mimeType: 'application/json',
      body: `${JSON.stringify(createJsonReport(scanResult), null, 2)}\n`,
    }
  }

  if (format === 'markdown') {
    return {
      filename: `bookmarkops-report-${timestamp}.md`,
      mimeType: 'text/markdown',
      body: createMarkdownReport(scanResult),
    }
  }

  throw new Error(`Unsupported report format: ${format}`)
}

function pickBookmarkReportFields(bookmark) {
  return {
    id: bookmark.id,
    path: bookmark.path,
    title: bookmark.title,
    url: bookmark.url,
    dateAdded: bookmark.dateAdded,
    dateLastUsed: bookmark.dateLastUsed,
    daysSinceLastUsed: bookmark.daysSinceLastUsed,
    usageBucket: bookmark.usageBucket,
  }
}

function pickFolderReportFields(folder) {
  return {
    id: folder.id,
    path: folder.path,
    title: folder.title,
    dateAdded: folder.dateAdded,
    dateGroupModified: folder.dateGroupModified,
  }
}

function escapeTableCell(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ')
}

function toFilenameTimestamp(generatedAt) {
  return String(generatedAt || new Date().toISOString()).replaceAll(':', '-').replaceAll('.', '-')
}

function assertScanResult(scanResult) {
  if (!scanResult || typeof scanResult !== 'object') {
    throw new Error('Scan result is required.')
  }

  if (!scanResult.stats || !Array.isArray(scanResult.bookmarks) || !Array.isArray(scanResult.folders)) {
    throw new Error('Scan result is missing reportable bookmark data.')
  }
}
