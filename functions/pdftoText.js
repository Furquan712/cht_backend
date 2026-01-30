// Convert a PDF file to plain text using pdfjs-dist (reliable, works with scanned/digital PDFs)
// For scanned PDFs with no text layer, falls back to Tesseract.js OCR
const fs = require('fs').promises;
const path = require('path');

async function convertPdfToText(pdfPath) {
  if (!pdfPath) throw new Error('pdfPath is required');

  try {
    const data = await fs.readFile(pdfPath);
    
    // Use pdfjs-dist to extract text (works reliably in Node)
    // pdfjs-dist uses ESM, so we need dynamic import
    let pdfjsLib;
    try {
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    } catch (e) {
      throw new Error('pdfjs-dist not installed. Run: npm install pdfjs-dist. Error: ' + e.message);
    }

    // Convert Buffer to Uint8Array as required by pdfjs-dist
    const uint8Array = new Uint8Array(data);

    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    
    console.log(`PDF has ${numPages} page(s)`);
    
    let fullText = '';
    let hasText = false;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      
      
      if (pageText.trim().length > 0) {
        hasText = true;
        fullText += `\n ${pageText}\n`;
      }
    }
    

    // If PDF has no text layer (scanned), fall back to OCR
    if (!hasText || fullText.trim().length < 50) {
      fullText = await extractTextViaOCR(pdfPath, pdf, numPages);
    }

    return fullText;
  } catch (err) {
    throw new Error('Failed to read/parse PDF: ' + err.message);
  }
}

// OCR fallback using Tesseract.js for scanned PDFs
async function extractTextViaOCR(pdfPath, pdf, numPages) {
  let tesseract, Canvas;
  try {
    tesseract = require('tesseract.js');
    Canvas = require('canvas');
  } catch (e) {
    throw new Error('OCR dependencies missing. Run: npm install tesseract.js canvas');
  }

  const { createWorker } = tesseract;
  const worker = await createWorker('eng');

  let ocrText = '';

  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      console.log(`OCR processing page ${pageNum}/${numPages}...`);
      
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      
      const canvas = Canvas.createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      await page.render({ canvasContext: context, viewport }).promise;
      
      const imageBuffer = canvas.toBuffer('image/png');
      const { data: { text } } = await worker.recognize(imageBuffer);
      
      ocrText += text + '\n\n';
    }
  } finally {
    await worker.terminate();
  }

  return ocrText;
}

// Simple main for testing: node functions/pdftoText.js /path/to/file.pdf
async function main() {
  const pdfPath = process.argv[2] || './test.pdf';
  try {
    const text = await convertPdfToText(pdfPath);
    console.log('--- Extracted text (ALL content) ---');
    console.log(text);
    console.log('\n--- end ---');
    return text;
  } catch (err) {
    console.error('Error in convertPdfToText.main:', err.message || err);
    throw err;
  }
}

if (require.main === module) {
  main().catch(err => process.exit(1));
}

module.exports = { convertPdfToText, main };