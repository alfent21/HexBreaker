/**
 * LineManager.js - Line System
 * Based on specification.md Section 2.3
 * 
 * Manages physics lines (walls, paddles, misslines, decoration).
 */

import { LINE_TYPES, LINE_DEFAULTS } from '../core/Config.js';

/**
 * @typedef {Object} LineData
 * @property {string} id - Unique line ID
 * @property {{x: number, y: number}[]} points - Polyline vertices
 * @property {boolean} closed - Whether the line forms a loop
 * @property {'collision'|'missline'|'paddle'|'decoration'} type
 * @property {string} color - Line color
 * @property {number} thickness - Line width in pixels
 * @property {number} opacity - 0.0 - 1.0
 * @property {string} [paddleControl] - Paddle control mode
 * @property {Object} [blockGuide] - Block guide settings for collision lines
 */

export class LineManager {
    constructor() {
        /** @type {LineData[]} */
        this.lines = [];

        /** @type {string|null} */
        this.selectedLineId = null;

        /** @type {number|null} */
        this.selectedVertexIndex = null;

        /** @type {number|null} */
        this.hoveredVertexIndex = null;

        // Drawing state
        this.isDrawing = false;
        this.currentPoints = [];

        // Current line type for new lines
        this.currentLineType = 'collision';

        // Event callbacks
        this.onLineChange = null;
        this.onSelectionChange = null;
    }

    /**
     * Generate unique line ID
     * @returns {string}
     */
    generateId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 7);
        return `line_${timestamp}_${random}`;
    }

    /**
     * Start drawing a new line
     * @param {number} x
     * @param {number} y
     */
    startDrawing(x, y) {
        this.isDrawing = true;
        this.currentPoints = [{ x, y }];
    }

    /**
     * Add point to current drawing
     * @param {number} x
     * @param {number} y
     * @returns {boolean} True if point was added (not duplicate)
     */
    addPoint(x, y) {
        if (!this.isDrawing) return false;

        const lastPoint = this.currentPoints[this.currentPoints.length - 1];

        // Check if clicking on start point (close loop)
        if (this.currentPoints.length >= 3) {
            const firstPoint = this.currentPoints[0];
            const distToStart = Math.hypot(x - firstPoint.x, y - firstPoint.y);
            if (distToStart < 10) {
                return this.finishDrawing(true);
            }
        }

        // Check if clicking on same point (finish open line)
        const distToLast = Math.hypot(x - lastPoint.x, y - lastPoint.y);
        if (distToLast < 5) {
            return this.finishDrawing(false);
        }

        this.currentPoints.push({ x, y });
        return true;
    }

    /**
     * Finish drawing and create line
     * @param {boolean} closed - Whether to close the loop
     * @returns {LineData|null} Created line or null
     */
    finishDrawing(closed = false) {
        if (!this.isDrawing || this.currentPoints.length < 2) {
            this.cancelDrawing();
            return null;
        }

        const typeConfig = LINE_TYPES[this.currentLineType.toUpperCase()] || LINE_TYPES.COLLISION;

        const line = this.createLine(this.currentPoints, {
            closed,
            type: this.currentLineType,
            color: typeConfig.color,
            thickness: LINE_DEFAULTS.thickness,
            opacity: LINE_DEFAULTS.opacity
        });

        this.isDrawing = false;
        this.currentPoints = [];

        return line;
    }

    /**
     * Cancel current drawing
     */
    cancelDrawing() {
        this.isDrawing = false;
        this.currentPoints = [];
    }

    /**
     * Remove last point from current drawing
     * @returns {boolean} True if point was removed
     */
    undoLastPoint() {
        if (!this.isDrawing || this.currentPoints.length <= 1) return false;
        this.currentPoints.pop();
        return true;
    }

    /**
     * Create a new line
     * @param {{x: number, y: number}[]} points
     * @param {Object} options
     * @returns {LineData}
     */
    createLine(points, options = {}) {
        const line = {
            id: this.generateId(),
            points: [...points],
            closed: options.closed ?? false,
            type: options.type ?? LINE_DEFAULTS.type,
            color: options.color ?? LINE_TYPES[options.type?.toUpperCase()]?.color ?? LINE_DEFAULTS.color,
            thickness: options.thickness ?? LINE_DEFAULTS.thickness,
            opacity: options.opacity ?? LINE_DEFAULTS.opacity,
            paddleControl: options.paddleControl ?? LINE_DEFAULTS.paddleControl
        };

        // Add block guide for collision lines
        if (line.type === 'collision') {
            line.blockGuide = options.blockGuide ?? {
                enabled: true,
                probability: null,  // Use stage default
                angleLimit: null    // Use stage default
            };
        }

        this.lines.push(line);
        this._emitChange();

        return line;
    }

    /**
     * Get line by ID
     * @param {string} id
     * @returns {LineData|null}
     */
    getLine(id) {
        return this.lines.find(l => l.id === id) || null;
    }

    /**
     * Get all lines
     * @returns {LineData[]}
     */
    getAllLines() {
        return [...this.lines];
    }

    /**
     * Get lines by type
     * @param {string} type
     * @returns {LineData[]}
     */
    getLinesByType(type) {
        return this.lines.filter(l => l.type === type);
    }

    /**
     * Delete line by ID
     * @param {string} id
     * @returns {boolean}
     */
    deleteLine(id) {
        const index = this.lines.findIndex(l => l.id === id);
        if (index === -1) return false;

        this.lines.splice(index, 1);

        if (this.selectedLineId === id) {
            this.selectedLineId = null;
            this.selectedVertexIndex = null;
        }

        this._emitChange();
        return true;
    }

    /**
     * Update line properties
     * @param {string} id
     * @param {Object} updates
     * @returns {boolean}
     */
    updateLine(id, updates) {
        const line = this.getLine(id);
        if (!line) return false;

        // Update color if type changes
        if (updates.type && updates.type !== line.type) {
            const typeConfig = LINE_TYPES[updates.type.toUpperCase()];
            if (typeConfig) {
                updates.color = typeConfig.color;
            }
        }

        Object.assign(line, updates);
        this._emitChange();
        return true;
    }

    /**
     * Select a line
     * @param {string|null} id
     */
    selectLine(id) {
        this.selectedLineId = id;
        this.selectedVertexIndex = null;
        this.hoveredVertexIndex = null;

        if (this.onSelectionChange) {
            this.onSelectionChange(this.getSelectedLine());
        }
    }

    /**
     * Get selected line
     * @returns {LineData|null}
     */
    getSelectedLine() {
        return this.selectedLineId ? this.getLine(this.selectedLineId) : null;
    }

    /**
     * Select a vertex on the selected line
     * @param {number|null} index
     */
    selectVertex(index) {
        this.selectedVertexIndex = index;
    }

    /**
     * Move a vertex
     * @param {string} lineId
     * @param {number} vertexIndex
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    moveVertex(lineId, vertexIndex, x, y) {
        const line = this.getLine(lineId);
        if (!line || vertexIndex < 0 || vertexIndex >= line.points.length) {
            return false;
        }

        line.points[vertexIndex] = { x, y };
        this._emitChange();
        return true;
    }

    /**
     * Insert a vertex at a position on a segment
     * @param {string} lineId
     * @param {number} afterIndex - Index of the vertex before insertion point
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    insertVertex(lineId, afterIndex, x, y) {
        const line = this.getLine(lineId);
        if (!line || afterIndex < 0 || afterIndex >= line.points.length) {
            return false;
        }

        line.points.splice(afterIndex + 1, 0, { x, y });
        this._emitChange();
        return true;
    }

    /**
     * Delete a vertex
     * @param {string} lineId
     * @param {number} vertexIndex
     * @returns {boolean}
     */
    deleteVertex(lineId, vertexIndex) {
        const line = this.getLine(lineId);
        if (!line || line.points.length <= 2) return false;
        if (vertexIndex < 0 || vertexIndex >= line.points.length) return false;

        line.points.splice(vertexIndex, 1);

        if (this.selectedVertexIndex === vertexIndex) {
            this.selectedVertexIndex = null;
        } else if (this.selectedVertexIndex > vertexIndex) {
            this.selectedVertexIndex--;
        }

        this._emitChange();
        return true;
    }

    /**
     * Find line near a point
     * @param {number} x
     * @param {number} y
     * @param {number} threshold - Distance threshold
     * @returns {{line: LineData, segmentIndex: number, distance: number}|null}
     */
    findLineAt(x, y, threshold = 10) {
        let closest = null;
        let minDist = threshold;

        for (const line of this.lines) {
            const numSegments = line.closed ? line.points.length : line.points.length - 1;

            for (let i = 0; i < numSegments; i++) {
                const p1 = line.points[i];
                const p2 = line.points[(i + 1) % line.points.length];

                const dist = this._pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);

                if (dist < minDist) {
                    minDist = dist;
                    closest = { line, segmentIndex: i, distance: dist };
                }
            }
        }

        return closest;
    }

    /**
     * Find vertex near a point
     * @param {number} x
     * @param {number} y
     * @param {number} threshold
     * @returns {{line: LineData, vertexIndex: number, distance: number}|null}
     */
    findVertexAt(x, y, threshold = 10) {
        let closest = null;
        let minDist = threshold;

        for (const line of this.lines) {
            for (let i = 0; i < line.points.length; i++) {
                const p = line.points[i];
                const dist = Math.hypot(x - p.x, y - p.y);

                if (dist < minDist) {
                    minDist = dist;
                    closest = { line, vertexIndex: i, distance: dist };
                }
            }
        }

        return closest;
    }

    /**
     * Calculate distance from point to line segment
     * @private
     */
    _pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            return Math.hypot(px - x1, py - y1);
        }

        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));

        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;

        return Math.hypot(px - closestX, py - closestY);
    }

    /**
     * Serialize lines for saving
     * @returns {Object[]}
     */
    serialize() {
        return this.lines.map(line => ({ ...line }));
    }

    /**
     * Deserialize lines
     * @param {Object[]} data
     */
    deserialize(data) {
        this.lines = data.map(line => ({ ...line }));
        this.selectedLineId = null;
        this.selectedVertexIndex = null;
        this._emitChange();
    }

    /**
     * Clear all lines
     */
    clear() {
        this.lines = [];
        this.selectedLineId = null;
        this.selectedVertexIndex = null;
        this.cancelDrawing();
        // Note: don't emit change when clearing for stage switch
    }

    /**
     * Load lines from array (for stage switching)
     * @param {Object[]} lineArray - Array of line data
     */
    loadFromArray(lineArray) {
        this.lines = (lineArray || []).map(line => ({ ...line }));
        this.selectedLineId = null;
        this.selectedVertexIndex = null;
        this.hoveredVertexIndex = null;
        this.cancelDrawing();
        // Note: don't emit change to avoid infinite loop with editor sync
    }

    /**
     * Emit change event
     * @private
     */
    _emitChange() {
        if (this.onLineChange) {
            this.onLineChange(this.lines);
        }
    }
}
