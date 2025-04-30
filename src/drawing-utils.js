export function mergeLines(...sections) {
  const r = []
  let width = 0
  for (const lines of sections) {
    const w = Math.max(...lines.map((line) => line.length))
    for (let i = 0; i < Math.max(lines.length, r.length); i++) {
      r[i] = (r[i] ?? '').padEnd(width) + (lines[i] ?? '').padEnd(w)
    }
    width = w
  }
  return r
}

export function frameLines(
  lines,
  { minWidth = 0, padding = 0, title = '' } = {},
) {
  // Inner width (without padding)
  const width = Math.max(
    minWidth,
    title.length + 2 - padding * 2,
    ...lines.map((line) => line.length),
  )
  return [
    '╭' + '─'.repeat(width + padding * 2) + '╮',
    ...lines.map((line) => {
      // const leftAligned = line.padEnd(width, ' ')
      const left = Math.floor((width - line.length) / 2)
      const centered = (' '.repeat(left) + line).padEnd(width, ' ')
      return '│' + ' '.repeat(padding) + centered + ' '.repeat(padding) + '│'
    }),
    '╰' + ('─' + title + '─').padStart(width + padding * 2, '─') + '╯',
  ]
}
