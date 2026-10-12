// app.js
import CanvasService from './canvas-service.js';
import { initPagesManager } from './pages-manager.js';
import { initTranslationController } from './translation-controller.js';
import { initToolbarController } from './toolbar-controller.js';
import { initResizers } from './layout-resizer.js';

const canvasService = new CanvasService('mangaCanvas');
window.canvasService = canvasService;

document.addEventListener('DOMContentLoaded', () => {
  initPagesManager(canvasService);
  initTranslationController(canvasService);
  initToolbarController(canvasService);
  initResizers(canvasService);
});