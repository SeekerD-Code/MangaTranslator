// toolbar-controller.js
import { state } from './state.js';
import { switchPage } from './pages-manager.js';

export function initToolbarController(canvasService) {
  document.getElementById('fontFamily')?.addEventListener('change', (e) => {
    canvasService.updateActiveObjectStyle('fontFamily', e.target.value);
  });

  document.getElementById('fontSize')?.addEventListener('input', (e) => {
    canvasService.updateActiveObjectStyle('fontSize', parseInt(e.target.value, 10));
  });

  document.getElementById('btnBold')?.addEventListener('click', () => {
    canvasService.toggleActiveObjectStyle('fontWeight', 'bold', 'normal');
  });

  document.getElementById('btnItalic')?.addEventListener('click', () => {
    canvasService.toggleActiveObjectStyle('fontStyle', 'italic', 'normal');
  });

  document.getElementById('btnUnderline')?.addEventListener('click', () => {
    canvasService.toggleActiveObjectStyle('underline', true, false);
  });

  document.getElementById('btnStrike')?.addEventListener('click', () => {
    canvasService.toggleActiveObjectStyle('linethrough', true, false);
  });

  document.getElementById('btnAlignLeft')?.addEventListener('click', () => {
    canvasService.updateActiveObjectStyle('textAlign', 'left');
  });

  document.getElementById('btnAlignCenter')?.addEventListener('click', () => {
    canvasService.updateActiveObjectStyle('textAlign', 'center');
  });

  document.getElementById('btnAlignRight')?.addEventListener('click', () => {
    canvasService.updateActiveObjectStyle('textAlign', 'right');
  });

  document.getElementById('lineHeight')?.addEventListener('input', (e) => {
    canvasService.updateActiveObjectStyle('lineHeight', parseFloat(e.target.value));
  });

  document.getElementById('textColor')?.addEventListener('input', (e) => {
    canvasService.updateActiveObjectStyle('fill', e.target.value);
  });

  document.getElementById('bgColor')?.addEventListener('input', (e) => {
    canvasService.updateActiveObjectStyle('textBackgroundColor', e.target.value);
  });

  document.getElementById('btnUpperCase')?.addEventListener('click', () => {
    canvasService.transformActiveText('upper');
  });

  document.getElementById('btnLowerCase')?.addEventListener('click', () => {
    canvasService.transformActiveText('lower');
  });

  document.getElementById('bgBorderRadius')?.addEventListener('input', (e) => {
    canvasService.updateActiveObjectBorderRadius(parseInt(e.target.value, 10));
  });

  document.getElementById('btnAddText')?.addEventListener('click', () => {
    canvasService.addTextbox('Nuovo Testo', {
      fontFamily: document.getElementById('fontFamily')?.value,
      fontSize: parseInt(document.getElementById('fontSize')?.value || '18', 10),
      bgColor: document.getElementById('bgColor')?.value
    });
  });

  document.getElementById('btnDeleteSelected')?.addEventListener('click', () => {
    canvasService.deleteActiveObject();
  });

  // Contagocce
  const btnPickColor = document.getElementById('btnPickColor');
  if (btnPickColor) {
    btnPickColor.addEventListener('click', async () => {
      if (!window.EyeDropper) return alert("Il tuo browser non supporta il contagocce nativo.");
      const eyeDropper = new EyeDropper();
      try {
        const result = await eyeDropper.open();
        const pickedColor = result.sRGBHex;
        const bgColorElem = document.getElementById('bgColor');
        if (bgColorElem) bgColorElem.value = pickedColor;
        canvasService.updateActiveObjectStyle('textBackgroundColor', pickedColor);
      } catch (err) {}
    });
  }

  // Scorciatoie da Tastiera
  document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

    const isCtrl = e.ctrlKey || e.metaKey;
    if (e.key === 'Delete' || e.key === 'Del') {
      canvasService.deleteActiveObject();
    } else if (isCtrl && e.key.toLowerCase() === 'c') {
      canvasService.copy();
    } else if (isCtrl && e.key.toLowerCase() === 'v') {
      canvasService.paste();
    } else if (isCtrl && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      canvasService.undo();
    }
  });

  // Export ZIP
  document.getElementById('btnExportZip')?.addEventListener('click', async () => {
    if (state.pagesData.length === 0) return;
    const targetIndices = state.selectedPageIndices.size > 0
      ? Array.from(state.selectedPageIndices)
      : state.pagesData.map((_, i) => i);

    if (state.currentPageIndex !== -1) {
      state.pagesData[state.currentPageIndex].jsonState = canvasService.exportJSON();
    }

    const zip = new JSZip();
    for (const index of targetIndices) {
      await switchPage(index, canvasService);
      await new Promise(res => setTimeout(res, 250));
      const dataUrl = canvasService.toDataURL();
      zip.file(`pagina_${index + 1}.png`, dataUrl.split(',')[1], { base64: true });
    }

    zip.generateAsync({ type: 'blob' }).then((content) => {
      saveAs(content, 'manga_tradotto.zip');
    });
  });
}