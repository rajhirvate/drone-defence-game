/** Keep the best local scores for one level, highest first. */
export function insertScore(list: readonly number[], score: number, limit = 5): number[] {
  if (!Number.isFinite(score) || score <= 0) return [...list].slice(0, limit)
  return [...list, Math.floor(score)].sort((a, b) => b - a).slice(0, limit)
}

export function bossReward(levelId: number): number {
  if (levelId % 10 !== 0) return 0
  return 30 + levelId * 2
}

export interface Career {
  kills: number
  bosses: number
  runs: number
  bestCombo: number
  coinsEarned: number
  dailies: number
  cleared: number
}

export interface AchievementDef {
  id: string
  name: string
  blurb: string
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first-blood', name: 'First Light', blurb: 'Shoot down a drone.' },
  { id: 'boss', name: 'Battery', blurb: 'Defeat a boss drone.' },
  { id: 'ten', name: 'Ten Roofs', blurb: 'Clear level 10.' },
  { id: 'fifty', name: 'Long Watch', blurb: 'Clear level 50.' },
  { id: 'hundred', name: 'Last Battery', blurb: 'Clear level 100.' },
  { id: 'daily', name: 'Today', blurb: 'Post a daily score.' },
  { id: 'combo', name: 'Streak', blurb: 'Reach a x8 combo.' },
  { id: 'coins', name: 'Purse', blurb: 'Earn 200 coins in total.' },
]

export function earnedIds(stats: Career): string[] {
  return ACHIEVEMENTS.filter((badge) => {
    if (badge.id === 'first-blood') return stats.kills >= 1
    if (badge.id === 'boss') return stats.bosses >= 1
    if (badge.id === 'ten') return stats.cleared >= 10
    if (badge.id === 'fifty') return stats.cleared >= 50
    if (badge.id === 'hundred') return stats.cleared >= 100
    if (badge.id === 'daily') return stats.dailies >= 1
    if (badge.id === 'combo') return stats.bestCombo >= 8
    return stats.coinsEarned >= 200
  }).map((badge) => badge.id)
}

/** Newly earned badge ids, in catalogue order. */
export function newBadges(stats: Career, owned: readonly string[]): string[] {
  const have = new Set(owned)
  return earnedIds(stats).filter((id) => !have.has(id))
}
