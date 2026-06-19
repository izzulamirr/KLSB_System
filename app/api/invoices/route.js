import { NextResponse } from "next/server";
import { readInvoiceRows, writeInvoiceRows } from "../../../lib/invoiceStore";

export async function GET() {
  try {
    const rows = await readInvoiceRows();
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const saved = await writeInvoiceRows(rows);
    return NextResponse.json({ ok: true, rows: saved });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}