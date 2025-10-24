import { NextResponse } from "next/server";
import admin from "../../../lib/firebaseAdmin";

const db = admin.firestore();

// GET - Fetch all timesheet records
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // Get single record
    if (id) {
      const doc = await db.collection("timesheets").doc(id).get();
      if (!doc.exists) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ id: doc.id, ...doc.data() });
    }

    // Get all records
    const snapshot = await db.collection("timesheets").orderBy("uploadedAt", "desc").get();
    const timesheets = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      
      // If entries exist, flatten them into individual records
      if (data.entries && Array.isArray(data.entries)) {
        data.entries.forEach((entry, idx) => {
          timesheets.push({
            id: `${doc.id}_${idx}`,
            parentId: doc.id,
            date: entry.date || data.date,
            staffName: entry.staffName || data.staffName,
            poSoNo: entry.poSoNo || data.poSoNo,
            normalHours: entry.normalHours || 0,
            otHours: entry.otHours || 0,
            nhHours: entry.nhHours || 0,
            totalHours: entry.totalHours || (entry.normalHours || 0) + (entry.otHours || 0) + (entry.nhHours || 0),
            uploadedBy: data.uploadedBy,
            uploadedAt: data.uploadedAt,
          });
        });
      } else {
        // Single entry record
        timesheets.push({
          id: doc.id,
          date: data.date,
          staffName: data.staffName,
          poSoNo: data.poSoNo,
          normalHours: data.normalHours || 0,
          otHours: data.otHours || 0,
          nhHours: data.nhHours || 0,
          totalHours: data.totalHours || (data.normalHours || 0) + (data.otHours || 0) + (data.nhHours || 0),
          uploadedBy: data.uploadedBy,
          uploadedAt: data.uploadedAt,
        });
      }
    });

    return NextResponse.json(timesheets);
  } catch (error) {
    console.error("GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new timesheet record
export async function POST(request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.staffName) {
      return NextResponse.json({ error: "Staff name is required" }, { status: 400 });
    }

    // Prepare data
    const timesheetData = {
      staffName: body.staffName,
      poSoNo: body.poSoNo || "",
      date: body.date || new Date().toISOString().split("T")[0],
      normalHours: body.normalHours || 0,
      otHours: body.otHours || 0,
      nhHours: body.nhHours || 0,
      totalHours: (body.normalHours || 0) + (body.otHours || 0) + (body.nhHours || 0),
      entries: body.entries || [],
      rawText: body.rawText || "",
      needsManualReview: body.needsManualReview || false,
      uploadedBy: body.uploadedBy || "system",
      uploadedAt: body.uploadedAt || new Date().toISOString(),
    };

    // Add to Firestore
    const docRef = await db.collection("timesheets").add(timesheetData);
    
    return NextResponse.json({ 
      id: docRef.id, 
      ...timesheetData,
      message: "Timesheet created successfully" 
    }, { status: 201 });
  } catch (error) {
    console.error("POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update timesheet record
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Remove parent ID if it exists (for flattened entries)
    const actualId = id.includes("_") ? id.split("_")[0] : id;

    // Update document
    await db.collection("timesheets").doc(actualId).update({
      ...updateData,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ 
      id: actualId, 
      ...updateData,
      message: "Timesheet updated successfully" 
    });
  } catch (error) {
    console.error("PUT Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete timesheet record
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Remove parent ID if it exists (for flattened entries)
    const actualId = id.includes("_") ? id.split("_")[0] : id;

    await db.collection("timesheets").doc(actualId).delete();
    
    return NextResponse.json({ message: "Timesheet deleted successfully" });
  } catch (error) {
    console.error("DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
