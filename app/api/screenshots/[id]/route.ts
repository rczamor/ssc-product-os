import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { screenshots } from "@/lib/db/schema";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "screenshot not found" }, { status: 404 });
  }
  const db = await getDb();
  const [row] = await db
    .select({ data: screenshots.data, contentType: screenshots.contentType })
    .from(screenshots)
    .where(eq(screenshots.id, id));
  if (!row?.data) {
    return NextResponse.json({ error: "screenshot not found" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
