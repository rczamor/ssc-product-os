import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { runRequests } from "@/lib/db/schema";
import { CancelRunRequestSchema } from "@/lib/schemas/api";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = CancelRunRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "only {status:'cancelled'} is supported" }, { status: 400 });
  }
  const db = await getDb();
  // A request can be cancelled while queued or claimed-but-not-yet-running.
  const rows = await db
    .update(runRequests)
    .set({ status: "cancelled" })
    .where(and(eq(runRequests.id, id), inArray(runRequests.status, ["queued", "claimed"])))
    .returning();
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "not found or not cancellable (only queued or claimed requests can be cancelled)" },
      { status: 409 },
    );
  }
  return NextResponse.json({ runRequest: rows[0] });
}
