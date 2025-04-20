#!/usr/bin/env node

import fs from 'fs'
import yaml from 'yaml'
import { timestamp, toISODateString } from './date-stuff.js'
import {
  Rating,
  addReview,
  getDate,
} from './forgetting-curve/forgetting-curve.js'
import { memoObject, sortBy } from './helpers.js'

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
  lineWidth: 80,
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
  const type =
    doc.contents === null
      ? 'null'
      : yaml.isSeq(doc.contents)
      ? 'list'
      : typeof doc.contents.value

  console.error(`Error: expected top-level map (got ${type})`)
  process.exit(1)
}

const defaultOptions = doc.createNode({
  target_retention: 0.9,
  compact: false,
  rating: {
    location: 'end',
    placeholder: '',
    again: '1',
    hard: '2',
    good: '3',
    easy: '4',
  },
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

// Show default/allowed values in comments

options.value.getIn(['rating', 'location'], true).comment =
  ' start, end, outside, inside'
// options.get('order', true).comment = ' due, added, random, difficulty'
// options.get('order', true).flow = true
options.value.get('target_retention', true).comment = ' 0.70 – 0.98'

// Read the cards

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
        const commentValue = node[key]?.split('\n')?.at(-1).trim()
        if (commentValue && !commentValue.startsWith('#')) {
          marks.push(commentValue)
        }
        delete node[key]
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
      ([name, _]) => mark === options.value.getIn(['rating', name]),
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
// 2. Last item is a map
// If not, store the current value as the first item in a list
function normalizeCardValue(card) {
  const { value } = card

  if (yaml.isSeq(value)) {
    const lastItem = card.value.items.at(-1)
    if (!yaml.isMap(lastItem)) {
      card.value.items.push(doc.createNode({}))
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
  // Add a rating placeholder for next time

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
    default:
      console.warn(`Warning: Unknown rating location "${ratingLocation}"`)
  }
}

// Sort and group cards by due date

function getActualReviews(card) {
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
}

const getDueDate = memoObject(function (card) {
  const reviews = getActualReviews(card)
  if (!reviews.length) return

  let memory
  for (const { date, rating } of reviews) {
    memory = addReview(memory, { date, rating })
  }

  return getDate(memory, options.value.get('target_retention'))
})

// Sort by due date ascending, followed by cards without a due date
cards.sort(sortBy((card) => getDueDate(card) ?? Infinity))

const isCompact = Boolean(options.value.get('compact'))

const firstOfGroup = new Set()
for (const card of cards) {
  const dueDate = getDueDate(card)
  const group = dueDate ? toISODateString(dueDate) : 'New'
  if (!firstOfGroup.has(group)) {
    firstOfGroup.add(group)

    card.key.commentBefore =
      '#'.repeat(35) +
      ' ' +
      group +
      (isCompact ? '' : '\n') +
      (card.key.commentBefore ?? '')
  }
  card.key.spaceBefore = !isCompact
}

doc.contents.items = [options, ...cards]

// Write file back

let newFileSource = yaml.stringify(doc, YAMLOptions)

// Replace the space between anchor and key in "&- question" with a tab
// to avoid shifting the question and having to re-position the cursor
// HACK: i haven't found a proper way to do this
newFileSource = newFileSource.replace(/^(&\S) /gm, '$1\t')

fs.writeFileSync(filePath, newFileSource)
