// layout-resizer.js - Barre Ridimensionabili

export function initResizers(cService = null) {
  const resizerLeft = document.getElementById('resizer-left');
  const resizerRight = document.getElementById('resizer-right');
  const sidebarLeft = document.getElementById('sidebar-left');
  const sidebarRight = document.getElementById('sidebar-right');

  if (!resizerLeft || !resizerRight || !sidebarLeft || !sidebarRight) return;

  let isResizingLeft = false;
  let isResizingRight = false;

  resizerLeft.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizingLeft = true;
    resizerLeft.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  resizerRight.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizingRight = true;
    resizerRight.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (isResizingLeft) {
      const newWidth = e.clientX;
      if (newWidth >= 100 && newWidth <= 500) {
        sidebarLeft.style.width = `${newWidth}px`;
      }
    } else if (isResizingRight) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 160 && newWidth <= 450) {
        sidebarRight.style.width = `${newWidth}px`;
      }
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizingLeft || isResizingRight) {
      isResizingLeft = false;
      isResizingRight = false;
      resizerLeft.classList.remove('resizing');
      resizerRight.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (cService && cService.canvas) {
        cService.canvas.calcOffset();
      }
    }
  });
}