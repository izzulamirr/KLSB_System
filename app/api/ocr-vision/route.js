import { NextResponse } from "next/server";
import vision from "@google-cloud/vision";
import path from "path";

const localCredentialsPath = path.join(process.cwd(), "secrets", "klsb-service-account.json");

// Initialize Google Cloud Vision client
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || localCredentialsPath,
});

export async function POST(request) {
  try {
    const { image } = await request.json();
    
    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Remove data URL prefix if present
    const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
    
    // Perform text detection
    const [result] = await client.textDetection({
      image: { content: base64Image },
    });

    const detections = result.textAnnotations;
    const text = detections && detections.length > 0 ? detections[0].description : "";

    // A blank/unreadable image legitimately returns no annotations from
    // Vision — surface that as a failure rather than a 200 with empty text,
    // so callers can prompt for a retry/manual entry instead of treating it
    // as a successful (but empty) OCR read.
    if (!text) {
      return NextResponse.json(
        { error: "No text detected in image", text: "", confidence: 0, detections: 0 },
        { status: 422 }
      );
    }

    // Get confidence scores
    const confidence = result.fullTextAnnotation?.pages?.[0]?.confidence || 0;

    return NextResponse.json({
      text,
      confidence,
      detections: detections?.length || 0,
    });
  } catch (error) {
    console.error("Google Vision OCR error:", error);
    return NextResponse.json(
      { error: "OCR processing failed", details: error.message },
      { status: 500 }
    );
  }
}
