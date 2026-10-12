// translation-controller.js
import { state } from './state.js';
import { switchPage, renderThumbnails } from './pages-manager.js';
import TranslationService from './translation-service.js';
import VisionService from './vision-service.js';

function decodeHTMLEntities(text) {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

export function initTranslationController(canvasService) {
  const btnTranslateMain = document.getElementById('btnTranslateCurrent');
  if (!btnTranslateMain) return;

  btnTranslateMain.addEventListener('click', async () => {
    const googleKey = document.getElementById('googleKey')?.value.trim();
    if (!googleKey) return alert("Inserisci la Google Cloud API Key prima di procedere.");
    if (state.pagesData.length === 0) return alert("Carica prima almeno un'immagine.");

    let indicesToTranslate = state.selectedPageIndices.size > 0
      ? Array.from(state.selectedPageIndices)
      : [state.currentPageIndex];

    const originalText = btnTranslateMain.textContent;
    btnTranslateMain.disabled = true;

    for (let i = 0; i < indicesToTranslate.length; i++) {
      const pageIndex = indicesToTranslate[i];
      btnTranslateMain.textContent = `Traduzione in corso (${i + 1}/${indicesToTranslate.length})...`;

      await switchPage(pageIndex, canvasService);

      const base64Image = state.pagesData[pageIndex].dataUrl.split(',')[1];
      try {
        const textBlocks = await VisionService.detectText(base64Image, googleKey);
        const sourceLang = document.getElementById('sourceLang')?.value;
        const targetLang = document.getElementById('targetLang')?.value;
        const font = document.getElementById('fontFamily')?.value;
        const fontSize = parseInt(document.getElementById('fontSize')?.value || '18', 10);
        const bgColor = document.getElementById('bgColor')?.value;

        if (textBlocks && textBlocks.length > 0) {
          for (const block of textBlocks) {
            const rawTranslatedText = await TranslationService.translateText(
              block.text, sourceLang, targetLang, googleKey
            );
            const cleanText = decodeHTMLEntities(rawTranslatedText);

            canvasService.addTextbox(cleanText, {
              x: block.x,
              y: block.y,
              width: block.width,
              height: block.height,
              fontFamily: font,
              fontSize: fontSize,
              bgColor: bgColor
            });
          }
        }
        state.pagesData[pageIndex].jsonState = canvasService.exportJSON();
      } catch (err) {
        console.error(`Errore traduzione pagina ${pageIndex + 1}:`, err);
      }
    }

    if (state.currentPageIndex !== -1 && state.pagesData[state.currentPageIndex]) {
      state.pagesData[state.currentPageIndex].jsonState = canvasService.exportJSON();
    }
    renderThumbnails(canvasService);

    btnTranslateMain.disabled = false;
    btnTranslateMain.textContent = originalText;
    alert("Traduzione completata!");
  });
}