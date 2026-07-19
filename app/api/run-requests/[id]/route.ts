import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { runRequests } from "@/lib/db/schema";
import { CancelRunRequestSchema } from "@/lib/schemas/api";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = CancelRunRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "only {status:'cancelled'} is supported" }, { status: 400 });
  }
  const db = await getDb();
  const rows = await db
    .update(runRequests)
    .set({ status: "cancelled" })
    .where(and(eq(runRequests.id, id), eq(runRequests.status, "queued")))
    .returning();
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "not found or not cancellable (only queued requests can be cancelled)" },
      { status: 409 },
    );
  }
  return NextResponse.json({ runRequest: rows[0] });
}
