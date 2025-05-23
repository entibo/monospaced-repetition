#!/usr/bin/env node

import fs from 'fs'
import yaml from 'yaml'
import { timestamp, toISODateString } from './date-stuff.js'
import {
  Rating,
  addReview,
  getDate,
} from './forgetting-curve/forgetting-curve.js'
import { addToMap, memoObject, sortBy } from './helpers.js'
import { frameLines, mergeLines } from './drawing-utils.js'

const DAYS = 1000 * 60 * 60 * 24

const RATINGS = {
  again: Rating.AGAIN,
  easy: Rating.EASY,
  good: Rating.GOOD,
  hard: Rating.HARD,
}

/** @type {yaml.DocumentOptions & yaml.ParseOptions & yaml.SchemaOptions & yaml.ToStringOptions} */
const YAMLOptions = {
  schema: 'core',
  customTags: [timestamp],
  nullStr: '',
  lineWidth: 60,
}

const currentDate = new Date()

////////////////////////////////////////////////////////////////////////////////

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: msrs file.yaml')
  process.exit(1)
}

const fileSource = fs.readFileSync(filePath).toString()

const doc = yaml.parseDocument(fileSource, YAMLOptions)
for (const warning of doc.warnings) {
  console.log(warning.message)
}

if (doc.errors.length) {
  for (const error of doc.errors) {
    console.log(error.message)
  }
  process.exit(1)
}

if (!yaml.isMap(doc.contents)) {
  if (doc.contents === null) {
    doc.contents = doc.createNode({})
  } else {
    const type = yaml.isSeq(doc.contents) ? 'list' : typeof doc.contents.value
    console.error(`Error: expected top-level map (got ${type})`)
    process.exit(1)
  }
}

const defaultOptions = doc.createNode({
  target_retention: 0.9,
  rating: {
    location: 'end',
    placeholder: '',
    again: '1',
    hard: '2',
    good: '3',
    easy: '4',
  },
  new_cards: 'start',
  compact: true,
  locale: 'en',
})

// Read user options or use defaults

const options =
  doc.contents.items.find((pair) => pair.key?.value === 'options') ??
  doc.createPair('options', defaultOptions)

if (!yaml.isMap(options.value)) {
  console.error('Error: options must be a map')
  process.exit(1)
}

// Add missing options

for (const pair of defaultOptions.items)
  if (!options.value.has(pair.key)) options.value.add(pair)

if (!yaml.isMap(options.value.get('rating', true))) {
  console.error('Error: options.rating must be a map')
  process.exit(1)
}

for (const pair of defaultOptions.get('rating', true).items)
  if (!options.value.hasIn(['rating', pair.key]))
    options.value.addIn(['rating'], pair)

const allowedRatingLocations = ['start', 'end', 'outside', 'inside']
const ratingLocation = options.value.getIn(['rating', 'location'])
if (ratingLocation && !allowedRatingLocations.includes(ratingLocation)) {
  console.warn(`Warning: Unknown rating location "${ratingLocation}"`)
}

// Show default/allowed values in comments

options.value.getIn(['rating', 'location'], true).comment =
  ' ' + allowedRatingLocations.join(', ')
// options.get('order', true).comment = ' due, added, random, difficulty'
// options.get('order', true).flow = true
options.value.get('target_retention', true).comment = ' 0.70 – 0.98'
options.value.get('new_cards', true).comment = ' start, end'

// Collect the cards

const cards = doc.contents.items.filter((pair) => pair.key?.value !== 'options')

// Remove marks from the AST (ratings inserted by the user)
// and return them as a list
function extractMarks(card) {
  const marks = []
  if (card.key.anchor) {
    const anchorValue = card.key.anchor.replace(/^-/, '')
    if (anchorValue) marks.push(anchorValue)
    delete card.key.anchor
  }
  yaml.visit(card, {
    Node(_, node) {
      for (const key of ['comment', 'commentBefore']) {
        const rawComment = node[key]
        delete node[key]
        if (!rawComment) continue
        const commentValue = rawComment.split('\n')?.at(-1).trim()
        if (commentValue.length > 1) continue
        if (commentValue) {
          marks.push(commentValue)
        }
      }
    },
  })
  return marks
}

function extractNewRatings(card) {
  const newRatings = []
  const unknownMarks = []

  for (const mark of extractMarks(card)) {
    const match = Object.entries(RATINGS).find(
      ([name, _]) => mark == options.value.getIn(['rating', name]),
    )
    if (match) {
      const [name, value] = match
      newRatings.push({ mark, name, value })
    } else {
      unknownMarks.push(mark)
    }
  }

  return { newRatings, unknownMarks }
}

function addNewRating(card, { name }) {
  normalizeCardValue(card)
  const reviewsMap = getReviewsMap(card)
  reviewsMap.items.unshift(doc.createPair(currentDate, name))
}

function getReviewsMap(card) {
  if (!yaml.isSeq(card.value)) return
  const reviewsMap = card.value.items.at(-1)
  if (!yaml.isMap(reviewsMap)) return
  return reviewsMap
}

// Ensure card value:
// 1. Is a list
// 2. Last item is a map of dates
// If not, store the current value as the first item in a list
function normalizeCardValue(card) {
  const { value } = card

  if (yaml.isSeq(value)) {
    const lastItem = value.items.at(-1)
    if (
      yaml.isMap(lastItem) &&
      lastItem.items.every(({ key }) => key.value instanceof Date)
    ) {
    } else {
      value.items.push(doc.createNode({}))
    }
    return
  }

  const isEmptyValue =
    !value ||
    (yaml.isCollection(value) && value.items.length === 0) ||
    (yaml.isScalar(value) && (value.value === null || value.value === ''))

  card.value = doc.createNode(isEmptyValue ? [{}] : [value, {}])
}

// Add new cards, turn user ratings into reviews

for (const card of cards) {
  // Look for a user rating and turn it into a review

  const { newRatings, unknownMarks } = extractNewRatings(card)

  for (const mark of unknownMarks) {
    console.log(`Warning: unknown rating "${mark}" (in "${card.key.value}")`)
  }

  const newRating = newRatings[0]

  if (newRatings.length > 1) {
    for (const { mark } of newRatings.slice(1)) {
      console.log(
        `Warning: ignoring rating "${mark}" (already have "${newRating.mark}") (in "${card.key.value}")`,
      )
    }
  }

  if (newRating) addNewRating(card, newRating)

  const placeholder = options.value.getIn(['rating', 'placeholder'])
  // Add a rating placeholder for next tim.includes(options.value.getIn(['rating', 'location']e))
  {
  }
  const commentValue = unknownMarks[0] || placeholder || ' '
  const anchorValue = unknownMarks[0] || placeholder || '-'

  const ratingLocation = options.value.getIn(['rating', 'location'])
  switch (ratingLocation) {
    case 'start':
      card.key.anchor = anchorValue
      break
    case 'end':
      card.key.comment = commentValue
      break
    case 'outside':
      card.key.commentBefore = commentValue
      break
    case 'inside':
      card.value.commentBefore = commentValue
      break
  }
}

for (const card of cards) {
  if (yaml.isSeq(card.value)) {
    card.value.flow = false
  }
}

// Sort the reviews (most recent one first)
for (const card of cards) {
  const reviewMap = getReviewsMap(card)
  if (!reviewMap) continue
  reviewMap.items.sort(sortBy((pair) => pair.key.value)).reverse()
}

// Sort and group cards by due date

const getActualReviews = memoObject(function (card) {
  const reviewMap = getReviewsMap(card)
  if (!reviewMap) return []

  const reviewMapPairs = reviewMap.toJS(doc, { mapAsMap: true }).entries()

  const reviews = []
  for (const [date, label] of reviewMapPairs) {
    if (!(date instanceof Date)) {
      console.log(`Warning: bad date "${date}" (in "${card.key.value}")`)
      continue
    }
    const rating = RATINGS[label]
    if (!rating) {
      console.log(`Warning: unknown label "${label}" (in "${card.key.value}")`)
      continue
    }
    reviews.push({ date, rating })
  }

  return reviews.sort(sortBy(({ date }) => date))
})

const getDifficulty = (card) => {
  const reviews = getActualReviews(card)
  if (!reviews.length) return

  let memory
  for (const { date, rating } of reviews) {
    memory = addReview(memory, { date, rating })
  }

  return memory.difficulty
}

const getDueDate = memoObject(function (card) {
  const reviews = getActualReviews(card)
  if (!reviews.length) return

  let memory
  for (const { date, rating } of reviews) {
    memory = addReview(memory, { date, rating })
  }

  const dueDate = getDate(memory, options.value.get('target_retention'))
  // We could stop here and return dueDate

  let interval = (dueDate - memory.lastDate) / DAYS

  // Add some variation to the date to avoid cards sticking together
  {
    // A unique number, given a card's question and review history
    let hash = 0
    for (const c of JSON.stringify([card.key.value, memory])) {
      hash = hash * 31 + c.charCodeAt(0)
    }

    // A uniformly distributed number between -1 and 1, given a hash
    const x = Math.sin(hash) * 10000
    const factor = x - Math.trunc(x)

    // Plus or minus 10%
    interval = interval * (1 + factor * 0.1)
  }

  // Don't schedule for the same day (unless we failed to recall)
  {
    if (reviews.at(-1).rating !== RATINGS.again) {
      interval = Math.max(1, interval)
    }
  }

  return new Date(Number(memory.lastDate) + interval * DAYS)
})

const locale = options.value.get('locale')

const compactOption = Boolean(options.value.get('compact'))

// Sort the cards
const newCardSortValue =
  options.value.get('new_cards') === 'start' ? -1 : Infinity
cards.sort(sortBy((card) => getDueDate(card) ?? newCardSortValue))
doc.contents.items = [options, ...cards]

function addCommentBefore(card, comment, compact = compactOption) {
  // Existing comment with a rating or serving as placeholder for one
  const previousComment = card.key.commentBefore
    ? '\n' + card.key.commentBefore
    : ''

  card.key.commentBefore = comment + (compact ? '' : '\n') + previousComment
}

// Group by new / due date

const newCards = []
const cardsByDate = new Map()
const cardsByMonth = new Map()

for (const card of cards) {
  const dueDate = getDueDate(card)
  if (!dueDate) {
    newCards.push(card)
    continue
  }

  const fullDate = toISODateString(dueDate)
  const month = fullDate.slice(0, 7)
  addToMap(cardsByDate, fullDate, card)
  addToMap(cardsByMonth, month, card)
}

// Generate the schedule hierarchy
if (false) {
  // Remove scheduled cards from top-level
  const scheduledCards = new Set([...cardsByDate.values()].flat())
  doc.contents.items = doc.contents.items.filter(
    (item) => !scheduledCards.has(item),
  )

  const dateMap = new yaml.YAMLMap()
  dateMap.items = [...cardsByDate.entries()].map(([isoDate, cards]) => {
    const cardMap = new yaml.YAMLMap()
    cardMap.items = cards
    const date = new Date(isoDate)
    const pair = doc.createPair(date, cardMap)
    // const pair = doc.createPair(isoDate, cardMap)
    // const pair =  doc.createPair(
    //   new Date(isoDate).toLocaleDateString(locale, {
    //     year: '2-digit',
    //     month: 'short',
    //     day: '2-digit',
    //     weekday: 'short',
    //   }),
    //   cardMap,
    // )
    const num = cards.length.toString()
    pair.key.comment =
      num.padEnd(3) + //
      date
        .toLocaleDateString(locale, { month: 'narrow' })
        .padStart(1 + date.getMonth())
        .padEnd(12)
    // '─'.repeat(Math.floor(cards.length)) //
    // '█'.repeat(Math.floor(cards.length / 8)) +
    // ' ▏▎▍▌▋▊▉'[cards.length % 8]

    return pair
  })
  const schedule = doc.createPair('schedule', dateMap)
  // doc.contents.items.push(schedule)
  doc.contents.items.push(...dateMap.items)
}

// Add an empty line before each card?
{
  for (const card of cards) {
    card.key.spaceBefore = !compactOption
  }
}

//

function drawMonthLines(date) {
  const month = date.toLocaleDateString(locale, { month: 'long' })
  const year = date.toLocaleDateString(locale, { year: 'numeric' })
  return frameLines([month], { title: year, /* padding: 1 */ minWidth: 16 })
}

//                        ╭────╮ ╭──────────╮
//                 Friday │ 08 │ │ November │
//                        ╰────╯ ╰─────2024─╯
function drawDueComment(date, isFirstOfMonth) {
  const dateNumber = date.getDate().toString().padStart(2, '0')
  const dateFrame = frameLines([dateNumber], { padding: 1 })
  const weekday = date.toLocaleDateString(locale, { weekday: 'long' })

  const dateDayLines = mergeLines(
    ['', weekday.padStart(32), ''],
    [' '],
    dateFrame,
  )
  if (!isFirstOfMonth) {
    return dateDayLines.join('\n')
  }

  const monthLines = drawMonthLines(date)

  return mergeLines(dateDayLines, [' '], monthLines) //
    .join('\n')
}

// Add a comment on top of each due date group
if (false) {
  for (const [fullDate, cards] of cardsByDate) {
    const firstCard = cards[0]
    const month = fullDate.slice(0, 7)
    const isFirstOfMonth = firstCard === cardsByMonth.get(month)[0]
    addCommentBefore(
      firstCard,
      drawDueComment(getDueDate(firstCard), isFirstOfMonth),
    )
  }
}

// Group by dates by adding comment headers
if (true) {
  /** @param {Date} date */
  function printDate(date) {
    const dt = Math.abs(date - currentDate)

    /** @type {Intl.DateTimeFormatOptions} */
    const options = {}
    if (dt < 7 * DAYS) {
      options.day = 'numeric'
      options.weekday = 'long'
    }
    if (dt < 6 * 30 * DAYS) {
      options.month = 'long'
    }
    // if (date.getFullYear() !== currentDate.getFullYear()) {
    options.year = 'numeric'
    // }

    return date.toLocaleDateString(locale, options)
  }

  const seen = new Set()
  for (const [fullDate, cards] of cardsByDate) {
    const firstCard = cards[0]
    const date = new Date(getDueDate(firstCard))
    if (true || date > currentDate) {
      const dateStr = printDate(date)
      if (seen.has(dateStr)) continue
      firstCard.key.spaceBefore = true
      seen.add(dateStr)
      addCommentBefore(firstCard, ' ' + dateStr)
    }
  }

  const firstNewCard = newCards[0]
  if (firstNewCard) {
    firstNewCard.key.spaceBefore = true
    // addCommentBefore(firstNewCard, ' ' + '-'.repeat(YAMLOptions.lineWidth - 2))
    addCommentBefore(firstNewCard, 'NEW')
  }
}

// Show empty months
// if (cardsByMonth.size >= 2) {
//   const firstDueDate = getDueDate([...cardsByMonth.values()][0][0])

//   for (const [card] of [...cardsByMonth.values()].reverse()) {
//     const dueDate = getDueDate(card)

//     let monthDate = new Date(dueDate)
//     monthDate.setDate(15)
//     while (true) {
//       monthDate.setMonth(monthDate.getMonth() - 1)

//       if (monthDate <= firstDueDate) break
//       if (cardsByMonth.has(toISODateString(monthDate).slice(0, 7))) break

//       const monthLines = drawMonthLines(monthDate).map((line) =>
//         line.padStart(58),
//       )

//       addCommentBefore(card, monthLines.join('\n'), true)
//     }
//   }
// }

/** Insert commas every 3 digits: `1,234,567` */
function prettyNumber(num) {
  // return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  let str = num.toLocaleString([locale, 'en'])
  // French uses "Narrow No-Break Space"
  str = str.replace(/\s/g, ' ')
  return str
}

// J E 10 ي Sz Б Ş ज
function getMonthLabel(date) {
  const label = date.toLocaleDateString(locale ?? undefined, {
    month: 'narrow',
  })
  // If numbers are used, keep the numbers only (e.g. 3月 -> 3)
  const numbers = label.match(/(\d+)/)?.[1]
  return numbers ?? label
}

// M   J   J    A   S    O   N   D    J   F   M    A
//    █ █▀   ▀ ▀ ▀▀         ▄█                       █▀
//   ████▀       ▄         █                       ▄ █
//   ▀▀█▄ ▀  ▄   ▀          ▀                ▄   ▄  ▄▀
//   ▀ ▀ ▀                                          ▀▀
const TOPDAY = 1 // SUNDAY=0 MONDAY=1
export function activityLines(now, getReviews) {
  const topOffset = (7 + now.getDay() - TOPDAY) % 7

  const cols = []
  for (let i = 0; i < 52; i++) {
    const col = []
    {
      const date = new Date(now)
      date.setDate(date.getDate() - topOffset - i * 7)
      const d = date.getDate()

      // if (d <= 7) col.push((date.getMonth() + 1).toString())
      if (d <= 7) col.push(getMonthLabel(date))
      else col.push(' ')
    }

    // col.push(' ') // Empty line between labels and straks

    const masks = [0, 0, 0, 0]
    for (let j = 0; j < 7; j++) {
      const date = new Date(now)
      date.setDate(date.getDate() - topOffset - i * 7 + j)
      const k = j //+ 1
      if (getReviews(date).length) {
        masks[Math.floor(k / 2)] += 1 + (k % 2)
      }
    }
    col.push(...masks.map((mask) => ' ▀▄█'[mask]))
    cols.push(col)
  }

  // First column is `now`, but we want it on the right
  cols.reverse()

  cols.unshift(Array(cols[0].length).fill(' '))
  cols.push(Array(cols[0].length).fill(' '))

  // Transpose into lines
  const lines = []
  for (let i = 0; i < cols[0].length; i++) {
    let line = ''
    for (let j = 0; j < cols.length; ) {
      const value = cols[j][i]
      line += value
      // Month labels longer than 1 character overwrite the next column(s)
      j += value.length
    }
    lines.push(line)
  }

  return lines
}

// Draw stats and graphs
if (cards.length) {
  const reviews = cards.flatMap((card) => getActualReviews(card))

  const reviewsByDate = new Map()
  for (const { date, rating } of reviews) {
    addToMap(reviewsByDate, toISODateString(date), rating)
  }
  function getReviews(date) {
    return reviewsByDate.get(toISODateString(date)) ?? []
  }

  const lines = [
    mergeLines(
      ['  '],
      frameLines(activityLines(currentDate, getReviews), { title: 'activity' }),
    ),
    mergeLines(
      ['  '],
      frameLines([prettyNumber(cards.length)], {
        minWidth: 16,
        title: 'cards',
      }),
      [' '],
      frameLines([prettyNumber(reviews.length)], {
        minWidth: 16,
        title: 'reviews',
      }),
      [' '],
      frameLines([toISODateString(currentDate)], {
        minWidth: 16,
        title: 'updated',
      }),
    ),
  ].flat()

  addCommentBefore(cards[0], lines.join('\n'), false)
}

// Add space before first card = between options and stats
const firstCard = cards[0]
if (firstCard) {
  firstCard.key.spaceBefore = true
}

// Add space after new cards to make adding new cards easier
const firstDueCard = Array.from(cardsByDate.values())[0]?.[0]
if (firstDueCard) {
  firstDueCard.key.spaceBefore = true
}

// Write file back

let newFileSource = yaml.stringify(doc, YAMLOptions)

// Replace the space between anchor and key in "&- Question" with a tab
// to avoid shifting the question and having to re-position the cursor
// HACK: i haven't found a proper way to do this
newFileSource = newFileSource.replace(/^(&\S) /gm, '$1\t')

fs.writeFileSync(filePath, newFileSource)
