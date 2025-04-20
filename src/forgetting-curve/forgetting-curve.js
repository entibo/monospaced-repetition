import * as fsrs from './fsrs.js'

export const Rating = fsrs.Rating

const DAYS = 1000 * 60 * 60 * 24

/**
 * @typedef Memory
 * @property {number} stability
 * @property {number} difficulty
 * @property {number|Date} lastDate
 *
 */
/**
 * @typedef Review
 * @property {number|Date} date
 * @property {Rating} rating
 */

/**
 * TODO: docstring
 * @param {Memory} [memory]
 * @param {Review} review
 * @returns {Memory}
 */
export function addReview(memory, { date, rating }) {
  if (!memory) {
    return {
      stability: fsrs.initialStability({ rating }),
      difficulty: fsrs.initialDifficulty({ rating }),
      lastDate: date,
    }
  }

  const { stability, difficulty, lastDate } = memory
  return {
    stability: fsrs.nextStability({
      stability,
      difficulty,
      lastDate,
      rating,
      date,
    }),
    difficulty: fsrs.nextDifficulty({ difficulty, rating }),
    lastDate: date,
  }
}

/**
 * TODO: docstring
 * @param {Memory} memory
 * @param {number|Date} date
 */
export function getRetention({ stability, lastDate }, date) {
  const elapsedDays = (date - lastDate) / DAYS
  return fsrs.getRetention({ stability, elapsedDays })
}

/**
 * TODO: docstring
 * @param {Memory} memory
 * @param {number} retention
 */
export function getDate({ stability, lastDate }, retention) {
  const days = fsrs.nextInterval({ stability, retention })
  return new Date(Number(lastDate) + days * DAYS)
}
