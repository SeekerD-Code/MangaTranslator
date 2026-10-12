/**
 * Configurazione globale Fabric.js per evitare lo sfasamento del cursore di testo
 */
if (typeof fabric !== 'undefined') {
  // Disabilita lo scaling e la cache del testo per evitare il disallineamento del cursore sia su IText che su Textbox
  fabric.Object.prototype.objectCaching = false;

  if (fabric.IText) {
    fabric.IText.prototype.needsItsOwnCache = function() { return false; };
  }
  if (fabric.Textbox) {
    fabric.Textbox.prototype.needsItsOwnCache = function() { return false; };
  }
}

/**
 * Servizio per la gestione del Canvas interattivo Fabric.js con Formattazione avanzata,
 * Storico (Undo) e Clipboard (Copia/Incolla).
 */
export default class CanvasService {
  constructor(canvasId) {
    this.canvas = new fabric.Canvas(canvasId);

    // Gestione Undo / Redo
    this.history = [];
    this.isHistoryProcessing = false;

    // Gestione Clipboard (Copia / Incolla)
    this._clipboard = null;

    this._initEvents();
  }

  _initEvents() {
    // Salva lo stato della storia ad ogni modifica
    const saveState = () => {
      if (!this.isHistoryProcessing) {
        this.saveState();
      }
    };

    this.canvas.on('object:added', saveState);
    this.canvas.on('object:modified', saveState);
    this.canvas.on('object:removed', saveState);

    // Ricalcola le coordinate del mouse ogni volta che l'utente entra in modalità editing di un testo
    // Questo risolve definitivamente lo sfasamento del cursore in presenza di scroll o layout flex.
    this.canvas.on('text:editing:entered', (e) => {
      this.canvas.calcOffset();
      if (e.target) {
        e.target.initDimensions();
        this.canvas.renderAll();
      }
    });
  }

  saveState() {
    if (this.isHistoryProcessing) return;
    const json = JSON.stringify(this.canvas.toJSON());
    this.history.push(json);
    if (this.history.length > 50) this.history.shift(); // Limite a 50 stati
  }

  undo() {
    if (this.history.length <= 1) return;
    this.isHistoryProcessing = true;
    this.history.pop(); // Rimuove lo stato corrente
    const previousState = this.history[this.history.length - 1];

    this.canvas.loadFromJSON(previousState, () => {
      this.canvas.calcOffset();
      this.canvas.renderAll();
      this.isHistoryProcessing = false;
    });
  }

  /**
   * Carica un'immagine di sfondo mantenendo proporzioni e dimensioni reali 1:1.
   */
  async loadImage(dataUrl, jsonState = null) {
    return new Promise((resolve) => {
      this.isHistoryProcessing = true;
      fabric.Image.fromURL(dataUrl, (img) => {
        // 1. Imposta il Canvas con le dimensioni reali esatte dell'immagine
        this.canvas.setWidth(img.width);
        this.canvas.setHeight(img.height);

        // 2. Imposta l'immagine come sfondo principale
        this.canvas.setBackgroundImage(img, () => {
          if (jsonState) {
            this.canvas.loadFromJSON(jsonState, () => {
              this.canvas.calcOffset();
              this.canvas.renderAll();
              this.history = [JSON.stringify(this.canvas.toJSON())];
              this.isHistoryProcessing = false;
              resolve();
            });
          } else {
            this.canvas.getObjects().forEach(obj => this.canvas.remove(obj));
            this.canvas.calcOffset();
            this.canvas.renderAll();
            this.history = [JSON.stringify(this.canvas.toJSON())];
            this.isHistoryProcessing = false;
            resolve();
          }
        });
      });
    });
  }

  /**
   * Aggiunge una maschera e una casella di testo.
   */
  addTextbox(text, options = {}) {
    const padding = 10;
    const width = Math.max(80, options.width || 150);
    const height = Math.max(40, options.height || 60);
    const x = options.x || 50;
    const y = options.y || 50;

    const borderRadius = options.borderRadius !== undefined ? options.borderRadius : 30;
    const maxRx = (width / 2) * (borderRadius / 100);
    const maxRy = (height / 2) * (borderRadius / 100);

    const bgRect = new fabric.Rect({
      left: x,
      top: y,
      width: width,
      height: height,
      fill: options.bgColor || '#ffffff',
      rx: maxRx,
      ry: maxRy,
      strokeUniform: true
    });

    const textbox = new fabric.Textbox(text, {
      left: x + padding / 2,
      top: y + padding / 2,
      width: width - padding,
      fontSize: options.fontSize || 14,
      fontFamily: options.fontFamily || 'Comic Neue',
      fill: options.textColor || '#000000',
      backgroundColor: 'transparent',
      textAlign: 'center',
      lineHeight: 1.16,
      splitByGrapheme: false,
      objectCaching: false
    });

    this.canvas.add(bgRect);
    this.canvas.add(textbox);
    this.canvas.setActiveObject(textbox);

    // Ricalcola posizione e offset del cursore
    this.canvas.calcOffset();
    textbox.initDimensions();
    this.canvas.renderAll();
  }

  /**
   * Applica una proprietà stilistica (Font, Colore, Bold, Italic, LineHeight, etc.)
   * Se c'è del testo evidenziato, si applica solo alle lettere selezionate.
   */
  updateActiveObjectStyle(property, value) {
    const activeObj = this.canvas.getActiveObject();
    if (!activeObj) return;

    if (activeObj.type === 'textbox') {
      const start = activeObj.selectionStart;
      const end = activeObj.selectionEnd;

      // Proprietà a livello di paragrafo o casella intera
      const blockProperties = ['textAlign', 'lineHeight'];

      if (!blockProperties.includes(property) && start !== undefined && end !== undefined && start !== end) {
        // Applica solo alla selezione evidenziata
        const style = {};
        style[property] = value;
        activeObj.setSelectionStyles(style, start, end);
      } else {
        // Applica all'intera casella
        activeObj.set(property, value);
      }

      activeObj.initDimensions();
    } else {
      activeObj.set(property, value);
    }

    this.canvas.renderAll();
    this.saveState();
  }

  /**
   * Commuta uno stile booleano/toggle (es: Bold, Italic, Underline, Linethrough)
   */
  toggleActiveObjectStyle(property, activeValue, inactiveValue) {
    const activeObj = this.canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'textbox') return;

    const start = activeObj.selectionStart;
    const end = activeObj.selectionEnd;

    let isAlreadyActive = false;

    if (start !== undefined && end !== undefined && start !== end) {
      // Controlla il primo carattere della selezione
      const currentStyles = activeObj.getSelectionStyles(start, start + 1);
      isAlreadyActive = currentStyles[0] && currentStyles[0][property] === activeValue;
      const newValue = isAlreadyActive ? inactiveValue : activeValue;

      const style = {};
      style[property] = newValue;
      activeObj.setSelectionStyles(style, start, end);
    } else {
      isAlreadyActive = activeObj.get(property) === activeValue;
      activeObj.set(property, isAlreadyActive ? inactiveValue : activeValue);
    }

    activeObj.initDimensions();
    this.canvas.renderAll();
    this.saveState();
  }

  transformActiveText(type) {
    const activeObj = this.canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'textbox') return;

    const start = activeObj.selectionStart;
    const end = activeObj.selectionEnd;
    let currentText = activeObj.text;

    if (start !== undefined && end !== undefined && start !== end) {
      const selectedPart = currentText.substring(start, end);
      const transformed = type === 'upper' ? selectedPart.toUpperCase() : selectedPart.toLowerCase();
      activeObj.text = currentText.substring(0, start) + transformed + currentText.substring(end);
      activeObj.selectionStart = start;
      activeObj.selectionEnd = end;
    } else {
      activeObj.text = type === 'upper' ? currentText.toUpperCase() : currentText.toLowerCase();
    }

    activeObj.initDimensions();
    this.canvas.renderAll();
    this.saveState();
  }

  updateActiveObjectBorderRadius(value) {
    const activeObject = this.canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'rect') return;

    const actualWidth = activeObject.width * activeObject.scaleX;
    const actualHeight = activeObject.height * activeObject.scaleY;

    activeObject.set({
      rx: (actualWidth / 2) * (value / 100) / activeObject.scaleX,
      ry: (actualHeight / 2) * (value / 100) / activeObject.scaleY
    });
    this.canvas.renderAll();
    this.saveState();
  }

  deleteActiveObject() {
    const activeObj = this.canvas.getActiveObject();
    if (activeObj) {
      if (activeObj.type === 'textbox' && activeObj.isEditing) return;
      this.canvas.remove(activeObj);
      this.canvas.renderAll();
    }
  }

  // --- Copia e Incolla ---
  copy() {
    const activeObj = this.canvas.getActiveObject();
    if (!activeObj) return;

    // Non copiare l'oggetto se si sta modificando del testo internamente
    if (activeObj.type === 'textbox' && activeObj.isEditing) return;

    activeObj.clone((cloned) => {
      this._clipboard = cloned;
    });
  }

  paste() {
    if (!this._clipboard) return;

    this._clipboard.clone((clonedObj) => {
      this.canvas.discardActiveObject();
      clonedObj.set({
        left: clonedObj.left + 15,
        top: clonedObj.top + 15,
        evented: true
      });

      if (clonedObj.type === 'activeSelection') {
        clonedObj.canvas = this.canvas;
        clonedObj.forEachObject((obj) => {
          this.canvas.add(obj);
        });
        clonedObj.setCoordinates();
      } else {
        this.canvas.add(clonedObj);
      }

      this._clipboard.top += 15;
      this._clipboard.left += 15;
      this.canvas.setActiveObject(clonedObj);
      this.canvas.renderAll();
    });
  }

  exportJSON() {
    return this.canvas.toJSON();
  }

  toDataURL() {
    return this.canvas.toDataURL({ format: 'png', multiplier: 1 });
  }

  clear() {
    this.canvas.clear();
  }
}