// pages-manager.js - Upload immagini, rendering miniature, eliminazione pagine e switch.
import { state, setCurrentPageIndex } from './state.js';

export function initPagesManager(canvasService) {
  const imageUploader = document.getElementById('imageUploader');
  const btnUpload = document.getElementById('btnUpload');
  const btnSelectAll = document.getElementById('btnSelectAll');
  const btnDeselectAll = document.getElementById('btnDeselectAll');
  const btnDeleteSelectedPages = document.getElementById('btnDeleteSelectedPages');

  if (btnUpload && imageUploader) {
    btnUpload.addEventListener('click', () => imageUploader.click());
    imageUploader.addEventListener('change', handleUpload);
  }

  btnSelectAll?.addEventListener('click', () => {
    state.pagesData.forEach((_, idx) => state.selectedPageIndices.add(idx));
    renderThumbnails(canvasService);
  });

  btnDeselectAll?.addEventListener('click', () => {
    state.selectedPageIndices.clear();
    renderThumbnails(canvasService);
  });

  btnDeleteSelectedPages?.addEventListener('click', () => {
    if (state.selectedPageIndices.size === 0) return alert("Nessuna pagina selezionata.");
    if (confirm(`Vuoi eliminare ${state.selectedPageIndices.size} pagine?`)) {
      deletePages(Array.from(state.selectedPageIndices), canvasService);
    }
  });
}

function handleUpload(e) {
  const files = Array.from(e.target.files);
  const startIndex = state.pagesData.length;

  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const pageIndex = startIndex + idx;
      state.pagesData.push({ dataUrl: event.target.result, jsonState: null });
      state.selectedPageIndices.add(pageIndex);
      renderThumbnails(window.canvasService);

      if (state.currentPageIndex === -1) {
        switchPage(0, window.canvasService);
      }
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}

export async function switchPage(index, canvasService) {
  if (state.currentPageIndex !== -1 && state.pagesData[state.currentPageIndex]) {
    state.pagesData[state.currentPageIndex].jsonState = canvasService.exportJSON();
  }

  setCurrentPageIndex(index);
  renderThumbnails(canvasService);

  const page = state.pagesData[index];
  if (page) {
    await canvasService.loadImage(page.dataUrl, page.jsonState);
  }
}

export function renderThumbnails(canvasService) {
  const container = document.getElementById('thumbnailsContainer');
  if (!container) return;
  container.innerHTML = '';

  state.pagesData.forEach((page, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = `thumb-wrapper ${index === state.currentPageIndex ? 'active' : ''}`;
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.margin = '5px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'thumb-checkbox';
    checkbox.checked = state.selectedPageIndices.has(index);
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      if (e.target.checked) state.selectedPageIndices.add(index);
      else state.selectedPageIndices.delete(index);
    });

    const btnDeleteSingle = document.createElement('button');
    btnDeleteSingle.innerHTML = '×';
    btnDeleteSingle.title = 'Elimina';
    btnDeleteSingle.className = 'btn-delete-single';
    btnDeleteSingle.onclick = (e) => {
      e.stopPropagation();
      deletePages([index], canvasService);
    };

    const img = document.createElement('img');
    img.src = page.dataUrl;
    img.classList.add('thumb-item');
    img.onclick = () => switchPage(index, canvasService);

    wrapper.appendChild(checkbox);
    wrapper.appendChild(btnDeleteSingle);
    wrapper.appendChild(img);
    container.appendChild(wrapper);
  });
}

export function deletePages(indicesToDelete, canvasService) {
  const toDeleteSet = new Set(indicesToDelete);
  const updatedPages = [];
  const updatedSelections = new Set();

  state.pagesData.forEach((page, oldIndex) => {
    if (!toDeleteSet.has(oldIndex)) {
      const newIndex = updatedPages.length;
      updatedPages.push(page);
      if (state.selectedPageIndices.has(oldIndex)) updatedSelections.add(newIndex);
    }
  });

  state.pagesData = updatedPages;
  state.selectedPageIndices.clear();
  updatedSelections.forEach(idx => state.selectedPageIndices.add(idx));

  if (state.pagesData.length === 0) {
    setCurrentPageIndex(-1);
    canvasService.clear();
  } else {
    const nextIndex = Math.min(Math.max(0, state.currentPageIndex), state.pagesData.length - 1);
    setCurrentPageIndex(-1);
    switchPage(nextIndex, canvasService);
  }

  renderThumbnails(canvasService);
}