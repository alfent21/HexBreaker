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
}
