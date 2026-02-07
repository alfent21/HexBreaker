/**
 * GemSystem.js - Power Gem Management System
 *
 * Handles gem spawning, update, collection, and rendering.
 * Gems drop from destroyed blocks and boss defeats.
 */

import { PowerGem } from '../entities/PowerGem.js';
import { hexToPixel } from '../../shared/HexMath.js';

export class GemSystem {
    /**
     * @param {Object} gridSize - Grid size object with radius property
     */
    constructor(gridSize) {
        /** @type {PowerGem[]} */
        this.gems = [];

        /** @type {Object} */
        this.gridSize = gridSize;

        /** @type {number} - Default drop chance for normal blocks */
        this.defaultDropChance = 0.15;
    }

    /**
     * Set grid size (called when stage loads)
     * @param {Object} gridSize
     */
    setGridSize(gridSize) {
        this.gridSize = gridSize;
    }

    /**
     * Spawn a gem at a block's location
     * @param {Object} block - Block data with row, col, and optional gemDrop
     */
    spawnFromBlock(block) {
        const center = hexToPixel(block.row, block.col, this.gridSize);
        this.gems.push(new PowerGem(center.x, center.y));
    }

    /**
     * Check if a block should drop a gem based on its gemDrop property
     * @param {Object} block - Block data
     * @returns {boolean}
     */
    shouldDropGem(block) {
        if (block.gemDrop === 'guaranteed' || block.gemDrop === 'infinite') {
            return true;
        }
        return Math.random() < this.defaultDropChance;
    }

    /**
     * Spawn multiple gems at a location (for boss defeat reward)
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {number} count - Number of gems to spawn
     */
    spawnBossReward(x, y, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i;
            const distance = 30 + Math.random() * 20;
            const gemX = x + Math.cos(angle) * distance;
            const gemY = y + Math.sin(angle) * distance;
            this.gems.push(new PowerGem(gemX, gemY));
        }
    }

    /**
     * Update all gems
     * @param {number} dt - Delta time
     * @param {Object} paddle - Paddle entity
     * @param {number} canvasHeight - Canvas height for off-screen check
     * @param {Function} onCollect - Callback when gem is collected
     */
    update(dt, paddle, canvasHeight, onCollect) {
        for (let i = this.gems.length - 1; i >= 0; i--) {
            const gem = this.gems[i];
            gem.update(dt);

            // Collection check
            if (gem.checkCollection(paddle)) {
                this.gems.splice(i, 1);
                if (onCollect) {
                    onCollect(gem);
                }
                continue;
            }

            // Off screen check
            if (gem.isOffScreen(canvasHeight)) {
                this.gems.splice(i, 1);
            }
        }
    }

    /**
     * Render all gems
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        for (const gem of this.gems) {
            gem.render(ctx);
        }
    }

    /**
     * Try to collect a gem by tap at the given position
     * @param {number} x - Tap X coordinate
     * @param {number} y - Tap Y coordinate
     * @param {number} [radius=50] - Collection radius
     * @param {Function} [onCollect] - Callback when gem is collected
     * @returns {boolean} - Whether a gem was collected
     */
    collectByTap(x, y, radius = 50, onCollect = null) {
        let closestGem = null;
        let closestDist = radius;
        let closestIndex = -1;

        for (let i = 0; i < this.gems.length; i++) {
            const gem = this.gems[i];
            const dist = Math.hypot(x - gem.x, y - gem.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestGem = gem;
                closestIndex = i;
            }
        }

        if (closestGem && closestIndex >= 0) {
            this.gems.splice(closestIndex, 1);
            if (onCollect) {
                onCollect(closestGem);
            }
            return true;
        }

        return false;
    }

    /**
     * Clear all gems (for stage reset)
     */
    clear() {
        this.gems = [];
    }

    /**
     * Get current gem count
     * @returns {number}
     */
    get count() {
        return this.gems.length;
    }
}
