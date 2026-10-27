import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { getMemberContext } from "@/lib/auth";

export default async function EventsLayout({ children }: { children: React.ReactNode }) {
  await getMemberContext();
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-6 pt-3"><PresenceHeartbeat /></div>
      {children}
    </>
  );
}
