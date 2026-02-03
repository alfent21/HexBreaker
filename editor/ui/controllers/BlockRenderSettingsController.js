/**
 * BlockRenderSettingsController.js - Block Render Settings Panel Controller
 *
 * Handles block rendering settings UI (fill, border, emboss effects).
 * Extracted from UIController.js for single responsibility.
 */

import { RENDER_CONFIG } from '../../../shared/Renderer.js';

export class BlockRenderSettingsController {
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
        this._updateUI();
    }

    /**
     * Cache DOM element references
     * @private
     */
    _cacheElements(elements) {
        this.elements = {
            // Toggle
            blockRenderToggle: elements.blockRenderToggle,
            blockRenderContent: elements.blockRenderContent,
            // Fill settings
            fillUseBlockColor: elements.fillUseBlockColor,
            fillColor: elements.fillColor,
            fillColorGroup: elements.fillColorGroup,
            fillOpacity: elements.fillOpacity,
            fillOpacityValue: elements.fillOpacityValue,
            // Border settings
            borderColor: elements.borderColor,
            borderWidth: elements.borderWidth,
            borderWidthValue: elements.borderWidthValue,
            // Emboss settings
            embossHighlightColor: elements.embossHighlightColor,
            embossHighlightOpacity: elements.embossHighlightOpacity,
            embossHighlightOpacityValue: elements.embossHighlightOpacityValue,
            embossShadowColor: elements.embossShadowColor,
            embossShadowOpacity: elements.embossShadowOpacity,
            embossShadowOpacityValue: elements.embossShadowOpacityValue,
            embossWidth: elements.embossWidth,
            embossWidthValue: elements.embossWidthValue,
            embossInset: elements.embossInset,
            embossInsetValue: elements.embossInsetValue
        };
    }

    /**
     * Validate required elements exist
     * @private
     */
    _validateElements() {
        const required = [
            'blockRenderToggle',
            'fillUseBlockColor', 'fillColor', 'fillOpacity', 'fillOpacityValue',
            'borderColor', 'borderWidth', 'borderWidthValue',
            'embossHighlightColor', 'embossHighlightOpacity', 'embossHighlightOpacityValue',
            'embossShadowColor', 'embossShadowOpacity', 'embossShadowOpacityValue',
            'embossWidth', 'embossWidthValue', 'embossInset', 'embossInsetValue'
        ];

        for (const name of required) {
            if (!this.elements[name]) {
                this._addMessage('error', `[BlockRenderSettingsController] 要素が見つかりません: ${name}`);
            }
        }
    }

    /**
     * Bind element with validation
     * @private
     */
    _bindElement(elementName, eventType, handler) {
        const element = this.elements[elementName];
        if (!element) {
            // Already reported in validation, skip silently
            return;
        }
        element.addEventListener(eventType, handler);
    }

    /**
     * Bind event listeners
     * @private
     */
    _bindEvents() {
        // Collapsible toggle
        this._bindElement('blockRenderToggle', 'click', () => {
            const section = this.elements.blockRenderToggle.closest('.collapsible');
            if (section) section.classList.toggle('collapsed');
        });

        // Fill: Use block color checkbox
        this._bindElement('fillUseBlockColor', 'change', (e) => {
            const useBlockColor = e.target.checked;
            RENDER_CONFIG.block.fill.color = useBlockColor ? null : this.elements.fillColor.value;
            if (this.elements.fillColor) {
                this.elements.fillColor.disabled = useBlockColor;
            }
            this.editor.render();
        });

        // Fill color
        this._bindElement('fillColor', 'input', (e) => {
            if (this.elements.fillUseBlockColor && !this.elements.fillUseBlockColor.checked) {
                RENDER_CONFIG.block.fill.color = e.target.value;
                this.editor.render();
            }
        });

        // Fill opacity
        this._bindElement('fillOpacity', 'input', (e) => {
            const value = parseInt(e.target.value);
            RENDER_CONFIG.block.fill.opacity = value / 100;
            if (this.elements.fillOpacityValue) {
                this.elements.fillOpacityValue.textContent = value;
            }
            this.editor.render();
        });

        // Border color
        this._bindElement('borderColor', 'input', (e) => {
            RENDER_CONFIG.block.border.color = e.target.value;
            this.editor.render();
        });

        // Border width
        this._bindElement('borderWidth', 'input', (e) => {
            const value = parseFloat(e.target.value);
            RENDER_CONFIG.block.border.widthRatio = value / 100;
            if (this.elements.borderWidthValue) {
                this.elements.borderWidthValue.textContent = value;
            }
            this.editor.render();
        });

        // Emboss highlight color
        this._bindElement('embossHighlightColor', 'input', (e) => {
            RENDER_CONFIG.block.emboss.highlightColor = e.target.value;
            this.editor.render();
        });

        // Emboss highlight opacity
        this._bindElement('embossHighlightOpacity', 'input', (e) => {
            const value = parseInt(e.target.value);
            RENDER_CONFIG.block.emboss.highlightOpacity = value / 100;
            if (this.elements.embossHighlightOpacityValue) {
                this.elements.embossHighlightOpacityValue.textContent = value;
            }
            this.editor.render();
        });

        // Emboss shadow color
        this._bindElement('embossShadowColor', 'input', (e) => {
            RENDER_CONFIG.block.emboss.shadowColor = e.target.value;
            this.editor.render();
        });

        // Emboss shadow opacity
        this._bindElement('embossShadowOpacity', 'input', (e) => {
            const value = parseInt(e.target.value);
            RENDER_CONFIG.block.emboss.shadowOpacity = value / 100;
            if (this.elements.embossShadowOpacityValue) {
                this.elements.embossShadowOpacityValue.textContent = value;
            }
            this.editor.render();
        });

        // Emboss width
        this._bindElement('embossWidth', 'input', (e) => {
            const value = parseInt(e.target.value);
            RENDER_CONFIG.block.emboss.lineWidthRatio = value / 100;
            if (this.elements.embossWidthValue) {
                this.elements.embossWidthValue.textContent = value;
            }
            this.editor.render();
        });

        // Emboss inset
        this._bindElement('embossInset', 'input', (e) => {
            const value = parseInt(e.target.value);
            RENDER_CONFIG.block.emboss.insetRatio = value / 100;
            if (this.elements.embossInsetValue) {
                this.elements.embossInsetValue.textContent = value;
            }
            this.editor.render();
        });
    }

    /**
     * Update UI from current RENDER_CONFIG
     * @private
     */
    _updateUI() {
        const fill = RENDER_CONFIG.block.fill;
        const border = RENDER_CONFIG.block.border;
        const emboss = RENDER_CONFIG.block.emboss;

        // Fill settings
        if (this.elements.fillUseBlockColor) {
            this.elements.fillUseBlockColor.checked = fill.color === null;
        }
        if (this.elements.fillColor) {
            this.elements.fillColor.value = fill.color || '#888888';
            this.elements.fillColor.disabled = fill.color === null;
        }
        if (this.elements.fillOpacity) {
            const value = Math.round(fill.opacity * 100);
            this.elements.fillOpacity.value = value;
            if (this.elements.fillOpacityValue) {
                this.elements.fillOpacityValue.textContent = value;
            }
        }

        // Border settings
        if (this.elements.borderColor) {
            this.elements.borderColor.value = border.color;
        }
        if (this.elements.borderWidth) {
            const value = Math.round(border.widthRatio * 100);
            this.elements.borderWidth.value = value;
            if (this.elements.borderWidthValue) {
                this.elements.borderWidthValue.textContent = value;
            }
        }

        // Emboss settings
        if (this.elements.embossHighlightColor) {
            this.elements.embossHighlightColor.value = emboss.highlightColor;
        }
        if (this.elements.embossHighlightOpacity) {
            const value = Math.round(emboss.highlightOpacity * 100);
            this.elements.embossHighlightOpacity.value = value;
            if (this.elements.embossHighlightOpacityValue) {
                this.elements.embossHighlightOpacityValue.textContent = value;
            }
        }
        if (this.elements.embossShadowColor) {
            this.elements.embossShadowColor.value = emboss.shadowColor;
        }
        if (this.elements.embossShadowOpacity) {
            const value = Math.round(emboss.shadowOpacity * 100);
            this.elements.embossShadowOpacity.value = value;
            if (this.elements.embossShadowOpacityValue) {
                this.elements.embossShadowOpacityValue.textContent = value;
            }
        }
        if (this.elements.embossWidth) {
            const value = Math.round(emboss.lineWidthRatio * 100);
            this.elements.embossWidth.value = value;
            if (this.elements.embossWidthValue) {
                this.elements.embossWidthValue.textContent = value;
            }
        }
        if (this.elements.embossInset) {
            const value = Math.round(emboss.insetRatio * 100);
            this.elements.embossInset.value = value;
            if (this.elements.embossInsetValue) {
                this.elements.embossInsetValue.textContent = value;
            }
        }
    }

    /**
     * Get current block render settings
     * @returns {Object}
     */
    getSettings() {
        return {
            fill: { ...RENDER_CONFIG.block.fill },
            border: { ...RENDER_CONFIG.block.border },
            emboss: { ...RENDER_CONFIG.block.emboss }
        };
    }

    /**
     * Apply block render settings
     * @param {Object} settings
     */
    applySettings(settings) {
        if (settings?.fill) {
            Object.assign(RENDER_CONFIG.block.fill, settings.fill);
        }
        if (settings?.border) {
            Object.assign(RENDER_CONFIG.block.border, settings.border);
        }
        if (settings?.emboss) {
            Object.assign(RENDER_CONFIG.block.emboss, settings.emboss);
        }
        this._updateUI();
        this.editor.render();
    }
}
