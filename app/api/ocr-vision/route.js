import { NextResponse } from "next/server";
import vision from "@google-cloud/vision";

// Initialize Google Cloud Vision client
const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || "./secrets/klsb-service-account.json",
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
