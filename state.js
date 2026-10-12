// state.js - Gestione dello stato globale (pagine, selezioni, indice attivo).
export const state = {
  pagesData: [],
  currentPageIndex: -1,
  selectedPageIndices: new Set()
};

export function setCurrentPageIndex(index) {
  state.currentPageIndex = index;
}