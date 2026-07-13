import { NextResponse } from "next/server";
import initAdmin from "../../../../lib/firebaseAdmin";
import { isBdRole, isSysdevRole, resolveUserRole } from "../../../../lib/roleResolver";
import { sendProposalCreationEmail } from "../../../../lib/emailService";
import { getPicEmails } from "../../../../lib/picEmailMap";
import { filterEmailNotificationRecipients } from "../../../../lib/notificationPreferences";

async function authorizeBd(req) {
  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.replace("Bearer ", "");
  if (!idToken) throw new Error("No ID token provided");

  const admin = await initAdmin();
  const decoded = await admin.auth().verifyIdToken(idToken);
  const role = await resolveUserRole(admin, decoded);
  if (!isBdRole(role) && !isSysdevRole(role)) throw new Error("Forbidden");

  return { admin, decoded };
}

function getCollectionName() {
  return process.env.BD_PROPOSALS_COLLECTION || "bd_proposals";
}

function getActorLabel(decoded) {
  return String(decoded?.email || decoded?.name || decoded?.uid || "Unknown").trim();
}

function buildRemarksAudit(payload, existingDoc, decoded, admin) {
  const remarks = String(payload?.remarks || "").trim();
  if (!remarks) return payload;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const actor = getActorLabel(decoded);
  const nextPayload = {
    ...payload,
    remarksUpdatedAt: now,
    remarksUpdatedBy: actor,
  };

  if (existingDoc?.remarksCreatedAt && existingDoc?.remarksCreatedBy) {
    nextPayload.remarksCreatedAt = existingDoc.remarksCreatedAt;
    nextPayload.remarksCreatedBy = existingDoc.remarksCreatedBy;
  } else {
    nextPayload.remarksCreatedAt = now;
    nextPayload.remarksCreatedBy = actor;
  }

  return nextPayload;
}

function normalizePayload(body) {
  const numericFields = ["bidValidity", "valueRM", "year"];
  // createdBy/createdAt are server-assigned provenance fields — never accept
  // them from the client, on either create or update.
  const ignoredFields = ["maturityDays", "createdBy", "createdAt"];
  const out = {};

  for (const [key, value] of Object.entries(body || {})) {
    if (ignoredFields.includes(key)) continue;
    if (key === "googleFolderLink") {
      out[key] = String(value || "").trim();
      continue;
    }
    if (value === null || value === undefined) continue;
    if (numericFields.includes(key)) {
      if (value === "") { out[key] = null; continue; }
      const num = Number(value);
      if (!Number.isNaN(num)) out[key] = num;
      continue;
    }
    // Keep explicit empty strings (rather than skipping them) so clearing a
    // field in the edit form actually persists the clear via merge:true.
    out[key] = value;
  }

  if (!out.status) out.status = "PENDING";
  return out;
}

export async function GET(req) {
  try {
    const { admin } = await authorizeBd(req);
    const db = admin.firestore();

    let id = null;
    try {
      const url = new URL(req.url);
      id = url.searchParams.get("id");
    } catch {
      const host = req.headers.get("host") || "localhost";
      const url = new URL(req.url, `http://${host}`);
      id = url.searchParams.get("id");
    }

    if (id) {
      const doc = await db.collection(getCollectionName()).doc(id).get();
      if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ id: doc.id, ...doc.data() });
    }

    const snapshot = await db.collection(getCollectionName()).orderBy("createdAt", "desc").get();
    const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(rows);
  } catch (error) {
    const status = error.message === "No ID token provided" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function POST(req) {
  try {
    const { admin, decoded } = await authorizeBd(req);
    const db = admin.firestore();
    const body = await req.json();

    const validationError = validateRequiredFields(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const payload = buildRemarksAudit(normalizePayload(body), null, decoded, admin);

    const docRef = await db.collection(getCollectionName()).add({
      ...payload,
      createdBy: decoded.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: decoded.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send notification email to PICs
    if (payload.personInCharge) {
      try {
        const picEmails = await filterEmailNotificationRecipients(getPicEmails(payload.personInCharge));
        if (picEmails.length > 0) {
          const proposalData = {
            id: docRef.id,
            ...payload,
          };
          await sendProposalCreationEmail(proposalData, picEmails);

          // Log email notification
          await db.collection("email_notifications_log").add({
            proposalId: docRef.id,
            proposalRefNo: payload.refNo,
            notificationType: "proposal_created",
            personInCharge: payload.personInCharge,
            picEmails: picEmails,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "sent",
          });
        }
      } catch (emailError) {
        console.error("Failed to send proposal creation email:", emailError);
        // Don't fail the entire request if email fails
      }
    }

    return NextResponse.json({ id: docRef.id }, { status: 201 });
  } catch (error) {
    const status = error.message === "No ID token provided" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

function timestampToMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value._seconds === "number") {
    return value._seconds * 1000 + Math.round((value._nanoseconds || 0) / 1e6);
  }
  if (typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.round((value.nanoseconds || 0) / 1e6);
  }
  return null;
}

function validateRequiredFields(data) {
  if (!String(data?.refNo || "").trim()) return "Ref No. is required.";
  if (!String(data?.titleProjectName || "").trim()) return "Title / Project is required.";
  if (!String(data?.client || "").trim()) return "Client is required.";
  return null;
}

export async function PUT(req) {
  try {
    const { admin, decoded } = await authorizeBd(req);
    const db = admin.firestore();
    const body = await req.json();
    const { id, expectedUpdatedAt, ...data } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const validationError = validateRequiredFields(data);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const docRef = db.collection(getCollectionName()).doc(id);
    const existingDoc = await docRef.get();
    if (!existingDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const currentMillis = timestampToMillis(existingDoc.data()?.updatedAt);
    const expectedMillis = timestampToMillis(expectedUpdatedAt);
    if (currentMillis !== null && expectedMillis !== null && currentMillis !== expectedMillis) {
      return NextResponse.json(
        { error: "This proposal was updated by someone else. Reload the page and try again.", code: "CONFLICT" },
        { status: 409 }
      );
    }

    const payload = buildRemarksAudit(normalizePayload(data), existingDoc.data(), decoded, admin);
    await docRef.set(
      {
        ...payload,
          maturityDays: admin.firestore.FieldValue.delete(),
        updatedBy: decoded.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error.message === "No ID token provided" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(req) {
  try {
    const { admin, decoded } = await authorizeBd(req);
    const db = admin.firestore();
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const docRef = db.collection(getCollectionName()).doc(body.id);
    const existingDoc = await docRef.get();
    if (!existingDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.collection("bd_proposals_deletions_log").add({
      proposalId: body.id,
      proposalRefNo: existingDoc.data()?.refNo || "",
      proposalSnapshot: existingDoc.data(),
      deletedBy: getActorLabel(decoded),
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await docRef.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error.message === "No ID token provided" ? 401 : error.message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
