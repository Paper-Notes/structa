function editDistance(a: string, b: string) {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    const current = [i]
    for (let j = 1; j <= right.length; j++) current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1))
    previous = current
  }
  return previous[right.length]
}

export function closest(word: string, candidates: Iterable<string>) {
  const tolerance = Math.max(2, Math.floor(word.length / 3))
  let best: string | null = null
  let bestDistance = Infinity
  for (const candidate of candidates) {
    const distance = editDistance(word, candidate)
    if (distance < bestDistance) [best, bestDistance] = [candidate, distance]
  }
  return bestDistance <= tolerance ? best : null
}
