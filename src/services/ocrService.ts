import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractTextFromPdf(file: File, onProgress: (progress: number, text: string) => void): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  const worker = await createWorker('eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        onProgress(m.progress * 100, `OCR in progress...`);
      }
    }
  });

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress((i / pdf.numPages) * 100, `Processing Page ${i}/${pdf.numPages}`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Some versions of pdfjs require 'canvasContext' and 'viewport', some also 'canvas'
    await page.render({ 
      canvasContext: context!, 
      viewport,
      canvas: canvas,
    }).promise;
    
    const { data: { text } } = await worker.recognize(canvas);
    fullText += `--- Page ${i} ---\n${text}\n\n`;
  }

  await worker.terminate();
  return fullText;
}
