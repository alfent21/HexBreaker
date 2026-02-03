/**
 * WeaponSystem.js - Weapon Management System
 *
 * Handles weapon purchases, activation, and effects.
 * Manages active weapon state and timed effects.
 */

import { Ball } from '../entities/Ball.js';

/** Weapon costs in gems */
export const WEAPON_COSTS = {
    slow: 1,
    wide: 2,
    double: 2,
    laser: 3,
    shield: 4,
    magnet: 4,
    ghost: 4
};

/** Weapon durations in milliseconds */
const WEAPON_DURATIONS = {
    slow: 15000,
    wide: 20000,
    magnet: 20000,
    ghost: 15000
};

export class WeaponSystem {
    /**
     * @param {Object} messageSystem - GameMessageSystem instance for showing messages
     * @param {Object} laserSystem - LaserSystem instance for laser weapon
     */
    constructor(messageSystem, laserSystem) {
        this.messageSystem = messageSystem;
        this.laserSystem = laserSystem;

        /** @type {string|null} - Currently active weapon (laser, magnet, ghost) */
        this.activeWeapon = null;

        /** @type {Set<number>} - Active timeout IDs for cleanup */
        this._activeTimeouts = new Set();
    }

    /**
     * Get weapon cost
     * @param {string} weaponId
     * @returns {number|undefined}
     */
    getCost(weaponId) {
        return WEAPON_COSTS[weaponId];
    }

    /**
     * Check if weapon can be purchased
     * @param {string} weaponId
     * @param {number} currentGems
     * @returns {boolean}
     */
    canPurchase(weaponId, currentGems) {
        const cost = WEAPON_COSTS[weaponId];
        return cost !== undefined && currentGems >= cost;
    }

    /**
     * Purchase and activate a weapon
     * @param {string} weaponId
     * @param {Object} context - Game context { state, balls, paddle, shield }
     * @returns {boolean} - True if purchase successful
     */
    purchase(weaponId, context) {
        const { state, balls, paddle, shield } = context;

        const cost = WEAPON_COSTS[weaponId];
        if (!cost || state.gems < cost) {
            return false;
        }

        // Consume gems
        state.gems -= cost;

        // Activate weapon effect
        this._activate(weaponId, { balls, paddle, shield });

        return true;
    }

    /**
     * Activate weapon effect
     * @param {string} weaponId
     * @param {Object} context - { balls, paddle, shield }
     * @private
     */
    _activate(weaponId, context) {
        const { balls, paddle, shield } = context;

        this.messageSystem.showMessage(`🔫 ${weaponId.toUpperCase()} activated!`, 'info', 2000);

        switch (weaponId) {
            case 'slow':
                this._activateSlow(balls);
                break;

            case 'wide':
                this._activateWide(paddle);
                break;

            case 'double':
                this._activateDouble(balls);
                break;

            case 'laser':
                this._activateLaser();
                break;

            case 'shield':
                this._activateShield(shield);
                break;

            case 'magnet':
                this._activateMagnet();
                break;

            case 'ghost':
                this._activateGhost();
                break;
        }
    }

    /**
     * Slow: Reduce ball speed (0.6x for 15s)
     * @private
     */
    _activateSlow(balls) {
        balls.forEach(ball => ball.setSpeedMultiplier(0.6));

        const timeoutId = setTimeout(() => {
            balls.forEach(ball => ball.setSpeedMultiplier(1.0));
            this._activeTimeouts.delete(timeoutId);
        }, WEAPON_DURATIONS.slow);

        this._activeTimeouts.add(timeoutId);
    }

    /**
     * Wide: Expand paddle (1.5x for 20s)
     * @private
     */
    _activateWide(paddle) {
        paddle.setWidthMultiplier(1.5);

        const timeoutId = setTimeout(() => {
            paddle.setWidthMultiplier(1.0);
            this._activeTimeouts.delete(timeoutId);
        }, WEAPON_DURATIONS.wide);

        this._activeTimeouts.add(timeoutId);
    }

    /**
     * Double: Duplicate all active balls
     * @private
     */
    _activateDouble(balls) {
        const newBalls = [];

        for (const ball of balls) {
            if (!ball.active) continue;

            const newBall = new Ball(ball.x, ball.y);
            newBall.dx = -ball.dx; // Reverse horizontal direction
            newBall.dy = ball.dy;
            newBall.speed = ball.speed;
            newBall.active = true;
            newBall.attached = false;
            newBalls.push(newBall);
        }

        balls.push(...newBalls);
    }

    /**
     * Laser: Add laser stock, set as active weapon
     * @private
     */
    _activateLaser() {
        this.activeWeapon = 'laser';
        this.laserSystem.addStock(5);
    }

    /**
     * Shield: Activate shield protection
     * @private
     */
    _activateShield(shield) {
        if (shield) {
            shield.activate();
        }
    }

    /**
     * Magnet: Enable ball catching (20s)
     * @private
     */
    _activateMagnet() {
        this.activeWeapon = 'magnet';
        this.laserSystem.stock = 0; // Clear laser stock when switching

        const timeoutId = setTimeout(() => {
            if (this.activeWeapon === 'magnet') {
                this.activeWeapon = null;
            }
            this._activeTimeouts.delete(timeoutId);
        }, WEAPON_DURATIONS.magnet);

        this._activeTimeouts.add(timeoutId);
    }

    /**
     * Ghost: Enable block penetration (15s)
     * @private
     */
    _activateGhost() {
        this.activeWeapon = 'ghost';
        this.laserSystem.stock = 0; // Clear laser stock when switching

        const timeoutId = setTimeout(() => {
            if (this.activeWeapon === 'ghost') {
                this.activeWeapon = null;
            }
            this._activeTimeouts.delete(timeoutId);
        }, WEAPON_DURATIONS.ghost);

        this._activeTimeouts.add(timeoutId);
    }

    /**
     * Update weapon state (called from game loop)
     * @param {number} dt - Delta time
     * @param {Object} input - InputManager
     * @param {Array} balls - Ball array
     * @param {Object} paddle - Paddle entity
     */
    update(dt, input, balls, paddle) {
        // Laser firing
        if (this.activeWeapon === 'laser') {
            if (input.keys[' '] || input.isMouseDown) {
                if (this.laserSystem.canFire()) {
                    this.laserSystem.fire(paddle.x, paddle.y);
                }
            }

            // Check if laser is depleted
            if (this.laserSystem.isDepleted) {
                this.activeWeapon = null;
            }
        }

        // Ghost effect on primary ball
        if (this.activeWeapon === 'ghost' && balls.length > 0) {
            balls[0].isGhost = input.isMouseDown;
        }
    }

    /**
     * Handle magnet ball catch
     * @param {Object} ball - Ball that hit paddle
     * @param {Object} paddle - Paddle entity
     * @returns {boolean} - True if ball was caught
     */
    handleMagnetCatch(ball, paddle) {
        if (this.activeWeapon !== 'magnet' || ball.isGhost) {
            return false;
        }

        // Attach ball to paddle
        ball.attached = true;
        ball.attachOffset = {
            x: ball.x - paddle.x,
            y: ball.y - paddle.y
        };
        ball.dx = 0;
        ball.dy = 0;

        return true;
    }

    /**
     * Get weapon availability for UI
     * @param {number} currentGems
     * @returns {Object} - { weaponId: boolean, ... }
     */
    getAvailability(currentGems) {
        const availability = {};
        for (const [id, cost] of Object.entries(WEAPON_COSTS)) {
            availability[id] = currentGems >= cost;
        }
        return availability;
    }

    /**
     * Reset weapon system (for new stage)
     */
    reset() {
        this.activeWeapon = null;

        // Clear all active timeouts
        for (const timeoutId of this._activeTimeouts) {
            clearTimeout(timeoutId);
        }
        this._activeTimeouts.clear();

        this.laserSystem.clear();
    }
}
