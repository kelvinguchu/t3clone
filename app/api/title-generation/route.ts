import { NextRequest, NextResponse } from "next/server";
import { generateThreadTitle } from "@/lib/title-generator";

export async function POST(request: NextRequest) {
  try {
    const { text, maxLength } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required and must be a string" },
        { status: 400 },
      );
    }

    const title = await generateThreadTitle(text, maxLength);

    return NextResponse.json({ title });
  } catch (error) {
    console.error("Title generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate title" },
      { status: 500 },
    );
  }
}
