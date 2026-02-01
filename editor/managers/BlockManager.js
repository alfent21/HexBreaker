/**
 * BlockManager.js - Block Operations
 * Based on specification.md Section 2.4
 * 
 * Manages block placement, editing, and selection operations
 * on the active block layer.
 */

import { getHexKey, parseHexKey, getHexNeighbors, hexToPixel, getMaxRow, getMaxCol, isValidHexPosition } from '../../shared/HexMath.js';
import { BLOCK_DEFAULTS, BRUSH_SIZES, DURABILITY_COLORS } from '../core/Config.js';

export class BlockManager {
    /**
     * @param {import('./LayerManager.js').LayerManager} layerManager
     * @param {import('../core/Editor.js').Editor} [editor] - Editor reference for boundary checking
     */
    constructor(layerManager, editor = null) {
        this.layerManager = layerManager;
        this.editor = editor;

        // Current block settings
        this.currentDurability = BLOCK_DEFAULTS.durability;
        this.currentColor = BLOCK_DEFAULTS.color;
        this.brushSize = 'M';

        // Selection state
        this.selectedHexes = new Set();

        // Event callbacks
        this.onBlockChange = null;
    }

    /**
     * Check if a hex position is within valid canvas bounds
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    isValidPosition(row, col) {
        if (row < 0 || col < 0) return false;

        const gameArea = this.layerManager.gameAreaSize;
        const gridSize = this.editor?.renderSystem?.gridSize;

        // Reject if no stage/gameArea exists
        if (!gameArea || !gridSize) return false;

        return isValidHexPosition(row, col, gameArea.width, gameArea.height, gridSize);
    }

    /**
     * Get the active block layer
     * @returns {import('./LayerManager.js').BlockLayer|null}
     */
    getActiveBlockLayer() {
        const layer = this.layerManager.getActiveLayer();
        if (layer && layer.type === 'block') {
            return layer;
        }
        return null;
    }

    /**
     * Set current durability for new blocks
     * @param {number} durability - Durability value (1-10)
     */
    setDurability(durability) {
        this.currentDurability = Math.max(1, Math.min(10, durability));
    }

    /**
     * Set current color for new blocks
     * @param {string} color - Color in #RRGGBB format
     */
    setColor(color) {
        this.currentColor = color;
    }

    /**
     * Set brush size
     * @param {'S'|'M'|'L'} size - Brush size
     */
    setBrushSize(size) {
        if (BRUSH_SIZES[size]) {
            this.brushSize = size;
        }
    }

    /**
     * Get color for a durability level
     * @param {number} durability
     * @returns {string}
     */
    getDurabilityColor(durability) {
        return DURABILITY_COLORS[durability] || DURABILITY_COLORS[1];
    }

    /**
     * Get cells affected by brush at position
     * @param {number} row - Center row
     * @param {number} col - Center column
     * @returns {{row: number, col: number}[]}
     */
    getBrushCells(row, col) {
        const cells = [{ row, col }];
        const range = BRUSH_SIZES[this.brushSize].range;

        if (range >= 1) {
            // Add adjacent cells
            const neighbors = getHexNeighbors(row, col);
            cells.push(...neighbors);
        }

        if (range >= 2) {
            // Add second-level adjacent cells
            const firstLevel = [...cells];
            for (const cell of firstLevel) {
                const neighbors = getHexNeighbors(cell.row, cell.col);
                for (const neighbor of neighbors) {
                    const key = getHexKey(neighbor.row, neighbor.col);
                    if (!cells.some(c => getHexKey(c.row, c.col) === key)) {
                        cells.push(neighbor);
                    }
                }
            }
        }

        return cells;
    }

    /**
     * Place a single block
     * @param {number} row
     * @param {number} col
     * @param {Object} [options] - Optional overrides
     * @returns {boolean} True if block was placed
     */
    placeBlock(row, col, options = {}) {
        const layer = this.getActiveBlockLayer();
        if (!layer) return false;

        // Boundary check
        if (!this.isValidPosition(row, col)) return false;

        const key = getHexKey(row, col);
        const blockData = {
            row,
            col,
            durability: options.durability ?? this.currentDurability,
            color: options.color ?? this.currentColor,
            ...options
        };

        layer.blocks.set(key, blockData);
        this._emitChange();
        return true;
    }

    /**
     * Place blocks using brush
     * @param {number} row - Center row
     * @param {number} col - Center column
     * @param {Object} [options] - Optional overrides
     * @returns {number} Number of blocks placed
     */
    placeWithBrush(row, col, options = {}) {
        const layer = this.getActiveBlockLayer();
        if (!layer) return 0;

        const cells = this.getBrushCells(row, col);
        let count = 0;

        for (const cell of cells) {
            if (this.isValidPosition(cell.row, cell.col)) {
                const key = getHexKey(cell.row, cell.col);
                const blockData = {
                    row: cell.row,
                    col: cell.col,
                    durability: options.durability ?? this.currentDurability,
                    color: options.color ?? this.currentColor,
                    ...options
                };
                layer.blocks.set(key, blockData);
                count++;
            }
        }

        if (count > 0) {
            this._emitChange();
        }
        return count;
    }

    /**
     * Remove a single block
     * @param {number} row
     * @param {number} col
     * @returns {boolean} True if block was removed
     */
    removeBlock(row, col) {
        const layer = this.getActiveBlockLayer();
        if (!layer) return false;

        const key = getHexKey(row, col);
        const removed = layer.blocks.delete(key);

        if (removed) {
            this._emitChange();
        }
        return removed;
    }

    /**
     * Remove blocks using brush
     * @param {number} row - Center row
     * @param {number} col - Center column
     * @returns {number} Number of blocks removed
     */
    eraseWithBrush(row, col) {
        const layer = this.getActiveBlockLayer();
        if (!layer) return 0;

        const cells = this.getBrushCells(row, col);
        let count = 0;

        for (const cell of cells) {
            const key = getHexKey(cell.row, cell.col);
            if (layer.blocks.delete(key)) {
                count++;
            }
        }

        if (count > 0) {
            this._emitChange();
        }
        return count;
    }

    /**
     * Get block at position
     * @param {number} row
     * @param {number} col
     * @returns {import('./LayerManager.js').BlockData|null}
     */
    getBlock(row, col) {
        const layer = this.getActiveBlockLayer();
        if (!layer) return null;

        const key = getHexKey(row, col);
        return layer.blocks.get(key) || null;
    }

    /**
     * Check if block exists at position
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    hasBlock(row, col) {
        const layer = this.getActiveBlockLayer();
        if (!layer) return false;

        const key = getHexKey(row, col);
        return layer.blocks.has(key);
    }

    /**
     * Update block properties
     * @param {number} row
     * @param {number} col
     * @param {Object} updates - Properties to update
     * @returns {boolean}
     */
    updateBlock(row, col, updates) {
        const layer = this.getActiveBlockLayer();
        if (!layer) return false;

        const key = getHexKey(row, col);
        const block = layer.blocks.get(key);
        if (!block) return false;

        Object.assign(block, updates);
        this._emitChange();
        return true;
    }

    /**
     * Flood fill - change durability of connected same-durability blocks
     * @param {number} row
     * @param {number} col
     * @param {number} newDurability
     * @returns {number} Number of blocks changed
     */
    floodFill(row, col, newDurability) {
        const layer = this.getActiveBlockLayer();
        if (!layer) return 0;

        const startKey = getHexKey(row, col);
        const startBlock = layer.blocks.get(startKey);
        if (!startBlock) return 0;

        const targetDurability = startBlock.durability;
        if (targetDurability === newDurability) return 0;

        // BFS flood fill
        const visited = new Set();
        const queue = [{ row, col }];
        let count = 0;

        while (queue.length > 0) {
            const current = queue.shift();
            const key = getHexKey(current.row, current.col);

            if (visited.has(key)) continue;
            visited.add(key);

            const block = layer.blocks.get(key);
            if (!block || block.durability !== targetDurability) continue;

            // Update this block
            block.durability = newDurability;
            block.color = this.getDurabilityColor(newDurability);
            count++;

            // Add neighbors to queue
            const neighbors = getHexNeighbors(current.row, current.col);
            for (const neighbor of neighbors) {
                const neighborKey = getHexKey(neighbor.row, neighbor.col);
                if (!visited.has(neighborKey)) {
                    queue.push(neighbor);
                }
            }
        }

        if (count > 0) {
            this._emitChange();
        }
        return count;
    }

    /**
     * Select hexes in a rectangular pixel region
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {Object} gridSize - Grid size config
     */
    selectInRect(x1, y1, x2, y2, gridSize) {
        this.selectedHexes.clear();

        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        // Scan through grid cells that might be in the rect
        const { width, verticalSpacing, radius } = gridSize;

        // Calculate upper bounds based on canvas size
        const gameArea = this.layerManager.gameAreaSize;
        const maxValidRow = gameArea ? getMaxRow(gameArea.height, gridSize) : Infinity;
        const maxValidCol = gameArea ? getMaxCol(gameArea.width, gridSize) : Infinity;

        const startRow = Math.max(0, Math.floor((minY - radius) / verticalSpacing));
        const endRow = Math.min(Math.ceil((maxY + radius) / verticalSpacing), maxValidRow);
        const startCol = Math.max(0, Math.floor((minX - width) / width));
        const endCol = Math.min(Math.ceil((maxX + width) / width), maxValidCol);

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const center = hexToPixel(row, col, gridSize);

                if (center.x >= minX && center.x <= maxX &&
                    center.y >= minY && center.y <= maxY) {
                    this.selectedHexes.add(getHexKey(row, col));
                }
            }
        }
    }

    /**
     * Place blocks in selected hexes
     * @returns {number} Number of blocks placed
     */
    fillSelection() {
        const layer = this.getActiveBlockLayer();
        if (!layer) return 0;

        let count = 0;
        for (const key of this.selectedHexes) {
            const { row, col } = parseHexKey(key);
            const blockData = {
                row,
                col,
                durability: this.currentDurability,
                color: this.currentColor
            };
            layer.blocks.set(key, blockData);
            count++;
        }

        if (count > 0) {
            this._emitChange();
        }
        return count;
    }

    /**
     * Delete blocks in selected hexes
     * @returns {number} Number of blocks deleted
     */
    deleteSelection() {
        const layer = this.getActiveBlockLayer();
        if (!layer) return 0;

        let count = 0;
        for (const key of this.selectedHexes) {
            if (layer.blocks.delete(key)) {
                count++;
            }
        }

        if (count > 0) {
            this._emitChange();
        }
        return count;
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedHexes.clear();
    }

    /**
     * Get all blocks from the active layer
     * @returns {Map<string, import('./LayerManager.js').BlockData>}
     */
    getAllBlocks() {
        const layer = this.getActiveBlockLayer();
        return layer ? layer.blocks : new Map();
    }

    /**
     * Get block count
     * @returns {number}
     */
    getBlockCount() {
        const layer = this.getActiveBlockLayer();
        return layer ? layer.blocks.size : 0;
    }

    /**
     * Clear all blocks in active layer
     */
    clearAllBlocks() {
        const layer = this.getActiveBlockLayer();
        if (layer) {
            layer.blocks.clear();
            this._emitChange();
        }
    }

    /**
     * Emit block change event
     * @private
     */
    _emitChange() {
        if (this.onBlockChange) {
            this.onBlockChange();
        }
    }
}
