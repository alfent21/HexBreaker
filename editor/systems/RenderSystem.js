/**
 * RenderSystem.js - Editor Rendering
 * Based on specification.md Section 2.1
 * 
 * Handles all canvas rendering for the editor.
 */

import { GRID_SIZES, hexToPixel, getHexVertices } from '../../shared/HexMath.js';
import { CANVAS_CONFIG, SELECTION_COLORS, LINE_TYPES, VERTEX_HANDLE } from '../core/Config.js';

export class RenderSystem {
    /**
     * @param {HTMLCanvasElement} mainCanvas
     * @param {HTMLCanvasElement} overlayCanvas
     */
    constructor(mainCanvas, overlayCanvas) {
        this.mainCanvas = mainCanvas;
        this.overlayCanvas = overlayCanvas;
        this.mainCtx = mainCanvas.getContext('2d');
        this.overlayCtx = overlayCanvas.getContext('2d');

        // Canvas size
        this.width = CANVAS_CONFIG.defaultWidth;
        this.height = CANVAS_CONFIG.defaultHeight;

        // Grid settings
        this.gridSize = GRID_SIZES.medium;
        this.showGrid = true;
        this.showLines = true;

        // View transform
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        // References (set externally)
        this.layerManager = null;
        this.lineManager = null;
        this.blockManager = null;

        // Hover state
        this.hoverHex = null;
        this.hoverLine = null;
        this.hoverVertex = null;

        this._initCanvas();
    }

    /**
     * Initialize canvas size
     * @private
     */
    _initCanvas() {
        this.mainCanvas.width = this.width;
        this.mainCanvas.height = this.height;
        this.overlayCanvas.width = this.width;
        this.overlayCanvas.height = this.height;
    }

    /**
     * Set canvas size
     * @param {number} width
     * @param {number} height
     */
    setSize(width, height) {
        this.width = width;
        this.height = height;
        this.mainCanvas.width = width;
        this.mainCanvas.height = height;
        this.overlayCanvas.width = width;
        this.overlayCanvas.height = height;
    }

    /**
     * Set grid size
     * @param {string} sizeName - 'small', 'medium', or 'large'
     */
    setGridSize(sizeName) {
        if (GRID_SIZES[sizeName]) {
            this.gridSize = GRID_SIZES[sizeName];
        }
    }

    /**
     * Set view transform
     * @param {number} scale
     * @param {number} offsetX
     * @param {number} offsetY
     */
    setTransform(scale, offsetX, offsetY) {
        this.scale = scale;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
    }

    /**
     * Convert screen coordinates to canvas coordinates
     * @param {number} screenX
     * @param {number} screenY
     * @returns {{x: number, y: number}}
     */
    screenToCanvas(screenX, screenY) {
        return {
            x: (screenX - this.offsetX) / this.scale,
            y: (screenY - this.offsetY) / this.scale
        };
    }

    /**
     * Convert canvas coordinates to screen coordinates
     * @param {number} canvasX
     * @param {number} canvasY
     * @returns {{x: number, y: number}}
     */
    canvasToScreen(canvasX, canvasY) {
        return {
            x: canvasX * this.scale + this.offsetX,
            y: canvasY * this.scale + this.offsetY
        };
    }

    /**
     * Main render function - renders everything
     */
    render() {
        this._renderMain();
        this._renderOverlay();
    }

    /**
     * Render main canvas (layers, blocks, lines)
     * @private
     */
    _renderMain() {
        const ctx = this.mainCtx;

        // Clear canvas
        ctx.fillStyle = CANVAS_CONFIG.backgroundColor;
        ctx.fillRect(0, 0, this.width, this.height);

        // Apply transform
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);

        // Draw layers
        if (this.layerManager) {
            const layers = this.layerManager.getVisibleLayers();
            for (const layer of layers) {
                if (layer.type === 'image') {
                    this._drawImageLayer(ctx, layer);
                } else if (layer.type === 'block') {
                    this._drawBlockLayer(ctx, layer);
                }
            }
        }

        // Draw grid
        if (this.showGrid) {
            this._drawGrid(ctx);
        }

        // Draw lines
        if (this.showLines && this.lineManager) {
            this._drawLines(ctx);
        }

        ctx.restore();
    }

    /**
     * Render overlay canvas (hover, selection, tool preview)
     * @private
     */
    _renderOverlay() {
        const ctx = this.overlayCtx;

        // Clear overlay
        ctx.clearRect(0, 0, this.width, this.height);

        // Apply transform
        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);

        // Draw hover hex
        if (this.hoverHex) {
            this._drawHexHighlight(ctx, this.hoverHex.row, this.hoverHex.col,
                this.isErasing ? SELECTION_COLORS.eraser : SELECTION_COLORS.hover);
        }

        // Draw selected hexes
        if (this.blockManager && this.blockManager.selectedHexes.size > 0) {
            for (const key of this.blockManager.selectedHexes) {
                const [row, col] = key.split(',').map(Number);
                this._drawHexHighlight(ctx, row, col, SELECTION_COLORS.selected);
            }
        }

        // Draw line drawing preview
        if (this.lineManager && this.lineManager.isDrawing && this.lineManager.currentPoints.length > 0) {
            this._drawLinePreview(ctx, this.lineManager.currentPoints);
        }

        // Draw selected line vertices
        if (this.lineManager && this.lineManager.selectedLineId) {
            const line = this.lineManager.getSelectedLine();
            if (line) {
                this._drawVertexHandles(ctx, line);
            }
        }

        ctx.restore();
    }

    /**
     * Draw image layer
     * @private
     */
    _drawImageLayer(ctx, layer) {
        if (layer.image) {
            ctx.drawImage(layer.image, 0, 0);
        }
    }

    /**
     * Draw block layer
     * @private
     */
    _drawBlockLayer(ctx, layer) {
        const sourceLayer = layer.sourceLayerId ?
            this.layerManager.getLayer(layer.sourceLayerId) : null;

        for (const [key, block] of layer.blocks) {
            const center = hexToPixel(block.row, block.col, this.gridSize);
            const vertices = getHexVertices(center.x, center.y, this.gridSize.radius);

            // Draw hex shape
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
                ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            ctx.closePath();

            // Fill with color or clipped image
            if (sourceLayer && sourceLayer.image) {
                // Clip image to hex
                ctx.save();
                ctx.clip();
                ctx.drawImage(sourceLayer.image, 0, 0);
                ctx.restore();
            } else {
                ctx.fillStyle = block.color;
                ctx.fill();
            }

            // Draw emboss effect
            this._drawHexEmboss(ctx, center, vertices);

            // Draw durability indicator
            if (block.durability > 1) {
                this._drawDurabilityText(ctx, center, block.durability);
            }

            // Draw special block indicators
            if (block.gemDrop === 'guaranteed') {
                this._drawGemIcon(ctx, center, '#FFD700');
            } else if (block.gemDrop === 'infinite') {
                this._drawGemIcon(ctx, center, '#FF00FF');
            }

            if (block.blockType === 'key') {
                this._drawKeyIcon(ctx, center);
            } else if (block.blockType === 'lock') {
                this._drawLockIcon(ctx, center);
            }
        }
    }

    /**
     * Draw hex emboss effect
     * @private
     */
    _drawHexEmboss(ctx, center, vertices) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;

        // Top-left highlight
        ctx.beginPath();
        ctx.moveTo(vertices[5].x, vertices[5].y);
        ctx.lineTo(vertices[0].x, vertices[0].y);
        ctx.lineTo(vertices[1].x, vertices[1].y);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';

        // Bottom-right shadow
        ctx.beginPath();
        ctx.moveTo(vertices[2].x, vertices[2].y);
        ctx.lineTo(vertices[3].x, vertices[3].y);
        ctx.lineTo(vertices[4].x, vertices[4].y);
        ctx.stroke();
    }

    /**
     * Draw durability text
     * @private
     */
    _drawDurabilityText(ctx, center, durability) {
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(durability.toString(), center.x, center.y);
    }

    /**
     * Draw gem icon
     * @private
     */
    _drawGemIcon(ctx, center, color) {
        ctx.fillStyle = color;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('💎', center.x, center.y - 5);
    }

    /**
     * Draw key icon
     * @private
     */
    _drawKeyIcon(ctx, center) {
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔑', center.x, center.y);
    }

    /**
     * Draw lock icon
     * @private
     */
    _drawLockIcon(ctx, center) {
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒', center.x, center.y);
    }

    /**
     * Draw hex grid
     * @private
     */
    _drawGrid(ctx) {
        const { width, radius, verticalSpacing } = this.gridSize;

        // Calculate visible grid bounds
        const startRow = Math.max(0, Math.floor(-radius / verticalSpacing));
        const endRow = Math.ceil(this.height / verticalSpacing) + 1;
        const startCol = Math.max(0, Math.floor(-width / 2 / width));
        const endCol = Math.ceil(this.width / width) + 1;

        ctx.strokeStyle = CANVAS_CONFIG.gridColor;
        ctx.lineWidth = 1;

        // Use a single path for all hexes for better performance
        ctx.beginPath();

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const center = hexToPixel(row, col, this.gridSize);
                const vertices = getHexVertices(center.x, center.y, radius);

                // Round to 0.5 offset for crisp 1px lines
                const x0 = Math.round(vertices[0].x) + 0.5;
                const y0 = Math.round(vertices[0].y) + 0.5;

                ctx.moveTo(x0, y0);
                for (let i = 1; i < vertices.length; i++) {
                    ctx.lineTo(
                        Math.round(vertices[i].x) + 0.5,
                        Math.round(vertices[i].y) + 0.5
                    );
                }
                ctx.lineTo(x0, y0); // Close back to start
            }
        }

        ctx.stroke();
    }

    /**
     * Draw all lines
     * @private
     */
    _drawLines(ctx) {
        const lines = this.lineManager.getAllLines();

        for (const line of lines) {
            const isSelected = line.id === this.lineManager.selectedLineId;

            // Draw selection highlight
            if (isSelected) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = line.thickness + 4;
                ctx.globalAlpha = 0.5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                this._drawLinePath(ctx, line);
                ctx.stroke();

                ctx.globalAlpha = 1;
            }

            // Draw line
            const typeConfig = LINE_TYPES[line.type.toUpperCase()];
            ctx.strokeStyle = line.color;
            ctx.lineWidth = line.thickness;
            ctx.globalAlpha = line.opacity;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash(typeConfig?.dashPattern || []);

            this._drawLinePath(ctx, line);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            // Draw label
            if (typeConfig?.label && line.points.length >= 2) {
                this._drawLineLabel(ctx, line.points[0], line.points[1], typeConfig.label);
            }
        }
    }

    /**
     * Draw line path
     * @private
     */
    _drawLinePath(ctx, line) {
        if (line.points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(line.points[0].x, line.points[0].y);

        for (let i = 1; i < line.points.length; i++) {
            ctx.lineTo(line.points[i].x, line.points[i].y);
        }

        if (line.closed) {
            ctx.closePath();
        }
    }

    /**
     * Draw line label
     * @private
     */
    _drawLineLabel(ctx, p1, p2, label) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2 - 25;

        ctx.font = 'bold 14px sans-serif';
        const textWidth = ctx.measureText(label.text).width;

        ctx.fillStyle = label.bgColor;
        ctx.fillRect(midX - textWidth / 2 - 4, midY - 9, textWidth + 8, 18);

        ctx.fillStyle = label.textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label.text, midX, midY);
    }

    /**
     * Draw hex highlight
     * @private
     */
    _drawHexHighlight(ctx, row, col, color) {
        const center = hexToPixel(row, col, this.gridSize);
        const vertices = getHexVertices(center.x, center.y, this.gridSize.radius);

        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i++) {
            ctx.lineTo(vertices[i].x, vertices[i].y);
        }
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();
    }

    /**
     * Draw line preview during drawing
     * @private
     */
    _drawLinePreview(ctx, points) {
        if (points.length < 1) return;

        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.stroke();
        ctx.setLineDash([]);

        // Draw vertices
        for (const p of points) {
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Draw vertex handles for selected line
     * @private
     */
    _drawVertexHandles(ctx, line) {
        for (let i = 0; i < line.points.length; i++) {
            const p = line.points[i];

            let color = VERTEX_HANDLE.normalColor;
            if (i === this.lineManager.selectedVertexIndex) {
                color = VERTEX_HANDLE.dragColor;
            } else if (i === this.lineManager.hoveredVertexIndex) {
                color = VERTEX_HANDLE.hoverColor;
            }

            // Outline
            ctx.fillStyle = VERTEX_HANDLE.outlineColor;
            ctx.beginPath();
            ctx.arc(p.x, p.y, VERTEX_HANDLE.size + VERTEX_HANDLE.outlineWidth, 0, Math.PI * 2);
            ctx.fill();

            // Handle
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, VERTEX_HANDLE.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Set hover hex position
     * @param {number|null} row
     * @param {number|null} col
     */
    setHoverHex(row, col) {
        if (row === null || col === null) {
            this.hoverHex = null;
        } else {
            this.hoverHex = { row, col };
        }
    }

    /**
     * Set erasing mode (changes hover color)
     * @param {boolean} isErasing
     */
    setErasing(isErasing) {
        this.isErasing = isErasing;
    }
}
