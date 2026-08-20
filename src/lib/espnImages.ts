// ESPN image URLs that are built rather than looked up.
//
// Shared so the generated roster files don't each carry a copy - see
// scripts/sync-players.mjs, which writes three of them.
export function espnHeadshot(espnId: string): string {
  // The "full" cut is a 1040x760 transparent PNG framed at the
  // shoulders, which is why these are drawn cropped to a square rather
  // than fitted inside one - see the portrait branch in TierItemChip.
  return `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`;
}
