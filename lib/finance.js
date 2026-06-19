import { buildFinanceData, readInvoiceRows } from "./invoiceStore";

export async function getFinanceData() {
  const rows = await readInvoiceRows();
  return buildFinanceData(rows);
}
