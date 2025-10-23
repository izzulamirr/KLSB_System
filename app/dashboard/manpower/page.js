// app/dashboard/manpower/page.js

import { getManpowerData } from "@/lib/manpower";
import ManpowerCsvUploader from "@/components/ManpowerCsvUploader";

// Column headers for the table
const columns = [
  "BIL", "Staff Name", "Position", "Status", "Location",
  "PO/SO No", "Start Date", "End Date", "Rate", "OT"
];

// The keys from your mapSheetToManpower function
const dataKeys = [
  "BIL", "STAFF_NAME", "POSITION", "STATUS", "LOCATION",
  "PO_SO_No", "START_DATE", "END_DATE", "Rate", "OT"
];

export default async function ManpowerPage() {
  const rows = await getManpowerData();
  
  // --- DEBUGGING ---
  // This will print to your SERVER terminal (where you run "npm run dev")
  console.log(`[Manpower Page] Loaded ${rows.length} rows.`);
  if (rows.length > 0) {
    console.log("[Manpower Page] First row:", rows[0]);
  }
  // --- END DEBUGGING ---

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4 text-white">
        Manpower Database
      </h1>
      {/* CSV uploader (client) */}
      <div>
        <ManpowerCsvUploader />
      </div>
      <p className="text-sm text-gray-400 mb-4">
        {rows.length} records loaded from {process.env.MANPOWER_SOURCE || "default"}.
      </p>

  <div className="show-scrollbar overflow-x-auto rounded-lg shadow-md max-w-full">
        <table className="min-w-max w-full table-auto text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-gray-700">
            <tr>
              {/* Map over our DISPLAY column names */}
              {columns.map((col) => (
                <th key={col} scope="col" className="px-4 py-3 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="bg-gray-800 border-b border-gray-700">
                <td colSpan={columns.length} className="px-4 py-4 text-center text-gray-500">
                  No manpower data found.
                </td>
              </tr>
            ) : (
              // Map over the data rows
              rows.map((row, index) => (
                <tr key={index} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                  
                  {/* Map over the DATA keys to pull the correct value */}
                  {dataKeys.map((key) => (
                    <td 
                      key={key} 
                      className={`px-4 py-3 whitespace-nowrap ${key === 'STAFF_NAME' ? 'font-medium text-white' : ''}`}
                    >
                      {row[key]}
                    </td>
                  ))}

                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}