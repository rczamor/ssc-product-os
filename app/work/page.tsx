import { getLatestFridayUpdate, getWorkBoard } from "@/lib/db/queries";
import WorkBoard from "@/components/WorkBoard";

export const dynamic = "force-dynamic";

export default async function WorkPage() {
  const [board, fridayUpdate] = await Promise.all([getWorkBoard(), getLatestFridayUpdate()]);

  return (
    <WorkBoard
      issues={board.issues}
      lastSyncedAt={board.lastSyncedAt ? board.lastSyncedAt.toISOString() : null}
      fridayUpdate={fridayUpdate}
    />
  );
}
