import { NextResponse } from "next/server";
import { buildIntakeResponse, sampleIntakeResponse, type IntakeFile } from "@/lib/intake";

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

  return NextResponse.json(buildIntakeResponse(files));
}
