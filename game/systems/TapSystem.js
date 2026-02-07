/**
 * TapSystem.js - Tap Mode System
 *
 * Manages tap mode gameplay: instead of a paddle, players tap/click
 * within the tap area (between paddle line and missline) to hit balls
 * using virtual paddle reflection.
 */

export class TapSystem {
    constructor() {
        /** @type {Object|null} - Paddle line data for tap mode */
        this.paddleLine = null;

        /** @type {Object|null} - Paired missline data */
        this.missLine = null;

        /** @type {number} - Tap area distance (paddle to missline, or fallback) */
        this.tapDistance = 50;

        /** @type {boolean} - Whether tap mode is active */
        this.active = false;

        /** @type {'left'|'right'} - Normal side (play field side) */
        this.normalSide = 'left';
    }

    /**
     * Load tap mode settings from stage data
     * @param {Object} stageData
     */
    loadFromStage(stageData) {
        this.active = false;
        this.paddleLine = null;
        this.missLine = null;

        const lines = stageData.lines || [];
        for (const line of lines) {
            if (line.type === 'paddle' && line.paddleControl === 'tap') {
                this.active = true;
                this.paddleLine = line;
                this.normalSide = line.normalSide || 'left';

                // Find paired missline if exists
                if (line.pairedMisslineId) {
                    this.missLine = lines.find(l => l.id === line.pairedMisslineId) || null;
                }

                // Calculate tap distance
                if (this.missLine) {
                    // Use actual distance to missline
                    this.tapDistance = line.pairOffset || 50;
                } else if (line.tapRange) {
                    // Fallback to tapRange
                    this.tapDistance = line.tapRange;
                } else {
                    this.tapDistance = 50;
                }

                break;
            }
        }
    }

    /**
     * Check if a point is within the tap area (between paddle and missline)
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isPointInTapArea(x, y) {
        if (!this.active || !this.paddleLine) return false;

        const points = this.paddleLine.points;
        if (!points || points.length < 2) return false;

        // Check each segment
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            // Calculate distance to segment
            const dist = this._pointToSegmentDistance(x, y, p1, p2);

            // Check if within tap distance
            if (dist > this.tapDistance) continue;

            // Check if on the correct side (normalSide side only)
            const side = this._getPointSide(x, y, p1, p2);
            const expectedSide = this.normalSide === 'left' ? 1 : -1;

            if (side === expectedSide && dist <= this.tapDistance) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a ball is within the tap area
     * @param {Object} ball
     * @returns {boolean}
     */
    isBallInTapArea(ball) {
        return this.isPointInTapArea(ball.x, ball.y);
    }

    /**
     * Handle a tap: find the closest ball in tap area and redirect it
     * Uses virtual paddle reflection based on normalSide
     * @param {number} clickX - Click X coordinate
     * @param {number} clickY - Click Y coordinate
     * @param {Array} balls - Ball array
     * @returns {boolean} - Whether a ball was hit
     */
    handleTap(clickX, clickY, balls) {
        if (!this.active) return false;

        // First check if click is in tap area
        if (!this.isPointInTapArea(clickX, clickY)) return false;

        // Find the closest ball in tap area to the click point
        let closestBall = null;
        let closestDist = Infinity;
        let closestSegment = -1;

        for (const ball of balls) {
            if (ball.attached) continue;
            if (!this.isBallInTapArea(ball)) continue;

            const dist = Math.hypot(clickX - ball.x, clickY - ball.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestBall = ball;
                // Find which segment the ball is closest to
                closestSegment = this._findClosestSegment(ball.x, ball.y);
            }
        }

        if (!closestBall || closestSegment < 0) return false;

        // Apply virtual paddle reflection
        this._applyVirtualPaddleReflection(closestBall, clickX, clickY, closestSegment);

        return true;
    }

    /**
     * Apply virtual paddle reflection to a ball
     * @param {Object} ball
     * @param {number} clickX
     * @param {number} clickY
     * @param {number} segmentIndex
     * @private
     */
    _applyVirtualPaddleReflection(ball, clickX, clickY, segmentIndex) {
        const points = this.paddleLine.points;
        const p1 = points[segmentIndex];
        const p2 = points[segmentIndex + 1];

        // Segment direction vector
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;

        // Normalized segment direction
        const tx = dx / len;
        const ty = dy / len;

        // Normal vector (perpendicular to segment, pointing to normalSide)
        // Left normal: (-dy, dx), Right normal: (dy, -dx)
        let nx, ny;
        if (this.normalSide === 'left') {
            nx = -ty;
            ny = tx;
        } else {
            nx = ty;
            ny = -tx;
        }

        // Calculate offset ratio: project (ball - click) onto segment direction
        const ballToClickX = ball.x - clickX;
        const ballToClickY = ball.y - clickY;
        const projection = ballToClickX * tx + ballToClickY * ty;

        // Normalize to [-1, 1] based on paddle width (use 100px as reference)
        const paddleWidth = 100;
        const offsetRatio = Math.max(-1, Math.min(1, projection / (paddleWidth / 2)));

        // Calculate reflection angle
        // Base angle is the normal direction, offset by ±60° based on position
        const normalAngle = Math.atan2(ny, nx);
        const maxAngleOffset = Math.PI / 3; // 60 degrees
        const angle = normalAngle + offsetRatio * maxAngleOffset;

        // Apply new velocity (maintain speed)
        const speed = Math.hypot(ball.dx, ball.dy);
        ball.dx = Math.cos(angle) * speed;
        ball.dy = Math.sin(angle) * speed;
    }

    /**
     * Find the closest segment to a point
     * @param {number} x
     * @param {number} y
     * @returns {number} - Segment index, or -1 if none
     * @private
     */
    _findClosestSegment(x, y) {
        if (!this.paddleLine || !this.paddleLine.points) return -1;

        const points = this.paddleLine.points;
        let minDist = Infinity;
        let closestIdx = -1;

        for (let i = 0; i < points.length - 1; i++) {
            const dist = this._pointToSegmentDistance(x, y, points[i], points[i + 1]);
            if (dist < minDist) {
                minDist = dist;
                closestIdx = i;
            }
        }

        return closestIdx;
    }

    /**
     * Get which side of a line segment a point is on
     * @param {number} px - Point X
     * @param {number} py - Point Y
     * @param {Object} p1 - Segment start
     * @param {Object} p2 - Segment end
     * @returns {number} - 1 for left, -1 for right, 0 on line
     * @private
     */
    _getPointSide(px, py, p1, p2) {
        const cross = (p2.x - p1.x) * (py - p1.y) - (p2.y - p1.y) * (px - p1.x);
        if (cross > 0) return 1;  // Left
        if (cross < 0) return -1; // Right
        return 0;
    }

    /**
     * Get the midpoint of the paddle line (for ball spawn position)
     * @returns {{x: number, y: number}|null}
     */
    getPaddleLineMidpoint() {
        if (!this.paddleLine || !this.paddleLine.points || this.paddleLine.points.length < 2) {
            return null;
        }

        const points = this.paddleLine.points;
        // Use midpoint of middle segment
        const mid = Math.floor((points.length - 1) / 2);
        const p1 = points[mid];
        const p2 = points[mid + 1];
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        };
    }

    /**
     * Render tap area visualization
     * Only renders the normalSide (play field side) of the paddle line
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        if (!this.active || !this.paddleLine) return;

        const points = this.paddleLine.points;
        if (!points || points.length < 2) return;

        const tapDist = this.tapDistance;

        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#00FF88';

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy);
            if (len === 0) continue;

            // Normal vector (left side)
            const lnx = -dy / len;
            const lny = dx / len;

            // Draw only on normalSide
            let nx, ny;
            if (this.normalSide === 'left') {
                nx = lnx * tapDist;
                ny = lny * tapDist;
            } else {
                nx = -lnx * tapDist;
                ny = -lny * tapDist;
            }

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p2.x + nx, p2.y + ny);
            ctx.lineTo(p1.x + nx, p1.y + ny);
            ctx.closePath();
            ctx.fill();
        }

        // Draw paddle line itself (dashed green)
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw missline if exists (dashed red)
        if (this.missLine && this.missLine.points && this.missLine.points.length >= 2) {
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            const mp = this.missLine.points;
            ctx.moveTo(mp[0].x, mp[0].y);
            for (let i = 1; i < mp.length; i++) {
                ctx.lineTo(mp[i].x, mp[i].y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    /**
     * Distance from a point to a line segment
     * @private
     */
    _pointToSegmentDistance(px, py, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq === 0) return Math.hypot(px - p1.x, py - p1.y);
        let t = ((px - p1.x) * dx + (py - p1.y) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (p1.x + t * dx), py - (p1.y + t * dy));
    }
}
