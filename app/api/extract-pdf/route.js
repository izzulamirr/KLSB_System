import { NextResponse } from "next/server";

// POST - PDF extraction endpoint
// Note: pdfjs-dist has compatibility issues with Next.js 15 server-side
// Return instruction for client to handle PDF with OCR instead
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log(`PDF received: ${file.name}, redirecting to client-side processing`);
    
    // Return a special flag to tell client to use PDF.js + OCR
    return NextResponse.json({
      useClientSideOCR: true,
      message: "Please use client-side PDF rendering with OCR",
      numPages: 0,
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
