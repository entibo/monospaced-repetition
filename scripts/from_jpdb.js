// reviews.json
// exported from JPDB.io
const EXAMPLE_INPUT = {
  cards_vocabulary_jp_en: [
    {
      vid: 1538100,
      spelling: '約',
      reading: 'やく',
      reviews: [
        { timestamp: 1718273287, grade: 'known', from_anki: false },
        { timestamp: 1719171285, grade: 'okay', from_anki: false },
        { timestamp: 1723477863, grade: 'easy', from_anki: false },
        { timestamp: 1743275221, grade: 'something', from_anki: false },
        { timestamp: 1743275536, grade: 'okay', from_anki: false },
      ],
    },
    {
      vid: 1270190,
      spelling: 'ご',
      reading: 'ご',
      reviews: [
        { timestamp: 1730212797, grade: 'known', from_anki: false },
        { timestamp: 1730811641, grade: 'easy', from_anki: false },
      ],
    },
  ],
}

const EXAMPLE_OUTPUT = `
約:
  - やく
  - 2024-06-13T10:08:07.000Z: easy
  - 2024-06-23T19:34:45.000Z: good
  - 2024-08-12T15:51:03.000Z: easy
  - 2025-03-29T19:07:01.000Z: again
  - 2025-03-29T19:12:16.000Z: good
ご:
  - 2024-10-29T14:39:57.000Z: easy
  - 2024-11-05T13:00:41.000Z: easy
`

const RATINGS = {
  unknown: 'again',
  something: 'again',
  hard: 'hard',
  okay: 'good',
  easy: 'easy',
  known: 'easy',
}

// Read file from command line argument
// Print to stdout using console.log

import fs from 'fs'

if (process.argv.length < 3) {
  console.error('Usage: node from_jpdb.js <input_file>')
  process.exit(1)
}
const input = JSON.parse(fs.readFileSync(process.argv[2]))

for (const { spelling, reading, reviews } of input.cards_vocabulary_jp_en) {
  console.log(`${spelling}:`)

  if (spelling !== reading) {
    console.log(`  - ${reading}`)
  }

  console.log(`  -`)
  for (const { timestamp, grade } of reviews) {
    if (!RATINGS[grade]) throw new Error(`Unknown grade: ${grade}`)
    const date = new Date(timestamp * 1000)
    console.log(`    ${date.toISOString()}: ${RATINGS[grade]}`)
  }
}
