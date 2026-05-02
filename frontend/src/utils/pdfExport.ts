import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PdfColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

interface ExportPdfOptions<T> {
  title: string;
  fileName: string;
  columns: PdfColumn<T>[];
  rows: T[];
}

export function exportTableToPdf<T>({ title, fileName, columns, rows }: ExportPdfOptions<T>) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(14);
  doc.text(title, 40, 36);

  const head = [columns.map((column) => column.header)];
  const body = rows.map((row) =>
    columns.map((column) => {
      const raw = column.accessor(row);
      if (raw === null || raw === undefined) return '-';
      const text = String(raw).trim();
      return text || '-';
    })
  );

  autoTable(doc, {
    startY: 50,
    head,
    body,
    styles: {
      fontSize: 9,
      cellPadding: 4,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 30, right: 30 },
  });

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}
