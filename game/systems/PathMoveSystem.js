/**
 * PathMoveSystem.js - Path-based Line Movement System
 *
 * Moves groups of lines (paddle + misslines) along a path line.
 * Open paths use ping-pong (back and forth), closed paths loop.
 * Returns per-frame movement delta for paddle conveyor-belt effect.
 */

export class PathMoveSystem {
    constructor() {
        /** @type {Array} - Movement units */
        this.units = [];

        /** @type {{x: number, y: number}} - Last frame's movement delta (for paddle) */
        this.lastDelta = { x: 0, y: 0 };
    }

    /**
     * Build movement units from stage data
     * @param {Object} stageData
     */
    loadFromStage(stageData) {
        this.units = [];
        this.lastDelta = { x: 0, y: 0 };

        const lines = stageData.lines || [];

        // Build path line map
        const pathMap = new Map();
        for (const line of lines) {
            if (line.type === 'path') {
                pathMap.set(line.id, line);
            }
        }

        if (pathMap.size === 0) return;

        // Group lines by pathLineId
        const groups = new Map();
        for (const line of lines) {
            if (!line.pathLineId) continue;
            if (line.type !== 'paddle' && line.type !== 'missline') continue;

            const pathLine = pathMap.get(line.pathLineId);
            if (!pathLine) {
                console.error(
                    `[PathMoveSystem] Line "${line.id}" references pathLineId "${line.pathLineId}" which does not exist`
                );
                continue;
            }

            if (!groups.has(line.pathLineId)) {
                groups.set(line.pathLineId, {
                    pathLine,
                    lines: [],
                    speed: 0
                });
            }

            const group = groups.get(line.pathLineId);
            group.lines.push(line);

            // Use paddle line's pathSpeed (or first encountered speed)
            if (line.type === 'paddle' && line.pathSpeed) {
                group.speed = line.pathSpeed;
            }
        }

        // Create movement units from groups
        for (const [pathLineId, group] of groups) {
            const pathLine = group.pathLine;
            const isLoop = pathLine.closed || false;
            const totalLength = this._calculatePathLength(pathLine.points, isLoop);

            if (totalLength === 0) continue;

            // Record initial offsets for all line points relative to path start
            const pathStart = pathLine.points[0];
            const lineOffsets = group.lines.map(line => ({
                line,
                pointOffsets: line.points.map(p => ({
                    dx: p.x - pathStart.x,
                    dy: p.y - pathStart.y
                }))
            }));

            this.units.push({
                pathLine,
                lineOffsets,
                speed: group.speed || 100,
                progress: 0,
                direction: 1,
                totalLength,
                isLoop,
                hasPaddle: group.lines.some(l => l.type === 'paddle')
            });
        }
    }

    /**
     * Update all movement units
     * @param {number} dt - Delta time in seconds
     * @returns {{x: number, y: number}} - Movement delta for this frame (for paddle conveyor effect)
     */
    update(dt) {
        this.lastDelta = { x: 0, y: 0 };

        for (const unit of this.units) {
            // Get position before update
            const posBefore = this._getPositionOnPath(
                unit.pathLine.points, unit.progress, unit.isLoop
            );

            // Update progress
            unit.progress += unit.speed * dt * unit.direction;

            if (unit.isLoop) {
                // Loop: wrap around
                while (unit.progress >= unit.totalLength) {
                    unit.progress -= unit.totalLength;
                }
                while (unit.progress < 0) {
                    unit.progress += unit.totalLength;
                }
            } else {
                // Ping-pong: bounce at endpoints
                if (unit.progress >= unit.totalLength) {
                    unit.progress = 2 * unit.totalLength - unit.progress;
                    unit.direction = -1;
                } else if (unit.progress <= 0) {
                    unit.progress = -unit.progress;
                    unit.direction = 1;
                }

                // Clamp to valid range
                unit.progress = Math.max(0, Math.min(unit.totalLength, unit.progress));
            }

            // Get position after update
            const posAfter = this._getPositionOnPath(
                unit.pathLine.points, unit.progress, unit.isLoop
            );

            // Calculate movement delta
            const deltaX = posAfter.x - posBefore.x;
            const deltaY = posAfter.y - posBefore.y;

            // Apply movement to all grouped lines
            const pathStart = unit.pathLine.points[0];
            for (const entry of unit.lineOffsets) {
                for (let i = 0; i < entry.line.points.length; i++) {
                    entry.line.points[i] = {
                        x: pathStart.x + entry.pointOffsets[i].dx + posAfter.x - pathStart.x,
                        y: pathStart.y + entry.pointOffsets[i].dy + posAfter.y - pathStart.y
                    };
                }
            }

            // Store delta for paddle conveyor effect (use first unit with paddle)
            if (unit.hasPaddle) {
                this.lastDelta = { x: deltaX, y: deltaY };
            }
        }

        return this.lastDelta;
    }

    /**
     * Calculate total path length
     * @private
     * @param {{x: number, y: number}[]} points
     * @param {boolean} closed
     * @returns {number}
     */
    _calculatePathLength(points, closed) {
        if (!points || points.length < 2) return 0;

        let len = 0;
        const count = closed ? points.length : points.length - 1;
        for (let i = 0; i < count; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            len += Math.hypot(p2.x - p1.x, p2.y - p1.y);
        }
        return len;
    }

    /**
     * Get position on path at given distance
     * @private
     * @param {{x: number, y: number}[]} points
     * @param {number} distance
     * @param {boolean} isLoop
     * @returns {{x: number, y: number}}
     */
    _getPositionOnPath(points, distance, isLoop) {
        if (!points || points.length < 2) return { x: 0, y: 0 };

        let remaining = distance;
        const count = isLoop ? points.length : points.length - 1;

        for (let i = 0; i < count; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

            if (remaining <= segLen) {
                const t = segLen > 0 ? remaining / segLen : 0;
                return {
                    x: p1.x + (p2.x - p1.x) * t,
                    y: p1.y + (p2.y - p1.y) * t
                };
            }
            remaining -= segLen;
        }

        // Reached end (for open path)
        const lastPoint = points[points.length - 1];
        return { x: lastPoint.x, y: lastPoint.y };
    }
}
