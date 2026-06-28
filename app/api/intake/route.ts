import { NextResponse } from "next/server";
import { buildIntakeResponse, sampleIntakeResponse, type IntakeFile } from "@/lib/intake";
import { persistActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(sampleIntakeResponse());
}

export async function POST(request: Request) {
  const form = await request.formData();
  const files: IntakeFile[] = [];

  for (const value of form.getAll("files")) {
    if (typeof value === "object" && value !== null && "name" in value && "size" in value) {
      const file = value as File;
      files.push({ name: file.name, size: file.size, type: file.type });
    }
  }

  const intake = buildIntakeResponse(files);
  const activity = await persistActivity({
    kind: "intake",
    summary: `${intake.accepted}/${intake.received} uploaded finance documents classified`,
    details: {
      accepted: intake.accepted,
      received: intake.received,
      coverage: intake.coverage,
      ready_for_close: intake.ready_for_close,
      files: intake.files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        kind: file.kind,
        confidence: file.confidence,
      })),
    },
  });

  return NextResponse.json({
    ...intake,
    activity_id: activity.activity_id,
    persisted_via: activity.db_mode,
  });
}
