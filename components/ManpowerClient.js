"use client";
import { useSearchParams } from "next/navigation";
import ManpowerTable from "./ManpowerTable";

export default function ManpowerClient({ initial }) {
  // Make the table remount whenever the query params change so it fetches fresh data
  const searchParams = useSearchParams();
  const key = searchParams ? searchParams.toString() : "";
  return <ManpowerTable key={key} initial={initial} />;
}
