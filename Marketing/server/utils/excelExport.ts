import ExcelJS from "exceljs";

export async function generateExcelBuffer({
  data,
  reportType,
  filename,
}: {
  data: any[];
  reportType: string;
  filename: string;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(reportType);

  if (data.length > 0) {
    const columns = Object.keys(data[0]);
    worksheet.columns = columns.map((key) => ({ header: key, key, width: 20 }));
    data.forEach((row) => worksheet.addRow(row));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
