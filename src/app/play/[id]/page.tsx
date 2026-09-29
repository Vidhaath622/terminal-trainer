import PlayClient from "@/components/PlayClient";
import { LAUNCH_PROBLEMS } from "@/problems/launch";

/** Pre-render every launch problem for static hosting. */
export function generateStaticParams(): { id: string }[] {
  return LAUNCH_PROBLEMS.map((p) => ({ id: p.id }));
}

export default function PlayPage({ params }: { params: { id: string } }) {
  return <PlayClient id={params.id} />;
}
