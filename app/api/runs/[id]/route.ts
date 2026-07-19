import { NextRequest, NextResponse } from "next/server";
import { getRunDetail } from "@/lib/db/queries";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }
  const detail = await getRunDetail(id);
  if (!detail) return NextResponse.json({ error: "run not found" }, { status: 404 });
  return NextResponse.json(detail);
}
