/**
 * ToolPaletteController.js - Tool Palette Controller
 *
 * Handles tool selection, brush size, durability, color, and line properties.
 * Extracted from UIController.js for single responsibility.
 */

import { TOOLS, BRUSH_SIZES, DURABILITY_COLORS } from '../../core/Config.js';

export class ToolPaletteController {
    /**
     * @param {import('../../core/Editor.js').Editor} editor
     * @param {Function} addMessage - Message callback function
     */
    constructor(editor, addMessage) {
        this.editor = editor;
        this._addMessage = addMessage;

        // DOM element references
        this.elements = {};
    }

    /**
     * Initialize the controller
     * @param {Object} elements - Cached DOM elements from UIController
     */
    init(elements) {
        this._cacheElements(elements);
        this._validateElements();
        this._bindEvents();
        this._bindEditorEvents();
        this._initUI();
    }

    /**
     * Cache DOM element references
     * @private
     */
    _cacheElements(elements) {
        this.elements = {
            toolPalette: elements.toolPalette,
            toolButtons: elements.toolButtons,
            brushSizeButtons: elements.brushSizeButtons,
            durabilityButtons: elements.durabilityButtons,
            colorPicker: elements.colorPicker,
            lineTypeButtons: elements.lineTypeButtons,
            lineColorPicker: elements.lineColorPicker,
            lineThickness: elements.lineThickness,
            lineOpacity: elements.lineOpacity,
            gridSnap: elements.gridSnap
        };
    }

    /**
     * Validate required elements exist
     * @private
     */
    _validateElements() {
        if (!this.elements.toolButtons || Object.keys(this.elements.toolButtons).length === 0) {
            console.warn('[ToolPaletteController] No tool buttons found');
        }
        if (!this.elements.brushSizeButtons || Object.keys(this.elements.brushSizeButtons).length === 0) {
            console.warn('[ToolPaletteController] No brush size buttons found');
        }
        if (!this.elements.durabilityButtons || this.elements.durabilityButtons.length === 0) {
            console.warn('[ToolPaletteController] No durability buttons found');
        }
    }

    /**
     * Bind event listeners
     * @private
     */
    _bindEvents() {
        // Tool buttons
        if (this.elements.toolButtons) {
            for (const [tool, btn] of Object.entries(this.elements.toolButtons)) {
                if (btn) {
                    btn.addEventListener('click', () => this.editor.setTool(tool));
                }
            }
        }

        // Brush size buttons
        if (this.elements.brushSizeButtons) {
            for (const [size, btn] of Object.entries(this.elements.brushSizeButtons)) {
                if (btn) {
                    btn.addEventListener('click', () => {
                        this.editor.blockManager.setBrushSize(size);
                        this._updateBrushSizeUI();
                    });
                }
            }
        }

        // Durability buttons
        if (this.elements.durabilityButtons) {
            this.elements.durabilityButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const durability = parseInt(btn.dataset.durability);
                    this.editor.blockManager.setDurability(durability);
                    this._updateDurabilityUI();
                });
            });
        }

        // Color picker
        if (this.elements.colorPicker) {
            this.elements.colorPicker.addEventListener('input', (e) => {
                this.editor.blockManager.setColor(e.target.value);
            });
        }

        // Line type buttons
        if (this.elements.lineTypeButtons) {
            this.elements.lineTypeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const type = btn.dataset.type;

                    // Update active state
                    this.elements.lineTypeButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Switch to line tool
                    this.editor.setTool(TOOLS.LINE);

                    // Set line type for new lines
                    this.editor.lineManager.currentLineType = type;

                    // Update selected line if any
                    const selectedLine = this.editor.lineManager.getSelectedLine();
                    if (selectedLine) {
                        this.editor.lineManager.updateLine(selectedLine.id, { type });
                    }
                });
            });
        }

        // Line color picker
        if (this.elements.lineColorPicker) {
            this.elements.lineColorPicker.addEventListener('input', (e) => {
                const selectedLine = this.editor.lineManager.getSelectedLine();
                if (selectedLine) {
                    this.editor.lineManager.updateLine(selectedLine.id, { color: e.target.value });
                }
            });
        }

        // Line thickness
        if (this.elements.lineThickness) {
            this.elements.lineThickness.addEventListener('input', (e) => {
                const thickness = parseInt(e.target.value);
                // Update setting for new lines
                this.editor.lineManager.currentThickness = thickness;
                // Update selected line
                const selectedLine = this.editor.lineManager.getSelectedLine();
                if (selectedLine) {
                    this.editor.lineManager.updateLine(selectedLine.id, { thickness });
                }
            });
        }

        // Line opacity
        if (this.elements.lineOpacity) {
            this.elements.lineOpacity.addEventListener('input', (e) => {
                const opacity = parseFloat(e.target.value);
                // Update setting for new lines
                this.editor.lineManager.currentOpacity = opacity;
                // Update selected line
                const selectedLine = this.editor.lineManager.getSelectedLine();
                if (selectedLine) {
                    this.editor.lineManager.updateLine(selectedLine.id, { opacity });
                }
            });
        }

        // Grid snap toggle
        if (this.elements.gridSnap) {
            this.elements.gridSnap.addEventListener('change', (e) => {
                this.editor.gridSnapEnabled = e.target.checked;
            });
        }
    }

    /**
     * Bind editor event handlers
     * @private
     */
    _bindEditorEvents() {
        this.editor.on('toolChanged', (tool) => this._updateToolUI(tool));
        this.editor.on('durabilityChanged', () => this._updateDurabilityUI());
        this.editor.on('brushSizeChanged', () => this._updateBrushSizeUI());
        this.editor.on('lineSelected', (line) => this._updateLinePropertiesUI(line));
    }

    /**
     * Initialize UI state
     * @private
     */
    _initUI() {
        this._updateToolUI(this.editor.currentTool);
        this._updateBrushSizeUI();
        this._updateDurabilityUI();
    }

    /**
     * Update tool button states
     * @private
     */
    _updateToolUI(activeTool) {
        if (!this.elements.toolButtons) return;

        for (const [tool, btn] of Object.entries(this.elements.toolButtons)) {
            if (btn) {
                btn.classList.toggle('active', tool === activeTool);
            }
        }
    }

    /**
     * Update brush size button states
     * @private
     */
    _updateBrushSizeUI() {
        if (!this.elements.brushSizeButtons) return;

        const currentSize = this.editor.blockManager.brushSize;
        for (const [size, btn] of Object.entries(this.elements.brushSizeButtons)) {
            if (btn) {
                btn.classList.toggle('active', size === currentSize);
            }
        }
    }

    /**
     * Update durability button states
     * @private
     */
    _updateDurabilityUI() {
        if (!this.elements.durabilityButtons) return;

        const currentDurability = this.editor.blockManager.currentDurability;
        this.elements.durabilityButtons.forEach(btn => {
            const durability = parseInt(btn.dataset.durability);
            btn.classList.toggle('active', durability === currentDurability);
            btn.style.backgroundColor = DURABILITY_COLORS[durability];
        });
    }

    /**
     * Update line properties panel
     * @private
     */
    _updateLinePropertiesUI(line) {
        if (!line) {
            // Clear/disable line properties
            return;
        }

        // Update type buttons
        if (this.elements.lineTypeButtons) {
            this.elements.lineTypeButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === line.type);
            });
        }

        // Update color
        if (this.elements.lineColorPicker) {
            this.elements.lineColorPicker.value = line.color;
        }

        // Update thickness
        if (this.elements.lineThickness) {
            this.elements.lineThickness.value = line.thickness;
        }

        // Update opacity
        if (this.elements.lineOpacity) {
            this.elements.lineOpacity.value = line.opacity;
        }
    }
}
