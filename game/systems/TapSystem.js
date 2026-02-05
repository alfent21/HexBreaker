/**
 * TapSystem.js - Tap Mode System
 *
 * Manages tap mode gameplay: instead of a paddle, players tap/click
 * balls within a tap area around the paddle line to send them
 * in the direction of the click point.
 */

export class TapSystem {
    constructor() {
        /** @type {Object|null} - Paddle line data for tap mode */
        this.paddleLine = null;

        /** @type {number} - Tap area half-width (px from paddle line) */
        this.tapRange = 40;

        /** @type {boolean} - Whether tap mode is active */
        this.active = false;
    }

    /**
     * Load tap mode settings from stage data
     * @param {Object} stageData
     */
    loadFromStage(stageData) {
        this.active = false;
        this.paddleLine = null;

        const lines = stageData.lines || [];
        for (const line of lines) {
            if (line.type === 'paddle' && line.paddleControl === 'tap') {
                this.active = true;
                this.paddleLine = line;
                this.tapRange = line.tapRange || 40;
                break;
            }
        }
    }

    /**
     * Check if a ball is within the tap area
     * @param {Object} ball
     * @returns {boolean}
     */
    isBallInTapArea(ball) {
        if (!this.active || !this.paddleLine) return false;

        const points = this.paddleLine.points;
        if (!points || points.length < 2) return false;

        for (let i = 0; i < points.length - 1; i++) {
            const dist = this._pointToSegmentDistance(
                ball.x, ball.y,
                points[i], points[i + 1]
            );
            if (dist <= this.tapRange) return true;
        }
        return false;
    }

    /**
     * Handle a tap: find the closest ball in tap area and redirect it
     * @param {number} clickX - Click X coordinate
     * @param {number} clickY - Click Y coordinate
     * @param {Array} balls - Ball array
     * @returns {boolean} - Whether a ball was hit
     */
    handleTap(clickX, clickY, balls) {
        if (!this.active) return false;

        // Find the closest ball in tap area to the click point
        let closestBall = null;
        let closestDist = Infinity;

        for (const ball of balls) {
            if (ball.attached) continue;
            if (!this.isBallInTapArea(ball)) continue;

            const dist = Math.hypot(clickX - ball.x, clickY - ball.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestBall = ball;
            }
        }

        if (!closestBall) return false;

        // Redirect ball toward click point
        const dx = clickX - closestBall.x;
        const dy = clickY - closestBall.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return false;

        const speed = Math.hypot(closestBall.dx, closestBall.dy);
        closestBall.dx = (dx / len) * speed;
        closestBall.dy = (dy / len) * speed;

        return true;
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
        // Use midpoint of first segment
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
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        if (!this.active || !this.paddleLine) return;

        const points = this.paddleLine.points;
        if (!points || points.length < 2) return;

        const tapRange = this.tapRange;

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

            const nx = (-dy / len) * tapRange;
            const ny = (dx / len) * tapRange;

            ctx.beginPath();
            ctx.moveTo(p1.x + nx, p1.y + ny);
            ctx.lineTo(p2.x + nx, p2.y + ny);
            ctx.lineTo(p2.x - nx, p2.y - ny);
            ctx.lineTo(p1.x - nx, p1.y - ny);
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
