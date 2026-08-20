// Where the header's back rail points, for any page on the site.
//
// The parent in the site's own hierarchy, not the last page you happened
// to visit. Those agree in the case that prompted this - home to weekly
// pick'em, then back to home - and they part company on a deep link,
// which is exactly where the literal-history version has nothing to go
// back to at all. A shared tier list, a bookmarked team page or a
// leaderboard profile out of a search result all arrive with an empty
// history, and those are a real share of the traffic here. The parent is
// always known, so the rail is never empty and its label never has to
// guess: it names the page the button actually goes to.
//
// Everything one level down from a section lands on that section
// (a team page on the predictor, a saved list on the tier lists), and
// every section lands on home, which is the page that fronts all four.
export type NavParent = { href: string; label: string };

const HOME: NavParent = { href: "/", label: "Home" };

// Labels match the nav's own wording for the same destinations - the
// rail should call a place what the menu calls it.
const SECTIONS: NavParent[] = [
  { href: "/weekly", label: "Pick’em" },
  { href: "/predictor", label: "Record Predictor" },
  { href: "/tier-lists", label: "Tier Lists" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function navParent(pathname: string): NavParent | null {
  // Trailing slashes come from links written by hand and from some
  // external referrers; "/weekly/" is the same page as "/weekly".
  const path = pathname.replace(/\/+$/, "") || "/";
  // Home has no parent, and a rail pointing at the page you are on is
  // worse than no rail.
  if (path === "/") return null;

  const section = SECTIONS.find((s) => path === s.href || path.startsWith(`${s.href}/`));
  // Pages outside the four sections - your profile, notifications, admin
  // - are reached from the account menu rather than from a section, so
  // home is the honest parent for them too.
  if (!section) return HOME;
  return path === section.href ? HOME : section;
}
