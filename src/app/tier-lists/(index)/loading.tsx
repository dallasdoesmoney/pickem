import { RouteLoading } from "@/components/RouteLoading";

// In a route group, so it covers this index page and NOT the pages nested
// under it.
//
// A loading.tsx is a Suspense boundary around everything below it, which
// means the prerendered HTML for every page in the segment is this spinner.
// That is right for an index that fetches its own data on the client, and
// exactly wrong for the pages underneath, which are statically generated
// from data already on the server. The route group is URL-transparent -
// only the boundary moved.
export default function Loading() {
  return <RouteLoading label="Tier Lists" />;
}
