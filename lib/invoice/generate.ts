import "server-only";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface InvoiceData {
  transactionId: string;
  subscriberName: string;
  amount: string;
  productInfo: string;
  date: string;
}

export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  const drawText = (
    text: string,
    x: number,
    y: number,
    font: typeof helveticaFont,
    size: number,
    color = rgb(0, 0, 0)
  ) => {
    page.drawText(text, { x, y, font, size, color });
  };

  drawText("AMAR UJALA", 50, height - 60, helveticaBold, 20, rgb(0.85, 0.05, 0.05));
  drawText("PAYMENT RECEIPT / INVOICE", 50, height - 90, helveticaBold, 18, rgb(0.1, 0.1, 0.4));

  drawText("Date: " + data.date, 50, height - 130, helveticaFont, 12);
  drawText("Transaction ID: " + data.transactionId, 50, height - 150, helveticaFont, 12);

  page.drawLine({
    start: { x: 50, y: height - 170 },
    end: { x: width - 50, y: height - 170 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  drawText("Billed To:", 50, height - 200, helveticaBold, 14);
  drawText(data.subscriberName, 50, height - 220, helveticaFont, 12, rgb(0.2, 0.2, 0.2));

  page.drawRectangle({
    x: 50,
    y: height - 280,
    width: width - 100,
    height: 30,
    color: rgb(0.95, 0.95, 0.95),
  });
  drawText("Description", 60, height - 270, helveticaBold, 12);
  drawText("Amount (INR)", width - 160, height - 270, helveticaBold, 12);

  drawText(data.productInfo, 60, height - 310, helveticaFont, 12);
  drawText("Rs. " + data.amount, width - 160, height - 310, helveticaFont, 12);

  page.drawLine({
    start: { x: 50, y: height - 340 },
    end: { x: width - 50, y: height - 340 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  drawText("Total Paid:", width - 250, height - 370, helveticaBold, 14);
  drawText("Rs. " + data.amount, width - 160, height - 370, helveticaBold, 14, rgb(0, 0.5, 0));

  drawText("Thank you for your payment!", 50, 100, helveticaFont, 12, rgb(0.4, 0.4, 0.4));
  page.drawLine({
    start: { x: 50, y: 80 },
    end: { x: width - 50, y: 80 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
