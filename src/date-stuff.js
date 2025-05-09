import yaml from 'yaml'

function pad(num) {
  return num.toString().padStart(2, '0')
}

/**
 * 2025-04-15
 * @param {Date} date
 **/
export function toISODateString(date) {
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate())
  )
}

/**
 * Serialize a date with timezone offset
 * 2025-04-15 22:21:03+2
 * https://stackoverflow.com/a/17415677
 * https://yaml.org/type/timestamp.html
 * @param {Date} date
 **/
export function toISOString(date) {
  if (date % (24 * 60 * 60 * 1000) === 0) return toISODateString(date)

  const tzOffset = -date.getTimezoneOffset()
  const tzHours = Math.floor(Math.abs(tzOffset) / 60)
  const tzMinutes = Math.abs(tzOffset) % 60

  return (
    toISODateString(date) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds()) +
    (tzOffset >= 0 ? '+' : '-') +
    (tzMinutes ? pad(tzHours) + ':' + pad(tzMinutes) : tzHours)
  )
}

export const timestamp = {
  ...new yaml.Document().schema.knownTags['tag:yaml.org,2002:timestamp'],
  stringify({ value }) {
    return toISOString(value)
  },
}
