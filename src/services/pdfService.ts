import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { PDFDocument } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface CompressionOptions {
  quality: number; // 0.1 to 1.0
  scale: number; // 0.5 to 2.0
  merge: boolean;
  onProgress: (progress: number, currentFile: string) => void;
}

export async function processPdfs(files: File[], options: CompressionOptions): Promise<{ blob: Blob, name: string }[]> {
  const { quality, scale, merge, onProgress } = options;
  
  let totalPages = 0;
  const pdfDocs = [];
  
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPages += pdf.numPages;
    pdfDocs.push({ file, pdf });
  }

  let pagesProcessed = 0;
  
  if (merge) {
    const mergedPdf = await PDFDocument.create();
    
    for (const { file, pdf } of pdfDocs) {
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ 
          canvasContext: context!, 
          viewport,
          canvas: canvas
        }).promise;
        
        const imgData = canvas.toDataURL('image/jpeg', quality);
        const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
        
        const img = await mergedPdf.embedJpg(imgBytes);
        const newPage = mergedPdf.addPage([viewport.width, viewport.height]);
        newPage.drawImage(img, {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
        });
        
        pagesProcessed++;
        onProgress((pagesProcessed / totalPages) * 100, `Processing ${file.name} (Page ${i}/${pdf.numPages})`);
      }
    }
    
    const mergedBytes = await mergedPdf.save();
    return [{ blob: new Blob([mergedBytes as any], { type: 'application/pdf' }), name: 'merged_compressed.pdf' }];
  } else {
    const results = [];
    for (const { file, pdf } of pdfDocs) {
      const newPdf = await PDFDocument.create();
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ 
          canvasContext: context!, 
          viewport,
          canvas: canvas
        }).promise;
        
        const imgData = canvas.toDataURL('image/jpeg', quality);
        const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
        
        const img = await newPdf.embedJpg(imgBytes);
        const newPage = newPdf.addPage([viewport.width, viewport.height]);
        newPage.drawImage(img, {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
        });
        
        pagesProcessed++;
        onProgress((pagesProcessed / totalPages) * 100, `Processing ${file.name} (Page ${i}/${pdf.numPages})`);
      }
      const bytes = await newPdf.save();
      results.push({ blob: new Blob([bytes as any], { type: 'application/pdf' }), name: `compressed_${file.name}` });
    }
    return results;
  }
}
