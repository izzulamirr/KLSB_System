import InvoicingClient from "../../../components/InvoicingClient";

export const metadata = { title: "Invoicing | KLSB Portal" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function InvoicingPage() {
  return <InvoicingClient />;
}
