import { redirect } from "next/navigation";

// /predictor with no team is what existing links/bookmarks point at -
// send them to the Cowboys page rather than 404ing now that every team
// lives under its own /predictor/[team] route.
export default function PredictorIndexPage() {
  redirect("/predictor/dal");
}
