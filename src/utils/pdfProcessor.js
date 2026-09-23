import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export async function processPDF(file, onProgress = () => {}) {
  try {
    onProgress('File received ?');
    const arrayBuffer = await file.arrayBuffer();

    onProgress('Opening PDF...');
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;
    onProgress('PDF opened ?');

    const numPages = pdfDoc.numPages;
    onProgress(`Pages detected: ${numPages}`);
    const canvases = [];

    const pagesToRender = Math.min(numPages, 12);

    onProgress(`Rendering ${pagesToRender} pages...`);
    for (let i = 1; i <= pagesToRender; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.7 });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      canvases.push(canvas);
    }
    onProgress('Page rendering ?');
    onProgress('Text extraction — OCR pending');

    return {
      name: file.name,
      size: file.size,
      pages: numPages,
      renderedCanvases: canvases,
      pdfDoc: pdfDoc
    };
  } catch (error) {
    console.error("Error processing PDF:", error);
    throw error;
  }
}
