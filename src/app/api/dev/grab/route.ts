import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const payload = {
    ...body,
    capturedAt: new Date().toISOString(),
  };

  const file = path.join(process.cwd(), ".grab-selection.json");
  await writeFile(file, JSON.stringify(payload, null, 2), "utf8");

  console.log("[code-grab]", payload.file ? `${payload.file}:${payload.line}` : "(no source)", payload.componentStack);

  return NextResponse.json({ ok: true });
}
