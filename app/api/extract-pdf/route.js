import { NextResponse } from "next/server";

// POST - PDF extraction endpoint (server-side)
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Load pdf-parse dynamically to keep it server-only.
    // pdf-parse v2 exposes a class API: new PDFParse(...).getText().
    const pdfParseModule = await import("pdf-parse");
    const PDFParse = pdfParseModule.PDFParse;

    if (typeof PDFParse !== "function") {
      throw new Error("pdf-parse v2 API not available (missing PDFParse export)");
    }

    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    let result;
    try {
      result = await parser.getText();
    } finally {
      await parser.destroy().catch(() => {});
    }

    const text = (result?.text || "").replace(/\u0000/g, "").trim();
    const numPages = Number(result?.total || 0);
    const pageTexts = Array.isArray(result?.pages)
      ? result.pages
          .map((page) => (page?.text || "").replace(/\u0000/g, "").trim())
          .filter((pageText) => pageText.length > 0)
      : [];

    console.log(`PDF extracted: ${file.name}, pages=${numPages}, textLength=${text.length}`);

    const looksScanned = text.length < 80;

    return NextResponse.json({
      text,
      numPages,
      pageTexts,
      looksScanned,
      message: looksScanned
        ? "Very little embedded text found. This PDF may be scanned and may need image OCR."
        : "PDF text extracted successfully",
    });
  } catch (error) {
    console.error("PDF extraction error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { 
        error: "Failed to extract PDF text", 
        details: error.message,
        type: error.name 
      },
      { status: 500 }
    );
  }
}
