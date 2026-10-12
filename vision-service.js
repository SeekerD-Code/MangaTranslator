/**
 * Servizio per l'estrazione del testo e delle coordinate tramite Google Cloud Vision API.
 */
export default class VisionService {
  /**
   * Esegue l'OCR su un'immagine in formato Base64 raggruppando il testo vicino per vignetta/baloon.
   * @param {string} base64Image - Immagine senza l'header data URL.
   * @param {string} apiKey - Key di Google Cloud Vision.
   * @returns {Promise<Array>} Array di blocchi di testo unificati per baloon con coordinate.
   */
  static async detectText(base64Image, apiKey) {
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.error?.message || response.statusText;
      throw new Error(`Google Vision Error: ${msg}`);
    }

    const data = await response.json();
    const fullTextAnnotation = data.responses[0]?.fullTextAnnotation;

    if (!fullTextAnnotation || !fullTextAnnotation.pages) {
      return [];
    }

    const rawBlocks = [];

    // 1. Estrazione di tutti i frammenti di paragrafo/frase
    fullTextAnnotation.pages.forEach(page => {
      page.blocks.forEach(block => {
        block.paragraphs.forEach(paragraph => {
          let paragraphText = '';

          paragraph.words.forEach(word => {
            const wordText = word.symbols.map(s => s.text).join('');
            paragraphText += wordText + ' ';
          });

          paragraphText = paragraphText.trim();

          if (paragraphText.length > 0) {
            const vertices = paragraph.boundingBox?.vertices || [];
            const xCoords = vertices.map(v => v.x || 0);
            const yCoords = vertices.map(v => v.y || 0);

            const minX = Math.min(...xCoords);
            const maxX = Math.max(...xCoords);
            const minY = Math.min(...yCoords);
            const maxY = Math.max(...yCoords);

            rawBlocks.push({
              text: paragraphText,
              x: minX,
              y: minY,
              maxX: maxX,
              maxY: maxY,
              width: maxX - minX,
              height: maxY - minY
            });
          }
        });
      });
    });

    // 2. Unificazione dei blocchi vicini nello stesso baloon (Clustering spaziale)
    const mergedBlocks = this.clusterNearBlocks(rawBlocks, 35, 45);

    return mergedBlocks;
  }

  /**
   * Unisce i blocchi di testo che si trovano vicini nello spazio (stesso baloon/vignetta).
   * @param {Array} blocks - Elenco dei blocchi grezzi.
   * @param {number} maxThresholdX - Distanza massima orizzontale in px tra righe vicine.
   * @param {number} maxThresholdY - Distanza massima verticale in px tra righe vicine.
   */
  static clusterNearBlocks(blocks, maxThresholdX = 35, maxThresholdY = 45) {
    if (blocks.length <= 1) return blocks;

    const clusters = [];
    const visited = new Array(blocks.length).fill(false);

    for (let i = 0; i < blocks.length; i++) {
      if (visited[i]) continue;

      let currentCluster = [blocks[i]];
      visited[i] = true;

      let addedNew = true;
      while (addedNew) {
        addedNew = false;
        for (let j = 0; j < blocks.length; j++) {
          if (visited[j]) continue;

          // Verifica se il blocco 'j' è vicino a qualsiasi blocco già presente nel 'currentCluster'
          const isNear = currentCluster.some(b => {
            const verticalDist = Math.max(0, b.y - blocks[j].maxY, blocks[j].y - b.maxY);
            const horizontalDist = Math.max(0, b.x - blocks[j].maxX, blocks[j].x - b.maxX);

            return verticalDist <= maxThresholdY && horizontalDist <= maxThresholdX;
          });

          if (isNear) {
            currentCluster.push(blocks[j]);
            visited[j] = true;
            addedNew = true;
          }
        }
      }

      // Ordina i blocchi all'interno dello stesso baloon dall'alto verso il basso (top to bottom)
      currentCluster.sort((a, b) => a.y - b.y);

      // Unisce testo e ricalcola il bounding box complessivo del baloon
      const mergedText = currentCluster.map(c => c.text).join(' ');
      const minX = Math.min(...currentCluster.map(c => c.x));
      const minY = Math.min(...currentCluster.map(c => c.y));
      const maxX = Math.max(...currentCluster.map(c => c.maxX));
      const maxY = Math.max(...currentCluster.map(c => c.maxY));

      clusters.push({
        text: mergedText,
        x: minX,
        y: minY,
        width: Math.max(50, maxX - minX),
        height: Math.max(20, maxY - minY)
      });
    }

    return clusters;
  }
}