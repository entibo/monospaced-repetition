// https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
// Ported from py-fsrs@5.1.2

// CONSTANTS

/** @enum {number} */
export const Rating = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 }

const PARAMETERS = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655,
  0.6621,
]

const DECAY = -0.5
const FACTOR = 0.9 ** (1 / DECAY) - 1

const DAYS = 1000 * 60 * 60 * 24

// RETENTION/RETRIEVABILITY

export function getRetention({ stability, elapsedDays }) {
  return (1 + (FACTOR * elapsedDays) / stability) ** DECAY
}

// INTERVAL

export function nextInterval({ stability, retention }) {
  return (stability / FACTOR) * (retention ** (1 / DECAY) - 1)
  // return Math.min(Math.max(Math.round(interval), 1), maximumInterval)
}

// STABILITY

export function initialStability({ rating }) {
  return Math.max(PARAMETERS[rating - 1], 0.1)
}

export function nextStability({
  stability,
  difficulty,
  lastDate,
  rating,
  date,
}) {
  const elapsedDays = (date - lastDate) / DAYS

  if (elapsedDays < 1) {
    return stability * Math.exp(PARAMETERS[17] * (rating - 3 + PARAMETERS[18]))
  }

  const retention = getRetention({ stability, elapsedDays })

  if (rating === Rating.AGAIN) {
    const longTerm =
      PARAMETERS[11] *
      difficulty ** -PARAMETERS[12] *
      ((stability + 1) ** PARAMETERS[13] - 1) *
      Math.exp((1 - retention) * PARAMETERS[14])

    const shortTerm = stability / Math.exp(PARAMETERS[17] * PARAMETERS[18])

    return Math.min(longTerm, shortTerm)
  }

  return (
    stability *
    (1 +
      Math.exp(PARAMETERS[8]) *
        (11 - difficulty) *
        stability ** -PARAMETERS[9] *
        (Math.exp((1 - retention) * PARAMETERS[10]) - 1) *
        (rating === Rating.HARD ? PARAMETERS[15] : 1) *
        (rating === Rating.EASY ? PARAMETERS[16] : 1))
  )
}

// DIFFICULTY

export function initialDifficulty({ rating }) {
  const difficulty = PARAMETERS[4] - Math.exp(PARAMETERS[5] * (rating - 1)) + 1

  return Math.min(Math.max(difficulty, 1), 10)
}

export function nextDifficulty({ difficulty, rating }) {
  function meanReversion(a, b) {
    return PARAMETERS[7] * a + (1 - PARAMETERS[7]) * b
  }

  const deltaDifficulty = -(PARAMETERS[6] * (rating - 3))

  const nextDifficulty = meanReversion(
    initialDifficulty({ rating: Rating.EASY }),
    difficulty + ((10 - difficulty) * deltaDifficulty) / 9,
  )

  return Math.min(Math.max(nextDifficulty, 1), 10)
}
