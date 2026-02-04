/**
 * Events.js - Canvas Event Handling
 * Based on specification.md Section 3.10
 * 
 * Handles mouse and keyboard events for the editor canvas.
 */

import { pixelToHex } from '../../shared/HexMath.js';
import { TOOLS, ZOOM_CONFIG } from '../core/Config.js';
import { CursorManager } from '../utils/CursorManager.js';
import { SnapHelper } from '../utils/SnapHelper.js';
import { dialogService } from '../ui/DialogService.js';

export class Events {
    /**
     * @param {import('./Editor.js').Editor} editor
     */
    constructor(editor) {
        this.editor = editor;

        // State
        this.isDragging = false;
        this.isPanning = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Undo: track whether we have an active action for the current drag
        this._actionActive = false;
        // Undo: line state at drag start (for vertex drag undo)
        this._dragStartLine = null;

        // Keys
        this.shiftPressed = false;
        this.ctrlPressed = false;
        this.spacePressed = false;

        // Cursor manager
        this.cursorManager = new CursorManager();

        this._bindEvents();

        // Listen for tool changes
        this.editor.on('toolChanged', () => {
            this.updateCursor();
            this.editor.renderSystem.setCurrentTool(this.editor.currentTool);
        });

        // Listen for grid size changes
        this.editor.on('gridSizeChanged', () => {
            this.cursorManager.clearCache();
            this.updateCursor();
        });

        // Listen for brush size changes (re-render to update preview)
        this.editor.on('brushSizeChanged', () => {
            this.cursorManager.clearCache();
            this.updateCursor();
            this.editor.render();
        });

        // Set initial cursor and tool after a brief delay to ensure everything is ready
        setTimeout(() => {
            this.updateCursor();
            this.editor.renderSystem.setCurrentTool(this.editor.currentTool);
        }, 0);
    }

    /**
     * Update cursor based on current tool and grid size
     */
    updateCursor() {
        if (this.spacePressed || this.isPanning) {
            return; // Don't override pan cursor
        }

        const tool = this.editor.currentTool;
        const gridSize = this.editor.renderSystem.gridSize;
        const isErasing = tool === TOOLS.BRUSH && this.shiftPressed;

        const cursor = this.cursorManager.getCursor(tool, gridSize, isErasing);
        this.editor.overlayCanvas.style.cursor = cursor;
    }

    /**
     * Bind all event listeners
     * @private
     */
    _bindEvents() {
        const canvas = this.editor.overlayCanvas;

        // Mouse events on overlay canvas
        canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
        canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
        canvas.addEventListener('mouseup', this._onMouseUp.bind(this));
        canvas.addEventListener('mouseleave', this._onMouseLeave.bind(this));
        canvas.addEventListener('dblclick', this._onDoubleClick.bind(this));
        canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
        canvas.addEventListener('contextmenu', this._onContextMenu.bind(this));

        // Keyboard events on window
        window.addEventListener('keydown', this._onKeyDown.bind(this));
        window.addEventListener('keyup', this._onKeyUp.bind(this));
    }

    /**
     * Get canvas-space coordinates from mouse event
     * @private
     */
    _getCanvasCoords(e) {
        const rect = this.editor.overlayCanvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        return this.editor.renderSystem.screenToCanvas(screenX, screenY);
    }

    /**
     * Get screen-space coordinates from mouse event
     * @private
     */
    _getScreenCoords(e) {
        const rect = this.editor.overlayCanvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    /**
     * Mouse down handler
     * @private
     */
    _onMouseDown(e) {
        const screen = this._getScreenCoords(e);
        const coords = this._getCanvasCoords(e);

        this.lastMouseX = screen.x;
        this.lastMouseY = screen.y;

        // Space + drag = pan
        if (this.spacePressed || e.button === 1) {
            this.isPanning = true;
            this.editor.overlayCanvas.style.cursor = 'grabbing';
            return;
        }

        // Left click
        if (e.button === 0) {
            this._handleLeftClick(coords, e);
        }

        // Right click - tool cycle (handled in context menu for now)
    }

    /**
     * Handle left click based on current tool
     * @private
     */
    async _handleLeftClick(coords, e) {
        const tool = this.editor.currentTool;
        const gridSize = this.editor.renderSystem.gridSize;
        const hex = pixelToHex(coords.x, coords.y, gridSize);

        // Check if we need to switch to a block layer for block operations
        const isBlockTool = [TOOLS.BRUSH, TOOLS.ERASER, TOOLS.FILL].includes(tool);
        if (isBlockTool && !await this._ensureBlockLayerActive()) {
            return; // User cancelled or no block layer available
        }

        switch (tool) {
            case TOOLS.BRUSH:
                this.isDragging = true;
                this.editor.beginAction();
                this._actionActive = true;
                if (this.shiftPressed) {
                    // Eraser mode
                    this.editor.blockManager.eraseWithBrush(hex.row, hex.col);
                } else {
                    this.editor.blockManager.placeWithBrush(hex.row, hex.col);
                }
                this.editor.render();
                break;

            case TOOLS.ERASER:
                this.isDragging = true;
                this.editor.beginAction();
                this._actionActive = true;
                this.editor.blockManager.eraseWithBrush(hex.row, hex.col);
                this.editor.render();
                break;

            case TOOLS.FILL:
                const block = this.editor.blockManager.getBlock(hex.row, hex.col);
                if (block) {
                    this.editor.beginAction();
                    this.editor.blockManager.floodFill(
                        hex.row, hex.col,
                        this.editor.blockManager.currentDurability
                    );
                    this.editor.endAction();
                    this.editor.render();
                }
                break;

            case TOOLS.LINE:
                this._handleLineTool(coords);
                break;

            case TOOLS.SELECT:
                this._handleSelectTool(coords, e);
                break;

            case TOOLS.EYEDROPPER:
                const sampleBlock = this.editor.blockManager.getBlock(hex.row, hex.col);
                if (sampleBlock) {
                    this.editor.blockManager.setDurability(sampleBlock.durability);
                    this.editor.blockManager.setColor(sampleBlock.color);
                    this.editor.emit('colorPicked', sampleBlock);
                }
                break;
        }
    }

    /**
     * Handle line tool click
     * @private
     */
    _handleLineTool(coords) {
        const lineManager = this.editor.lineManager;

        if (!lineManager.isDrawing) {
            // Check if clicking on existing line vertex (start drag)
            const vertexHit = lineManager.findVertexAt(coords.x, coords.y);
            if (vertexHit) {
                lineManager.selectLine(vertexHit.line.id);
                lineManager.selectVertex(vertexHit.vertexIndex);
                this.isDragging = true;
                // Save line state before drag for undo
                this.editor.beginAction();
                this._actionActive = true;
                this._dragStartLine = JSON.parse(JSON.stringify(vertexHit.line));
                this.editor.render();
                return;
            }

            // Check if clicking on existing line
            const lineHit = lineManager.findLineAt(coords.x, coords.y);
            if (lineHit) {
                lineManager.selectLine(lineHit.line.id);
                this.editor.render();
                return;
            }

            // Start new line drawing with snap
            lineManager.selectLine(null);
            this.editor.beginAction();
            this._actionActive = true;
            const snapStart = SnapHelper.getSnapPoint(coords.x, coords.y, this.editor);
            lineManager.startDrawing(snapStart.x, snapStart.y);
        } else {
            // Add point to current line with snap
            const snapPoint = SnapHelper.getSnapPoint(coords.x, coords.y, this.editor);
            lineManager.addPoint(snapPoint.x, snapPoint.y);

            // addPoint may trigger finishDrawing internally (loop close / same-point click)
            if (!lineManager.isDrawing && this._actionActive) {
                this.editor.endAction();
                this._actionActive = false;
            }
        }

        this.editor.render();
    }

    /**
     * Handle select tool
     * @private
     */
    _handleSelectTool(coords, e) {
        this.isDragging = true;
        this.dragStartX = coords.x;
        this.dragStartY = coords.y;

        if (!this.shiftPressed) {
            this.editor.blockManager.clearSelection();
        }
    }

    /**
     * Mouse move handler
     * @private
     */
    _onMouseMove(e) {
        const screen = this._getScreenCoords(e);
        const coords = this._getCanvasCoords(e);
        const gridSize = this.editor.renderSystem.gridSize;

        // Handle panning
        if (this.isPanning) {
            const dx = screen.x - this.lastMouseX;
            const dy = screen.y - this.lastMouseY;

            this.editor.renderSystem.offsetX += dx;
            this.editor.renderSystem.offsetY += dy;

            this.lastMouseX = screen.x;
            this.lastMouseY = screen.y;

            this.editor.render();
            return;
        }

        // Update hover hex
        const hex = pixelToHex(coords.x, coords.y, gridSize);
        this.editor.renderSystem.setHoverHex(hex.row, hex.col);

        // Update snap point for line tool
        if (this.editor.currentTool === TOOLS.LINE) {
            const snapPoint = SnapHelper.getSnapPoint(coords.x, coords.y, this.editor);
            this.editor.renderSystem.setHoverSnapPoint(snapPoint);
        } else {
            this.editor.renderSystem.setHoverSnapPoint(null);
        }

        // Handle dragging
        if (this.isDragging) {
            switch (this.editor.currentTool) {
                case TOOLS.BRUSH:
                    if (this.shiftPressed) {
                        this.editor.blockManager.eraseWithBrush(hex.row, hex.col);
                    } else {
                        this.editor.blockManager.placeWithBrush(hex.row, hex.col);
                    }
                    break;

                case TOOLS.ERASER:
                    this.editor.blockManager.eraseWithBrush(hex.row, hex.col);
                    break;

                case TOOLS.LINE:
                    // Drag vertex with snap
                    if (this.editor.lineManager.selectedLineId &&
                        this.editor.lineManager.selectedVertexIndex !== null) {
                        const snapDrag = SnapHelper.getSnapPoint(coords.x, coords.y, this.editor);
                        this.editor.lineManager.moveVertex(
                            this.editor.lineManager.selectedLineId,
                            this.editor.lineManager.selectedVertexIndex,
                            snapDrag.x, snapDrag.y
                        );
                    }
                    break;

                case TOOLS.SELECT:
                    // Update selection rectangle
                    this.editor.blockManager.selectInRect(
                        this.dragStartX, this.dragStartY,
                        coords.x, coords.y,
                        gridSize
                    );
                    break;
            }
        }

        // Update cursor for line tool
        if (this.editor.currentTool === TOOLS.LINE) {
            const vertexHit = this.editor.lineManager.findVertexAt(coords.x, coords.y);
            if (vertexHit && this.editor.lineManager.selectedLineId === vertexHit.line.id) {
                this.editor.lineManager.hoveredVertexIndex = vertexHit.vertexIndex;
            } else {
                this.editor.lineManager.hoveredVertexIndex = null;
            }
        }

        // Set erasing state for render
        this.editor.renderSystem.setErasing(
            this.editor.currentTool === TOOLS.ERASER ||
            (this.editor.currentTool === TOOLS.BRUSH && this.shiftPressed)
        );

        this.lastMouseX = screen.x;
        this.lastMouseY = screen.y;

        this.editor.render();
    }

    /**
     * Mouse up handler
     * @private
     */
    _onMouseUp(e) {
        const wasDragging = this.isDragging;
        this.isDragging = false;
        this.isPanning = false;

        if (this.spacePressed) {
            this.editor.overlayCanvas.style.cursor = 'grab';
        } else {
            this.updateCursor();
        }

        // End undo action for brush/eraser drag
        if (wasDragging && this._actionActive) {
            const tool = this.editor.currentTool;

            // Handle vertex drag: record the before/after diff
            if (tool === TOOLS.LINE && this._dragStartLine) {
                const currentLine = this.editor.lineManager.getLine(this._dragStartLine.id);
                if (currentLine) {
                    this.editor.historySystem.recordChange({
                        type: 'line',
                        action: 'update',
                        lineId: currentLine.id,
                        oldLine: this._dragStartLine,
                        newLine: JSON.parse(JSON.stringify(currentLine))
                    });
                }
                this._dragStartLine = null;
            }

            this.editor.endAction();
            this._actionActive = false;
        }

        // Deselect vertex
        if (this.editor.currentTool === TOOLS.LINE) {
            this.editor.lineManager.selectVertex(null);
        }
    }

    /**
     * Mouse leave handler
     * @private
     */
    _onMouseLeave(e) {
        this.editor.renderSystem.setHoverHex(null, null);
        this.editor.render();
    }

    /**
     * Double click handler
     * @private
     */
    _onDoubleClick(e) {
        const coords = this._getCanvasCoords(e);

        if (this.editor.currentTool === TOOLS.LINE) {
            if (this.editor.lineManager.isDrawing) {
                // Finish drawing (beginAction was called in _handleLineTool)
                this.editor.lineManager.finishDrawing(false);
                // End the action that was started when drawing began
                if (this._actionActive) {
                    this.editor.endAction();
                    this._actionActive = false;
                }
                this.editor.render();
            } else if (this.editor.lineManager.selectedLineId) {
                // Insert vertex on selected line
                const lineHit = this.editor.lineManager.findLineAt(coords.x, coords.y);
                if (lineHit && lineHit.line.id === this.editor.lineManager.selectedLineId) {
                    this.editor.beginAction();
                    this.editor.lineManager.insertVertex(
                        lineHit.line.id,
                        lineHit.segmentIndex,
                        coords.x, coords.y
                    );
                    this.editor.endAction();
                    this.editor.render();
                }
            }
        }
    }

    /**
     * Mouse wheel handler
     * @private
     */
    _onWheel(e) {
        e.preventDefault();

        const screen = this._getScreenCoords(e);
        const beforeZoom = this.editor.renderSystem.screenToCanvas(screen.x, screen.y);

        // Zoom
        const delta = e.deltaY > 0 ? -ZOOM_CONFIG.step : ZOOM_CONFIG.step;
        let newScale = this.editor.renderSystem.scale + delta;
        newScale = Math.max(ZOOM_CONFIG.min, Math.min(ZOOM_CONFIG.max, newScale));

        this.editor.renderSystem.scale = newScale;

        // Adjust offset to zoom towards cursor
        const afterZoom = this.editor.renderSystem.screenToCanvas(screen.x, screen.y);
        this.editor.renderSystem.offsetX += (afterZoom.x - beforeZoom.x) * newScale;
        this.editor.renderSystem.offsetY += (afterZoom.y - beforeZoom.y) * newScale;

        this.editor.render();
        this.editor.emit('zoomChanged', newScale);
    }

    /**
     * Context menu handler
     * @private
     */
    _onContextMenu(e) {
        e.preventDefault();

        const coords = this._getCanvasCoords(e);

        // Line tool: cancel last point or delete vertex
        if (this.editor.currentTool === TOOLS.LINE) {
            if (this.editor.lineManager.isDrawing) {
                // undoLastPoint returns false if only 1 point remains - cancel entirely
                if (!this.editor.lineManager.undoLastPoint()) {
                    this.editor.lineManager.cancelDrawing();
                    // End the action that was started when drawing began
                    if (this._actionActive) {
                        this.editor.endAction();
                        this._actionActive = false;
                    }
                }
                this.editor.render();
                return;
            }

            // Delete vertex if right-clicking on one
            const vertexHit = this.editor.lineManager.findVertexAt(coords.x, coords.y);
            if (vertexHit && this.editor.lineManager.selectedLineId === vertexHit.line.id) {
                this.editor.beginAction();
                this.editor.lineManager.deleteVertex(vertexHit.line.id, vertexHit.vertexIndex);
                this.editor.endAction();
                this.editor.render();
                return;
            }
        }

        // Block right-click menu
        const gridSize = this.editor.renderSystem.gridSize;
        const hex = pixelToHex(coords.x, coords.y, gridSize);
        const block = this.editor.blockManager.getBlock(hex.row, hex.col);

        if (block) {
            this.editor.emit('blockContextMenu', {
                block,
                hex,
                screenX: e.clientX,
                screenY: e.clientY
            });
            return;
        }

        // Default: cycle tool
        this._cycleTool();
    }

    /**
     * Cycle through tools
     * @private
     */
    _cycleTool() {
        const tools = [TOOLS.BRUSH, TOOLS.ERASER, TOOLS.LINE];
        const currentIndex = tools.indexOf(this.editor.currentTool);
        const nextIndex = (currentIndex + 1) % tools.length;
        this.editor.setTool(tools[nextIndex]);
    }

    /**
     * Ensure a block layer is active for block operations.
     * If an image layer is active, prompt user to switch to nearest block layer.
     * @private
     * @returns {Promise<boolean>} True if a block layer is now active, false if cancelled or unavailable
     */
    async _ensureBlockLayerActive() {
        const layerManager = this.editor.layerManager;
        const activeLayer = layerManager.getActiveLayer();

        // Already a block layer
        if (activeLayer && activeLayer.type === 'block') {
            return true;
        }

        // No active layer
        if (!activeLayer) {
            this.editor.emit('message', { type: 'warning', text: 'レイヤーが選択されていません' });
            return false;
        }

        // Active layer is image - find nearest block layer
        const nearestBlockLayer = layerManager.findNearestBlockLayerAbove(activeLayer.id);

        if (!nearestBlockLayer) {
            this.editor.emit('message', { type: 'warning', text: 'ブロックレイヤーがありません。ブロックレイヤーを追加してください。' });
            return false;
        }

        // Prompt user
        const shouldSwitch = await dialogService.confirm(`レイヤー「${nearestBlockLayer.name}」を選択して編集しますか？`);

        if (shouldSwitch) {
            layerManager.setActiveLayer(nearestBlockLayer.id);
            return true;
        }

        return false;
    }

    /**
     * Key down handler
     * @private
     */
    _onKeyDown(e) {
        // Update modifier keys
        const wasShiftPressed = this.shiftPressed;
        this.shiftPressed = e.shiftKey;
        this.ctrlPressed = e.ctrlKey;

        // Update cursor when shift pressed (brush eraser mode)
        if (!wasShiftPressed && this.shiftPressed) {
            this.updateCursor();
        }

        if (e.code === 'Space' && !this.spacePressed) {
            this.spacePressed = true;
            this.editor.overlayCanvas.style.cursor = 'grab';
            e.preventDefault();
        }

        // Tool shortcuts
        if (!e.ctrlKey && !e.altKey) {
            switch (e.code) {
                case 'KeyB':
                    this.editor.setTool(TOOLS.BRUSH);
                    break;
                case 'KeyE':
                    this.editor.setTool(TOOLS.ERASER);
                    break;
                case 'KeyL':
                    this.editor.setTool(TOOLS.LINE);
                    break;
                case 'KeyG':
                    this.editor.setTool(TOOLS.FILL);
                    break;
                case 'KeyI':
                    this.editor.setTool(TOOLS.EYEDROPPER);
                    break;
                case 'KeyV':
                    this.editor.setTool(TOOLS.SELECT);
                    break;
            }
        }

        // Escape - cancel operations
        if (e.code === 'Escape') {
            if (this.editor.lineManager.isDrawing) {
                this.editor.lineManager.cancelDrawing();
                // End the action that was started when drawing began (empty action is auto-discarded)
                if (this._actionActive) {
                    this.editor.endAction();
                    this._actionActive = false;
                }
                this.editor.render();
            }
            this.editor.blockManager.clearSelection();
            this.editor.render();
        }

        // Delete - delete selected
        if (e.code === 'Delete') {
            // Delete selected line
            if (this.editor.lineManager.selectedLineId) {
                this.editor.beginAction();
                this.editor.lineManager.deleteLine(this.editor.lineManager.selectedLineId);
                this.editor.endAction();
                this.editor.render();
            }
            // Delete selected blocks
            if (this.editor.blockManager.selectedHexes.size > 0) {
                this.editor.beginAction();
                this.editor.blockManager.deleteSelection();
                this.editor.endAction();
                this.editor.render();
            }
        }

        // Enter - fill selection
        if (e.code === 'Enter') {
            if (this.editor.blockManager.selectedHexes.size > 0) {
                this.editor.beginAction();
                this.editor.blockManager.fillSelection();
                this.editor.endAction();
                this.editor.blockManager.clearSelection();
                this.editor.render();
            }
        }

        // Ctrl+Shift+S - Save As
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
            e.preventDefault();
            this.editor.emit('saveAs');
            return;
        }

        // Ctrl+S - Save
        if (e.ctrlKey && e.code === 'KeyS') {
            e.preventDefault();
            this.editor.emit('save');
        }

        // Ctrl+Z - Undo
        if (e.ctrlKey && e.code === 'KeyZ' && !e.shiftKey) {
            e.preventDefault();
            this.editor.emit('undo');
        }

        // Ctrl+Y or Ctrl+Shift+Z - Redo
        if ((e.ctrlKey && e.code === 'KeyY') ||
            (e.ctrlKey && e.shiftKey && e.code === 'KeyZ')) {
            e.preventDefault();
            this.editor.emit('redo');
        }

        // Grid toggle
        if (e.code === 'KeyH' && !e.ctrlKey) {
            this.editor.renderSystem.showGrid = !this.editor.renderSystem.showGrid;
            this.editor.render();
        }

        // Durability keys (1-9)
        if (!e.ctrlKey && !e.altKey) {
            const num = parseInt(e.key);
            if (num >= 1 && num <= 9) {
                this.editor.blockManager.setDurability(num);
                this.editor.emit('durabilityChanged', num);
            }
        }

        // Brush size shortcuts
        if (e.code === 'BracketLeft') {
            this._changeBrushSize(-1);
        }
        if (e.code === 'BracketRight') {
            this._changeBrushSize(1);
        }
    }

    /**
     * Change brush size
     * @private
     */
    _changeBrushSize(direction) {
        const sizes = ['S', 'M', 'L'];
        const current = sizes.indexOf(this.editor.blockManager.brushSize);
        const next = Math.max(0, Math.min(2, current + direction));
        this.editor.blockManager.setBrushSize(sizes[next]);
        this.editor.emit('brushSizeChanged', sizes[next]);
    }

    /**
     * Key up handler
     * @private
     */
    _onKeyUp(e) {
        this.shiftPressed = e.shiftKey;
        this.ctrlPressed = e.ctrlKey;

        if (e.code === 'Space') {
            this.spacePressed = false;
            if (!this.isPanning) {
                this.updateCursor();
            }
        }

        // Update cursor when shift released (brush eraser mode)
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            this.updateCursor();
        }
    }
}
