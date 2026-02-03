/**
 * LaserSystem.js - Laser Weapon Management System
 *
 * Handles laser firing, stock management, cooldown, collision detection with blocks.
 * Lasers penetrate blocks (don't stop on first hit).
 */

import { Laser } from '../entities/Laser.js';
import { hexToPixel } from '../../shared/HexMath.js';

export class LaserSystem {
    constructor() {
        /** @type {Laser[]} */
        this.lasers = [];

        /** @type {number} - Available laser shots */
        this.stock = 0;

        /** @type {number} - Cooldown timer (seconds) */
        this.cooldown = 0;

        /** @type {number} - Cooldown duration (seconds) */
        this.cooldownDuration = 0.5;

        /** @type {number} - Shots added per weapon purchase */
        this.shotsPerPurchase = 5;
    }

    /**
     * Add laser stock (when weapon is purchased)
     * @param {number} amount - Number of shots to add
     */
    addStock(amount = 5) {
        this.stock += amount;
    }

    /**
     * Check if laser can be fired
     * @returns {boolean}
     */
    canFire() {
        return this.stock > 0 && this.cooldown <= 0;
    }

    /**
     * Fire a laser from paddle position
     * @param {number} x - Paddle center X
     * @param {number} y - Paddle Y position
     * @returns {boolean} - True if fired successfully
     */
    fire(x, y) {
        if (!this.canFire()) {
            return false;
        }

        // Create laser above paddle
        this.lasers.push(new Laser(x, y - 10));
        this.stock--;
        this.cooldown = this.cooldownDuration;

        return true;
    }

    /**
     * Update lasers and check collisions with blocks
     * @param {number} dt - Delta time
     * @param {Array} blocks - Block array from GameState
     * @param {Object} gridSize - Grid size for hex calculations
     * @param {Function} onBlockHit - Callback when block is hit (block, laser) => void
     */
    update(dt, blocks, gridSize, onBlockHit) {
        // Update cooldown
        if (this.cooldown > 0) {
            this.cooldown -= dt;
        }

        // Update and check each laser
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];
            laser.update();

            // Remove inactive lasers
            if (!laser.active) {
                this.lasers.splice(i, 1);
                continue;
            }

            // Check block collisions (laser penetrates)
            this._checkBlockCollisions(laser, blocks, gridSize, onBlockHit);
        }
    }

    /**
     * Check laser collision with blocks
     * @private
     */
    _checkBlockCollisions(laser, blocks, gridSize, onBlockHit) {
        const laserCenter = { x: laser.x, y: laser.y };

        for (const block of blocks) {
            if (!block.alive) continue;

            const blockCenter = hexToPixel(block.row, block.col, gridSize);
            const dx = laserCenter.x - blockCenter.x;
            const dy = laserCenter.y - blockCenter.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Check if within block radius
            if (dist < gridSize.radius) {
                if (onBlockHit) {
                    onBlockHit(block, laser);
                }
                // Laser penetrates - don't break loop
            }
        }
    }

    /**
     * Render all lasers
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        for (const laser of this.lasers) {
            laser.render(ctx);
        }
    }

    /**
     * Clear all lasers and reset stock (for stage reset)
     */
    clear() {
        this.lasers = [];
        this.stock = 0;
        this.cooldown = 0;
    }

    /**
     * Check if any lasers are active
     * @returns {boolean}
     */
    get hasActiveLasers() {
        return this.lasers.length > 0;
    }

    /**
     * Check if weapon is depleted (no stock and no active lasers)
     * @returns {boolean}
     */
    get isDepleted() {
        return this.stock <= 0;
    }
}
