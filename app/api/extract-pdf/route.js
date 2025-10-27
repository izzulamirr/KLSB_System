import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";

// POST - Extract text from PDF
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse PDF and extract text
    const data = await pdfParse(buffer);
    
    return NextResponse.json({
      text: data.text,
      numPages: data.numpages,
      info: data.info,
    });
  } catch (error) {
    console.error("PDF extraction error:", error);
    return NextResponse.json(
      { error: "Failed to extract PDF text", details: error.message },
      { status: 500 }
    );
  }
}
