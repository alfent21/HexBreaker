/**
 * RenderSystem.js - Editor Rendering
 * Based on specification.md Section 2.1
 * 
 * Handles all canvas rendering for the editor.
 */

import { GRID_SIZES, hexToPixel, getHexVertices } from '../../shared/HexMath.js';
import { CANVAS_CONFIG, SELECTION_COLORS, LINE_TYPES, VERTEX_HANDLE, TOOLS } from '../core/Config.js';
import { drawHexBlock, drawLine } from '../../shared/Renderer.js';

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
        this.hoverSnapPoint = null;  // {x, y, snapped, snapType}

        // Current tool (for brush preview)
        this.currentTool = null;

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

        // Draw base layer first (always at bottom)
        if (this.layerManager) {
            const baseLayer = this.layerManager.getBaseLayer();
            if (baseLayer) {
                this._drawBaseLayer(ctx, baseLayer);
            }
        }

        // Draw regular layers
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

        // Draw hover hex(es) - use brush size for brush/eraser tools
        if (this.hoverHex) {
            const useBrushSize = this.currentTool === TOOLS.BRUSH ||
                                 this.currentTool === TOOLS.ERASER;
            const color = this.isErasing ? SELECTION_COLORS.eraser : SELECTION_COLORS.hover;

            if (useBrushSize && this.blockManager) {
                // Draw multiple hexes based on brush size
                const cells = this.blockManager.getBrushCells(this.hoverHex.row, this.hoverHex.col);
                for (const cell of cells) {
                    this._drawHexHighlight(ctx, cell.row, cell.col, color);
                }
            } else {
                // Draw single hex for other tools
                this._drawHexHighlight(ctx, this.hoverHex.row, this.hoverHex.col, color);
            }
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

        // Draw snap point indicator (only when line tool active)
        if (this.hoverSnapPoint && this.hoverSnapPoint.snapped && this.currentTool === TOOLS.LINE) {
            this._drawSnapIndicator(ctx, this.hoverSnapPoint);
        }

        ctx.restore();
    }

    /**
     * Draw base layer (solid color or image)
     * @private
     */
    _drawBaseLayer(ctx, baseLayer) {
        if (baseLayer.backgroundColor) {
            // Draw solid color background
            ctx.fillStyle = baseLayer.backgroundColor;
            ctx.fillRect(0, 0, baseLayer.width, baseLayer.height);
        } else if (baseLayer.image) {
            // Draw image background
            ctx.drawImage(baseLayer.image, 0, 0);
        }
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
     * Uses shared Renderer module for consistent visuals
     * @private
     */
    _drawBlockLayer(ctx, layer) {
        const sourceLayer = layer.sourceLayerId ?
            this.layerManager.getLayer(layer.sourceLayerId) : null;

        for (const [key, block] of layer.blocks) {
            const center = hexToPixel(block.row, block.col, this.gridSize);

            // Use shared renderer for block drawing
            drawHexBlock(ctx, center.x, center.y, this.gridSize.radius, block.color, {
                durability: block.durability,
                gemDrop: block.gemDrop,
                blockType: block.blockType,
                clipImage: sourceLayer?.image || null
            });
        }
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
     * Uses shared Renderer module for consistent visuals
     * @private
     */
    _drawLines(ctx) {
        const lines = this.lineManager.getAllLines();

        for (const line of lines) {
            const isSelected = line.id === this.lineManager.selectedLineId;

            // Use shared renderer for line drawing
            drawLine(ctx, line, {
                showLabel: true,
                isSelected: isSelected
            });
        }
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
     * Draw snap indicator
     * @private
     */
    _drawSnapIndicator(ctx, snapPoint) {
        const { x, y, snapType } = snapPoint;

        // Yellow dot for snap point
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Edge snap: draw line along edge
        if (snapType === 'edge') {
            const stage = this.layerManager?.editor?.stageManager?.currentStage;
            if (stage) {
                ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();

                if (snapPoint.edge === 'left' || snapPoint.edge === 'right') {
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, stage.height);
                } else {
                    ctx.moveTo(0, y);
                    ctx.lineTo(stage.width, y);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }

    /**
     * Set hover snap point
     * @param {Object|null} snapPoint - {x, y, snapped, snapType, ...}
     */
    setHoverSnapPoint(snapPoint) {
        this.hoverSnapPoint = snapPoint;
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

    /**
     * Set current tool (for brush size preview)
     * @param {string} tool
     */
    setCurrentTool(tool) {
        this.currentTool = tool;
    }
}
