import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { runRequests } from "@/lib/db/schema";
import { CreateRunRequestSchema } from "@/lib/schemas/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(runRequests)
    .orderBy(desc(runRequests.createdAt))
    .limit(50);
  return NextResponse.json({ runRequests: rows });
}

export async function POST(req: NextRequest) {
  const body = CreateRunRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "invalid request", issues: body.error.issues },
      { status: 400 },
    );
  }
  const db = await getDb();
  const [row] = await db
    .insert(runRequests)
    .values({
      personas: body.data.personas,
      note: body.data.note,
      requestedBy: "admin-ui",
    })
    .returning();
  return NextResponse.json({ runRequest: row }, { status: 201 });
}
