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
 * @property {'left'|'right'} [normalSide] - Paddle line "up" direction (play field side)
 * @property {string} [pairedMisslineId] - ID of paired missline (paddle only)
 * @property {string} [pairedPaddleId] - ID of paired paddle (missline only)
 * @property {number} [pairOffset] - Offset distance from paddle to missline
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

        // Current line settings for new lines
        this.currentLineType = 'collision';
        this.currentThickness = LINE_DEFAULTS.thickness;
        this.currentOpacity = LINE_DEFAULTS.opacity;

        // Pairing settings for paddle lines
        this.pairingEnabled = true;   // Default: ON
        this.pairOffset = 50;         // Default offset (matches _ensureDefaultLines)

        // Editor reference (set by Editor.js after construction)
        // null during initialization, assigned before any user operations
        this.editor = null;

        // Undo/Redo: suppress notifications during batch apply
        this._suppressNotify = false;

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

        let line;
        let finalPoints = [...this.currentPoints];

        // If resuming from a line, restore original properties
        if (this._resumingLineOptions) {
            // If we resumed from start, the points were reversed - reverse them back
            if (this._resumingFromStart) {
                finalPoints = finalPoints.reverse();
            }

            const opts = this._resumingLineOptions;
            line = this.createLine(finalPoints, {
                closed,
                type: opts.type,
                color: opts.color,
                thickness: opts.thickness,
                opacity: opts.opacity,
                paddleControl: opts.paddleControl,
                normalSide: opts.normalSide,
                tapRange: opts.tapRange,
                pathLineId: opts.pathLineId,
                pathSpeed: opts.pathSpeed,
                pairedMisslineId: opts.pairedMisslineId,
                pairedPaddleId: opts.pairedPaddleId,
                pairOffset: opts.pairOffset,
                blockGuide: opts.blockGuide
            });

            // Clear resume state
            this._resumingLineId = null;
            this._resumingLineOptions = null;
            this._resumingFromStart = false;
        } else {
            const typeConfig = LINE_TYPES[this.currentLineType.toUpperCase()] || LINE_TYPES.COLLISION;

            // Use createPaddleWithMissline for paddle type when pairing is enabled
            if (this.currentLineType === 'paddle' && this.pairingEnabled) {
                const result = this.createPaddleWithMissline(finalPoints, {
                    closed,
                    color: typeConfig.color,
                    thickness: this.currentThickness,
                    opacity: this.currentOpacity
                }, this.pairOffset);
                line = result.paddle;
            } else {
                line = this.createLine(finalPoints, {
                    closed,
                    type: this.currentLineType,
                    color: typeConfig.color,
                    thickness: this.currentThickness,
                    opacity: this.currentOpacity
                });
            }
        }

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
        // Clear resume state if cancelling a resumed drawing
        this._resumingLineId = null;
        this._resumingLineOptions = null;
        this._resumingFromStart = false;
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

        // Add paddle-specific properties
        if (line.type === 'paddle') {
            line.normalSide = options.normalSide ?? 'left';
            line.tapRange = options.tapRange ?? null;
            line.pathLineId = options.pathLineId ?? null;
            line.pathSpeed = options.pathSpeed ?? null;
            // Pairing properties
            line.pairedMisslineId = options.pairedMisslineId ?? null;
            line.pairOffset = options.pairOffset ?? 50;
        }

        // Add path binding for misslines
        if (line.type === 'missline') {
            line.pathLineId = options.pathLineId ?? null;
            // Pairing property
            line.pairedPaddleId = options.pairedPaddleId ?? null;
        }

        this.lines.push(line);
        this._recordHistory({
            action: 'add',
            line: JSON.parse(JSON.stringify(line))
        });
        this._emitChange();

        return line;
    }

    /**
     * Create a paddle line with an automatic paired missline
     * @param {{x: number, y: number}[]} points - Paddle line points
     * @param {Object} options - Line options
     * @param {number} [misslineOffset=50] - Offset distance for missline
     * @returns {{paddle: LineData, missline: LineData}}
     */
    createPaddleWithMissline(points, options = {}, misslineOffset = 50) {
        // Determine normalSide (default: 'left')
        const normalSide = options.normalSide ?? 'left';

        // Calculate missline points by offsetting in the opposite direction of normalSide
        const misslinePoints = points.map((p, i) => {
            // Calculate direction for each segment
            const nextIdx = Math.min(i + 1, points.length - 1);
            const prevIdx = Math.max(i - 1, 0);
            const dx = points[nextIdx].x - points[prevIdx].x;
            const dy = points[nextIdx].y - points[prevIdx].y;
            const len = Math.hypot(dx, dy) || 1;

            // Normal vector (perpendicular to line direction)
            // left normal: (-dy, dx), right normal: (dy, -dx)
            let nx, ny;
            if (normalSide === 'left') {
                // Missline goes to the right (opposite of normalSide)
                nx = dy / len;
                ny = -dx / len;
            } else {
                // Missline goes to the left
                nx = -dy / len;
                ny = dx / len;
            }

            return {
                x: p.x + nx * misslineOffset,
                y: p.y + ny * misslineOffset
            };
        });

        // Create paddle line first (without pairedMisslineId yet)
        const paddle = this.createLine(points, {
            ...options,
            type: 'paddle',
            normalSide,
            pairOffset: misslineOffset
        });

        // Create missline with reference to paddle
        const missline = this.createLine(misslinePoints, {
            type: 'missline',
            color: '#FF0000',
            thickness: options.thickness ?? 3,
            opacity: options.opacity ?? 1,
            pairedPaddleId: paddle.id
        });

        // Update paddle with missline ID
        paddle.pairedMisslineId = missline.id;

        return { paddle, missline };
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
     * Also deletes paired missline if this is a paddle with pairing
     * @param {string} id
     * @returns {boolean}
     */
    deleteLine(id) {
        const index = this.lines.findIndex(l => l.id === id);
        if (index === -1) return false;

        const line = this.lines[index];

        // If this is a paddle with a paired missline, delete the missline first
        if (line.type === 'paddle' && line.pairedMisslineId) {
            const misslineId = line.pairedMisslineId;
            const misslineIndex = this.lines.findIndex(l => l.id === misslineId);
            if (misslineIndex !== -1) {
                const missline = this.lines[misslineIndex];
                this._recordHistory({
                    action: 'remove',
                    line: JSON.parse(JSON.stringify(missline))
                });
                this.lines.splice(misslineIndex, 1);
            }
        }

        // Re-find the index after potential missline removal
        const newIndex = this.lines.findIndex(l => l.id === id);
        if (newIndex === -1) return false;

        this._recordHistory({
            action: 'remove',
            line: JSON.parse(JSON.stringify(line))
        });

        this.lines.splice(newIndex, 1);

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

        const oldLine = JSON.parse(JSON.stringify(line));

        // Update color if type changes
        if (updates.type && updates.type !== line.type) {
            const typeConfig = LINE_TYPES[updates.type.toUpperCase()];
            if (typeConfig) {
                updates.color = typeConfig.color;
            }
        }

        Object.assign(line, updates);

        this._recordHistory({
            action: 'update',
            lineId: id,
            oldLine,
            newLine: JSON.parse(JSON.stringify(line))
        });
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

        const oldLine = JSON.parse(JSON.stringify(line));
        line.points.splice(afterIndex + 1, 0, { x, y });
        this._recordHistory({
            action: 'update',
            lineId,
            oldLine,
            newLine: JSON.parse(JSON.stringify(line))
        });
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

        const oldLine = JSON.parse(JSON.stringify(line));
        line.points.splice(vertexIndex, 1);

        this._recordHistory({
            action: 'update',
            lineId,
            oldLine,
            newLine: JSON.parse(JSON.stringify(line))
        });

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
     * Find an endpoint (first or last vertex) near a point
     * @param {number} x
     * @param {number} y
     * @param {number} threshold
     * @returns {{line: LineData, isStart: boolean, distance: number}|null}
     */
    findEndpointAt(x, y, threshold = 15) {
        let closest = null;
        let minDist = threshold;

        for (const line of this.lines) {
            // Skip closed lines - they have no endpoints to extend
            if (line.closed) continue;

            const points = line.points;
            if (points.length < 2) continue;

            // Check start point
            const startDist = Math.hypot(x - points[0].x, y - points[0].y);
            if (startDist < minDist) {
                minDist = startDist;
                closest = { line, isStart: true, distance: startDist };
            }

            // Check end point
            const endPoint = points[points.length - 1];
            const endDist = Math.hypot(x - endPoint.x, y - endPoint.y);
            if (endDist < minDist) {
                minDist = endDist;
                closest = { line, isStart: false, distance: endDist };
            }
        }

        return closest;
    }

    /**
     * Resume drawing from an existing line's endpoint
     * Loads the line's points into drawing state and removes the original line
     * @param {string} lineId - ID of line to resume from
     * @param {boolean} fromStart - If true, resume from start (prepend), else from end (append)
     * @returns {LineData|null} The original line data (for undo purposes)
     */
    resumeDrawingFrom(lineId, fromStart = false) {
        const line = this.getLine(lineId);
        if (!line || line.closed) return null;

        // Store original line for undo
        const originalLine = JSON.parse(JSON.stringify(line));

        // Load points into current drawing state
        // If from start, reverse points so new points are added to what was the start
        this.currentPoints = fromStart
            ? [...line.points].reverse()
            : [...line.points];

        // Store the line properties to restore when finishing
        this._resumingLineId = lineId;
        this._resumingLineOptions = {
            type: line.type,
            color: line.color,
            thickness: line.thickness,
            opacity: line.opacity,
            paddleControl: line.paddleControl,
            normalSide: line.normalSide,
            tapRange: line.tapRange,
            pathLineId: line.pathLineId,
            pathSpeed: line.pathSpeed,
            pairedMisslineId: line.pairedMisslineId,
            pairedPaddleId: line.pairedPaddleId,
            pairOffset: line.pairOffset,
            blockGuide: line.blockGuide
        };
        this._resumingFromStart = fromStart;

        // Remove the original line (will be recreated on finish)
        const index = this.lines.findIndex(l => l.id === lineId);
        if (index !== -1) {
            this.lines.splice(index, 1);
        }

        // Enter drawing mode
        this.isDrawing = true;
        this.currentLineType = line.type;

        return originalLine;
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
        if (this._suppressNotify) return;
        if (this.onLineChange) {
            this.onLineChange(this.lines);
        }
    }

    /**
     * Record a line change to the history system if an action is being recorded.
     * @private
     * @param {Object} changeData - { action, line?, lineId?, oldLine?, newLine? }
     */
    _recordHistory(changeData) {
        // editor は初期化前に null の場合がある（正常）
        const history = this.editor?.historySystem;
        if (history && history.currentAction) {
            history.recordChange({ type: 'line', ...changeData });
        }
    }
}
