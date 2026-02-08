/**
 * CollisionSystem.js - Collision Detection
 * Based on game_specification.md Section 3.1
 */

import { hexToPixel, pixelToHex, isPointInHex, GRID_SIZES } from '../../shared/HexMath.js';

export class CollisionSystem {
    constructor() {
        this.gridSize = GRID_SIZES.medium;
    }

    /**
     * Set grid size
     * @param {string} size - 'small', 'medium', 'large'
     */
    setGridSize(size) {
        this.gridSize = GRID_SIZES[size] || GRID_SIZES.medium;
    }

    /**
     * Check ball collision with walls
     * @param {import('../entities/Ball.js').Ball} ball
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     * @returns {{hit: boolean, wall: string}} Collision result
     */
    checkWallCollision(ball, canvasWidth, canvasHeight) {
        const result = { hit: false, wall: '' };

        // Left wall
        if (ball.x - ball.radius <= 0) {
            ball.x = ball.radius + 0.1;
            ball.dx = Math.abs(ball.dx);
            result.hit = true;
            result.wall = 'left';
        }

        // Right wall
        if (ball.x + ball.radius >= canvasWidth) {
            ball.x = canvasWidth - ball.radius - 0.1;
            ball.dx = -Math.abs(ball.dx);
            result.hit = true;
            result.wall = 'right';
        }

        // Top wall
        if (ball.y - ball.radius <= 0) {
            ball.y = ball.radius + 0.1;
            ball.dy = Math.abs(ball.dy);
            result.hit = true;
            result.wall = 'top';
        }

        return result;
    }

    /**
     * Check if ball is below bottom (miss)
     * @param {import('../entities/Ball.js').Ball} ball
     * @param {number} canvasHeight
     * @returns {boolean}
     */
    checkMiss(ball, canvasHeight) {
        return ball.y - ball.radius > canvasHeight;
    }

    /**
     * Check ball collision with a hex block
     * @param {import('../entities/Ball.js').Ball} ball
     * @param {Object} block - Block data with row, col
     * @returns {{hit: boolean, normal: {x: number, y: number}}} Collision result
     */
    checkBlockCollision(ball, block) {
        if (!block.alive) return { hit: false, normal: null };

        const center = hexToPixel(block.row, block.col, this.gridSize);
        const dx = ball.x - center.x;
        const dy = ball.y - center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if ball is within hex radius + ball radius
        const hitDistance = this.gridSize.radius + ball.radius;

        if (distance < hitDistance) {
            // Calculate normal (from hex center to ball)
            const normalX = dx / distance || 0;
            const normalY = dy / distance || 1;

            return {
                hit: true,
                normal: { x: normalX, y: normalY }
            };
        }

        return { hit: false, normal: null };
    }

    /**
     * Find all blocks the ball is colliding with
     * @param {import('../entities/Ball.js').Ball} ball
     * @param {Object[]} blocks - Array of block data
     * @returns {Object[]} Array of hit blocks
     */
    findCollidingBlocks(ball, blocks) {
        const hits = [];

        for (const block of blocks) {
            const result = this.checkBlockCollision(ball, block);
            if (result.hit) {
                hits.push({ block, normal: result.normal });
            }
        }

        return hits;
    }

    /**
     * Get hex coordinates from pixel position
     * @param {number} x
     * @param {number} y
     * @returns {{row: number, col: number}}
     */
    getHexAt(x, y) {
        return pixelToHex(x, y, this.gridSize);
    }

    /**
     * Get pixel center of hex
     * @param {number} row
     * @param {number} col
     * @returns {{x: number, y: number}}
     */
    getHexCenter(row, col) {
        return hexToPixel(row, col, this.gridSize);
    }

    /**
     * Check if ball has crossed a miss line
     * @param {import('../entities/Ball.js').Ball} ball
     * @param {Object[]} missLines - Array of missline objects
     * @param {number} [threshold=20] - Detection threshold in pixels
     * @returns {boolean}
     */
    checkMissLine(ball, missLines) {
        for (const line of missLines) {
            if (!line.points || line.points.length < 2) continue;

            for (let i = 0; i < line.points.length - 1; i++) {
                const dist = this._pointToSegmentDistance(
                    ball.x, ball.y,
                    line.points[i], line.points[i + 1]
                );
                // ボールの端がラインに触れたらミス判定（中心ではなく端を基準）
                if (dist <= ball.radius) return true;
            }
        }
        return false;
    }

    // =========================================
    // Line Collision & Block Guide
    // =========================================

    /**
     * Check ball collision with collision lines (polylines)
     * @param {import('../entities/Ball.js').Ball} ball
     * @param {Object[]} lines - Array of line objects from stage data
     * @returns {{hit: boolean, line?: Object, normal?: {x: number, y: number}, segmentIndex?: number}}
     */
    checkLineCollision(ball, lines) {
        if (!lines || lines.length === 0) return { hit: false };

        for (const line of lines) {
            // Only check collision-type lines
            if (line.type !== 'collision') continue;
            if (!line.points || line.points.length < 2) continue;

            for (let i = 0; i < line.points.length - 1; i++) {
                const p1 = line.points[i];
                const p2 = line.points[i + 1];

                const dist = this._pointToSegmentDistance(ball.x, ball.y, p1, p2);
                const hitThreshold = ball.radius + (line.thickness || 3) / 2;

                if (dist <= hitThreshold) {
                    const normal = this._getSegmentNormal(p1, p2, ball.x, ball.y);
                    return { hit: true, line, normal, segmentIndex: i };
                }
            }
        }

        return { hit: false };
    }

    /**
     * Calculate distance from point to line segment
     * @private
     */
    _pointToSegmentDistance(px, py, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            // p1 and p2 are the same point
            return Math.hypot(px - p1.x, py - p1.y);
        }

        // Project point onto line, clamping to segment
        let t = ((px - p1.x) * dx + (py - p1.y) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));

        const nearestX = p1.x + t * dx;
        const nearestY = p1.y + t * dy;

        return Math.hypot(px - nearestX, py - nearestY);
    }

    /**
     * Get normal vector of line segment (pointing toward the ball)
     * @private
     */
    _getSegmentNormal(p1, p2, ballX, ballY) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);

        if (len === 0) return { x: 0, y: -1 };

        // Perpendicular vector (two possibilities)
        let nx = -dy / len;
        let ny = dx / len;

        // Choose the one pointing toward the ball
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const toBallX = ballX - midX;
        const toBallY = ballY - midY;

        // Dot product to check direction
        if (nx * toBallX + ny * toBallY < 0) {
            nx = -nx;
            ny = -ny;
        }

        return { x: nx, y: ny };
    }

    /**
     * Apply Block Guide - redirect ball toward nearest block within angle range
     * @param {import('../entities/Ball.js').Ball} ball
     * @param {number} reflectionAngle - Current reflection angle in radians
     * @param {Object[]} blocks - Array of block objects
     * @param {{probability: number, angleLimit: number}} config - Block guide configuration
     * @returns {boolean} True if guide was applied
     */
    applyBlockGuide(ball, reflectionAngle, blocks, config) {
        // 1. Probability check
        if (Math.random() >= config.probability) {
            return false;
        }

        // 2. Find nearest block within angle range
        const angleLimitRad = (config.angleLimit * Math.PI) / 180;
        let nearestBlock = null;
        let minDist = Infinity;

        for (const block of blocks) {
            if (!block.alive) continue;

            const center = hexToPixel(block.row, block.col, this.gridSize);
            const toBlockX = center.x - ball.x;
            const toBlockY = center.y - ball.y;
            const blockAngle = Math.atan2(toBlockY, toBlockX);

            // Calculate angle difference (normalized to -π ~ π)
            let angleDiff = blockAngle - reflectionAngle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            // Check if within angle limit
            if (Math.abs(angleDiff) <= angleLimitRad) {
                const dist = Math.hypot(toBlockX, toBlockY);
                if (dist < minDist) {
                    minDist = dist;
                    nearestBlock = block;
                }
            }
        }

        // 3. Apply guidance if block found
        if (nearestBlock) {
            const center = hexToPixel(nearestBlock.row, nearestBlock.col, this.gridSize);
            const toBlockX = center.x - ball.x;
            const toBlockY = center.y - ball.y;
            const len = Math.hypot(toBlockX, toBlockY);

            if (len > 0) {
                // Preserve speed, change direction
                const speed = Math.hypot(ball.dx, ball.dy);
                ball.dx = (toBlockX / len) * speed;
                ball.dy = (toBlockY / len) * speed;
                return true;
            }
        }

        return false;
    }
}
