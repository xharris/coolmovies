/**
 *
 * @param c vote count
 * @param n total users
 * @param z confidence
 * @returns
 */
export const wilson_score_lower = (c: number, n: number, z: number = 1.96) => {
  if (n <= 0) {
    return 0
  }
  const p = c / n
  const numerator =
    p +
    z ** 2 / (2 * n) -
    z * Math.sqrt((p * (1 - p)) / n + z ** 2 / (4 * n ** 2))
  const denominator = 1 + z ** 2 / n
  return numerator / denominator
}
