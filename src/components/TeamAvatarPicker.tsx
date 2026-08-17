import { TEAMS_SORTED, Team } from "@/data/teams";

// A grid of all 32 team logos on their own team color - used both by
// EditProfileModal (pick a preset any time) and AvatarPromptGate (pick
// one during onboarding). Selecting a team just hands its logo URL back
// to the caller - there's no upload step, the logo is already a stable
// public CDN URL (see setPresetAvatar in lib/supabase/profile.ts).
export function TeamAvatarPicker({ onSelect, selectedLogo }: { onSelect: (team: Team) => void; selectedLogo?: string | null }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {TEAMS_SORTED.map((team) => {
        const selected = selectedLogo === team.logo;
        return (
          <button
            key={team.abbr}
            type="button"
            onClick={() => onSelect(team)}
            title={`${team.city} ${team.name}`}
            aria-label={`${team.city} ${team.name}`}
            className={`relative aspect-square rounded-full flex items-center justify-center transition-transform active:scale-90 ${
              selected ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0b1730]" : ""
            }`}
            style={{ background: team.color }}
          >
            <img src={team.logo} alt="" className="h-[60%] w-[60%] object-contain" />
          </button>
        );
      })}
    </div>
  );
}
