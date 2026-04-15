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

  // Build a human-readable identity for this specific element so the log is useful
  // even in React 19 where _debugSource is unavailable.
  const identity =
    payload.nearestLabel ||
    payload.placeholder ||
    payload.ariaLabel ||
    payload.text ||
    payload.selector ||
    "(unknown)";

  const where = payload.file
    ? `${payload.file}:${payload.line}`
    : "(no source)";

  // Single compact line so it's greppable without overwhelming stdout
  console.log(
    "[code-grab]",
    where,
    `<${payload.tag}${payload.type ? `[type=${payload.type}]` : ""}>`,
    `"${identity}"`,
    payload.nearestHeading ? `under "${payload.nearestHeading}"` : "",
    payload.componentStack?.[0] ? `in <${payload.componentStack[0]}>` : "",
  );

  return NextResponse.json({ ok: true });
}
