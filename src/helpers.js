export function sortBy(keyFn) {
  return (a, b) => {
    const keyA = keyFn(a)
    const keyB = keyFn(b)
    if (keyA < keyB) return -1
    if (keyA > keyB) return 1
    return 0
  }
}

export function memoObject(fn) {
  const cache = new WeakMap()
  return (value) => {
    let r = cache.get(value)
    if (!r) {
      r = fn(value)
      cache.set(value, r)
    }
    return r
  }
}
export function addToMap(map, key, value) {
  if (!map.has(key)) {
    map.set(key, [value])
  } else {
    map.get(key).push(value)
  }
}
