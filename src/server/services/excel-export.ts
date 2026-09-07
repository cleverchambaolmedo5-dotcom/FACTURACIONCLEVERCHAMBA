import "server-only";
import ExcelJS from "exceljs";

// Shared .xlsx generation for every export button in the app (Cuentas
// bancarias/Movimientos and Ventas today). Kept generic and dependency-only
// on `exceljs` -- the only Excel-writing library in the project -- so no
// module reimplements its own workbook/response plumbing.

export type ExcelColumn<T> = {
  header: string;
  width?: number;
  // Returns the raw cell value -- a Date is written as a real Excel date
  // cell (via `numFmt`), not a formatted string, so it stays sortable/
  // filterable for whoever opens the file.
  value: (row: T) => string | number | Date | null;
  numFmt?: string;
};

/** Builds a single-sheet .xlsx workbook from plain rows and returns it as a Buffer. */
export async function buildXlsxFile<T>(
  sheetName: string,
  columns: ExcelColumn<T>[],
  rows: T[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CleverChamba";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = columns.map((column) => ({
    header: column.header,
    width: column.width ?? 22,
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(columns.map((column) => column.value(row)));
  }

  columns.forEach((column, index) => {
    if (column.numFmt) {
      sheet.getColumn(index + 1).numFmt = column.numFmt;
    }
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** Wraps an already-built .xlsx buffer as a downloadable Response. */
export function xlsxResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** "2026-09-07-143012" style timestamp for export filenames, in UTC to avoid depending on the server's local timezone. */
export function exportTimestamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}
