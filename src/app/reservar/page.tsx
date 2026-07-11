import { Suspense } from "react";
import { ReservarClient } from "@/components/public-booking/reservar-client";

// useSearchParams (inside ReservarClient) requires a Suspense boundary for
// this to build as a static page under `output: "export"` — see
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md.
export default function ReservarPage() {
  return (
    <Suspense fallback={null}>
      <ReservarClient />
    </Suspense>
  );
}
