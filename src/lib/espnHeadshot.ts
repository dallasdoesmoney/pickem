// ESPN keys headshots on the same player id the roster rows carry.
//
// Its own module rather than living beside PUZZLE_PLAYERS, because
// anything that only needs a URL should not pull three thousand players
// into its bundle to get one. PlayerFace is the caller that would have.
export function playerHeadshot(espnId: string): string {
  return `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`;
}
