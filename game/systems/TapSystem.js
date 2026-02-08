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

        /** @type {number} - Hit radius for ball selection (max distance from click) */
        this.hitRadius = 60;

        /** @type {Array} - Racket effect animations [{x, y, age, duration, radius, hit}] */
        this.racketEffects = [];

        /** @type {Array} - Text popup effects [{x, y, text, age, duration}] */
        this.textEffects = [];
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

                // Load hit radius (max distance from click to hit a ball)
                this.hitRadius = line.hitRadius ?? 60;

                break;
            }
        }
    }

    /**
     * Check if a point is within the tap area (within tapDistance from paddle line, both sides)
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    isPointInTapArea(x, y) {
        if (!this.active || !this.paddleLine) return false;

        const points = this.paddleLine.points;
        if (!points || points.length < 2) return false;

        // Check each segment - tap area is both sides of the paddle line
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            // Calculate distance to segment
            const dist = this._pointToSegmentDistance(x, y, p1, p2);

            // Within tap distance = in tap area (both sides of paddle line)
            if (dist <= this.tapDistance) {
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

        // クリック位置がタップエリア内かチェック
        if (!this.isPointInTapArea(clickX, clickY)) return false;

        // Find the closest ball within hitRadius of click point
        let closestBall = null;
        let closestDist = this.hitRadius;
        let closestSegment = -1;

        for (const ball of balls) {
            if (ball.attached) continue;
            if (ball.wasHitInTapArea) continue;

            const dist = Math.hypot(clickX - ball.x, clickY - ball.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestBall = ball;
                closestSegment = this._findClosestSegment(ball.x, ball.y);
            }
        }

        const hit = closestBall && closestSegment >= 0;

        // Show racket at click position
        // If no hit yet, racket stays active for continued detection
        this.racketEffects.push({
            x: clickX,
            y: clickY,
            age: 0,
            duration: 0.3,
            radius: this.hitRadius,
            hit: hit,
            active: !hit  // Active = still looking for a ball to hit
        });

        if (!hit) return false;

        // Apply virtual paddle reflection
        this._applyVirtualPaddleReflection(closestBall, clickX, clickY, closestSegment);

        // Flash the ball
        closestBall.flashTime = 0.15;

        // Mark as hit (prevents re-hitting until ball leaves tap area)
        closestBall.wasHitInTapArea = true;

        return true;
    }

    /**
     * Try to hit a ball at the given position (used for continued detection)
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @param {Array} balls - Ball array
     * @returns {boolean} - Whether a ball was hit
     * @private
     */
    _tryHitBallAtPosition(x, y, balls) {
        let closestBall = null;
        let closestDist = this.hitRadius;
        let closestSegment = -1;

        for (const ball of balls) {
            if (ball.attached) continue;
            if (ball.wasHitInTapArea) continue;

            const dist = Math.hypot(x - ball.x, y - ball.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestBall = ball;
                closestSegment = this._findClosestSegment(ball.x, ball.y);
            }
        }

        if (!closestBall || closestSegment < 0) return false;

        // Apply virtual paddle reflection
        this._applyVirtualPaddleReflection(closestBall, x, y, closestSegment);

        // Flash the ball
        closestBall.flashTime = 0.15;

        // Mark as hit
        closestBall.wasHitInTapArea = true;

        return true;
    }

    /**
     * Apply virtual paddle reflection to a ball
     * Ball ALWAYS flies toward normalSide direction, with angle adjusted by click position
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

        // Segment direction vector (tangent)
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;

        // Normalized tangent (along the paddle line)
        const tx = dx / len;
        const ty = dy / len;

        // Normal vector pointing to normalSide (this is where the ball MUST go)
        // Left of line direction: (-ty, tx), Right: (ty, -tx)
        let nx, ny;
        if (this.normalSide === 'left') {
            nx = -ty;
            ny = tx;
        } else {
            nx = ty;
            ny = -tx;
        }

        // Calculate where ball is relative to click, along the paddle line
        // Positive = ball is in positive tangent direction from click
        const ballRelX = ball.x - clickX;
        const ballRelY = ball.y - clickY;
        const tangentOffset = ballRelX * tx + ballRelY * ty;

        // Normalize offset to [-1, 1] based on hitRadius
        // At hitRadius edge = ±1, center = 0
        const maxOffset = this.hitRadius;
        const offsetRatio = Math.max(-1, Math.min(1, tangentOffset / maxOffset));

        // Base direction is normalSide (the direction ball MUST fly)
        const baseAngle = Math.atan2(ny, nx);

        // Adjust angle: if ball is to the "right" of click (positive tangent),
        // fly more to the "left" (negative angle offset), and vice versa
        // This creates the natural paddle feel
        const maxAngleOffset = Math.PI / 3; // 60 degrees
        const angle = baseAngle - offsetRatio * maxAngleOffset;

        // Apply new velocity (maintain speed)
        const speed = Math.hypot(ball.dx, ball.dy);
        ball.dx = Math.cos(angle) * speed;
        ball.dy = Math.sin(angle) * speed;

        // Set cooldown to prevent rapid re-hitting
        ball.tapCooldown = 300; // ms
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
     * Spawn a text popup effect (e.g., "+1" for gem collection)
     * @param {number} x
     * @param {number} y
     * @param {string} text
     */
    spawnTextEffect(x, y, text) {
        this.textEffects.push({
            x,
            y,
            text,
            age: 0,
            duration: 0.6
        });
    }

    /**
     * Update effects and reset hit flags (call from game loop)
     * @param {number} dt - Delta time in seconds
     * @param {Array} [balls] - Ball array to check for tap area exit
     */
    update(dt, balls = []) {
        // Reset wasHitInTapArea for balls that left the tap area
        for (const ball of balls) {
            if (ball.wasHitInTapArea && !this.isBallInTapArea(ball)) {
                ball.wasHitInTapArea = false;
            }
        }

        // Update racket effects and continue hit detection for active rackets
        for (let i = this.racketEffects.length - 1; i >= 0; i--) {
            const racket = this.racketEffects[i];
            racket.age += dt;

            // If racket is still active (no hit yet), keep trying to hit balls
            if (racket.active && balls.length > 0) {
                const hitResult = this._tryHitBallAtPosition(racket.x, racket.y, balls);
                if (hitResult) {
                    racket.hit = true;
                    racket.active = false;
                }
            }

            if (racket.age >= racket.duration) {
                this.racketEffects.splice(i, 1);
            }
        }

        // Update text effects
        for (let i = this.textEffects.length - 1; i >= 0; i--) {
            this.textEffects[i].age += dt;
            if (this.textEffects[i].age >= this.textEffects[i].duration) {
                this.textEffects.splice(i, 1);
            }
        }
    }

    /**
     * Render tap area visualization
     * Renders both sides of the paddle line (full tap area)
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

            // Normal vector
            const nx = (-dy / len) * tapDist;
            const ny = (dx / len) * tapDist;

            // Draw both sides of paddle line
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

        // Render racket (color based on hit: green=hit, white=miss)
        for (const racket of this.racketEffects) {
            const t = racket.age / racket.duration;
            ctx.globalAlpha = 0.6 * (1 - t);
            ctx.strokeStyle = racket.hit ? '#00FF00' : '#FFFFFF';
            ctx.lineWidth = racket.hit ? 3 : 2;
            ctx.beginPath();
            ctx.arc(racket.x, racket.y, racket.radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Render text effects (+1 popup for gem collection)
        for (const text of this.textEffects) {
            const t = text.age / text.duration;
            // Float upward
            const floatY = text.y - t * 30;
            // Fade out
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = '#FFD700'; // Gold color
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text.text, text.x, floatY);
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
