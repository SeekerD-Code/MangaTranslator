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
    const textAnnotations = data.responses[0]?.textAnnotations;

    if (!textAnnotations || textAnnotations.length <= 1) {
      return [];
    }

    const rawBlocks = [];

    // textAnnotations[0] è il blocco generale con tutto il testo.
    // Dal secondo elemento in poi (i >= 1), abbiamo ogni singola parola o simbolo con le sue coordinate precise.
    for (let i = 1; i < textAnnotations.length; i++) {
      const annotation = textAnnotations[i];
      const wordText = annotation.description;
      const vertices = annotation.boundingPoly?.vertices || [];

      if (vertices.length === 0) continue;

      const xCoords = vertices.map(v => v.x || 0);
      const yCoords = vertices.map(v => v.y || 0);

      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);

      rawBlocks.push({
        text: wordText,
        x: minX,
        y: minY,
        maxX: maxX,
        maxY: maxY,
        width: maxX - minX,
        height: maxY - minY
      });
    }

    // 2. Unificazione intelligente delle parole vicine nello stesso balloon (Clustering spaziale)
    // Usiamo soglie strette (es. 10px / 15px) così le parole della stessa nuvoletta si uniscono,
    // ma le nuvolette separate non vengono mai mescolate.
    const mergedBlocks = this.clusterNearBlocks(rawBlocks, 10, 15);

    return mergedBlocks;
  }

  /**
   * Unisce i blocchi di testo che si trovano vicini nello spazio (stesso baloon/vignetta).
   * @param {Array} blocks - Elenco dei blocchi grezzi.
   * @param {number} maxThresholdX - Distanza massima orizzontale in px tra righe vicine.
   * @param {number} maxThresholdY - Distanza massima verticale in px tra righe vicine.
   */
  static clusterNearBlocks(blocks, maxThresholdX = 10, maxThresholdY = 15) {
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