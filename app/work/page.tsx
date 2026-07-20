import { getLatestFridayUpdate, getWorkBoard } from "@/lib/db/queries";
import { isLinearConfigured } from "@/lib/linear";
import WorkBoard from "@/components/WorkBoard";
import FridayUpdate from "@/components/FridayUpdate";

export const dynamic = "force-dynamic";

export default async function WorkPage() {
  const [board, fridayUpdate] = await Promise.all([getWorkBoard(), getLatestFridayUpdate()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-ink">Work</h1>
        <p className="mt-1 text-sm text-ink-4">
          The SSC-ProductOS Linear board, cached server-side. External = the product work
          drafted from approved matrices; internal = the product-OS build plus the 30-day role
          operating plan.
        </p>
      </div>

      {!isLinearConfigured() && (
        <div className="rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber-dark">
          <code>LINEAR_API_KEY</code> is not set in this environment — the board shows whatever was
          last cached. Set the key (Vercel env / <code>.env.local</code>) to sync live and to push
          approved matrices.
        </div>
      )}

      <WorkBoard
        issues={board.issues}
        lastSyncedAt={board.lastSyncedAt ? board.lastSyncedAt.toISOString() : null}
        issueCount={board.issueCount}
      />

      <FridayUpdate
        update={fridayUpdate}
        boardLastSyncedAt={board.lastSyncedAt ? board.lastSyncedAt.toISOString() : null}
      />
    </div>
  );
}
