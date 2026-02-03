/**
 * BossSystem.js - Boss Management System
 *
 * Handles boss creation, updates, collision detection, and rewards.
 * Coordinates with GemSystem for boss defeat rewards.
 */

import { Boss, BOSS_STATES } from '../entities/Boss.js';

export class BossSystem {
    /**
     * @param {Object} gemSystem - GemSystem instance for spawning rewards
     */
    constructor(gemSystem) {
        this.gemSystem = gemSystem;

        /** @type {Boss|null} */
        this.boss = null;

        /** @type {Array<{row: number, col: number, originalColor: string}>} */
        this.destroyedBlocks = [];

        /** @type {number} - Score bonus for hitting boss */
        this.hitScore = 100;

        /** @type {number} - Score bonus for defeating boss */
        this.defeatScore = 5000;

        /** @type {number} - Laser damage to boss */
        this.laserDamage = 2;

        /** @type {number} - Number of gems to spawn on defeat */
        this.rewardGemCount = 10;
    }

    /**
     * Load boss from stage data
     * @param {Object} bossConfig - Boss configuration from stage
     * @param {string} gridSize - Grid size key
     */
    loadBoss(bossConfig, gridSize) {
        if (!bossConfig) {
            this.boss = null;
            return;
        }

        this.boss = new Boss({
            ...bossConfig,
            gridSize: gridSize || 'medium'
        });

        this.destroyedBlocks = [];
    }

    /**
     * Check if boss exists and is active
     * @returns {boolean}
     */
    get isActive() {
        return this.boss !== null && this.boss.active;
    }

    /**
     * Track a destroyed block for potential regeneration
     * @param {Object} block - The destroyed block
     */
    trackDestroyedBlock(block) {
        this.destroyedBlocks.push({
            row: block.row,
            col: block.col,
            originalColor: block.color
        });
    }

    /**
     * Update boss
     * @param {number} dt - Delta time
     * @param {Object} context - Game context
     * @param {Array} context.balls - Ball array
     * @param {Array} context.blocks - Block array from GameState
     * @param {Object} context.paddle - Paddle entity
     * @param {number} context.canvasWidth
     * @param {number} context.canvasHeight
     * @param {Function} context.onDebuffHit - Callback when debuff hits player
     */
    update(dt, context) {
        if (!this.boss || !this.boss.active) return;

        const bossContext = {
            balls: context.balls,
            blocks: context.blocks,
            destroyedBlocks: this.destroyedBlocks,
            paddle: context.paddle,
            canvasWidth: context.canvasWidth,
            canvasHeight: context.canvasHeight,
            onDebuffHit: context.onDebuffHit
        };

        this.boss.update(dt, bossContext);
    }

    /**
     * Check ball collisions with boss
     * @param {Array} balls - Ball array
     * @param {Object} state - GameState for score/combo
     * @returns {{hit: boolean, defeated: boolean}}
     */
    checkBallCollisions(balls, state) {
        if (!this.boss || !this.boss.active) {
            return { hit: false, defeated: false };
        }

        let hitOccurred = false;
        let defeated = false;

        for (const ball of balls) {
            if (ball.attached || !ball.active) continue;

            if (this.boss.checkBallCollision(ball)) {
                // Damage boss
                const wasDefeated = this.boss.takeDamage(1);

                // Reflect ball
                const dx = ball.x - this.boss.x;
                const dy = ball.y - this.boss.y;
                const len = Math.hypot(dx, dy);

                if (len > 0) {
                    ball.reflect(dx / len, dy / len);
                    // Push ball away
                    ball.x += (dx / len) * 10;
                    ball.y += (dy / len) * 10;
                }

                // Score
                state.addScore(this.hitScore);
                state.incrementCombo();

                hitOccurred = true;

                if (wasDefeated) {
                    state.addScore(this.defeatScore);
                    state.setBossDefeated();
                    this._spawnReward();
                    defeated = true;
                    break;
                }
            }
        }

        return { hit: hitOccurred, defeated };
    }

    /**
     * Check laser collisions with boss
     * @param {Array} lasers - Laser array
     * @param {Object} state - GameState for score
     * @returns {{hit: boolean, defeated: boolean}}
     */
    checkLaserCollisions(lasers, state) {
        if (!this.boss || !this.boss.active) {
            return { hit: false, defeated: false };
        }

        let hitOccurred = false;
        let defeated = false;

        for (const laser of lasers) {
            if (!laser.active) continue;

            const dist = Math.hypot(laser.x - this.boss.x, laser.y - this.boss.y);

            if (dist < this.boss.radius) {
                const wasDefeated = this.boss.takeDamage(this.laserDamage);
                state.addScore(50);

                hitOccurred = true;

                if (wasDefeated) {
                    state.addScore(this.defeatScore);
                    state.setBossDefeated();
                    this._spawnReward();
                    defeated = true;
                    break;
                }
            }
        }

        return { hit: hitOccurred, defeated };
    }

    /**
     * Spawn reward gems when boss is defeated
     * @private
     */
    _spawnReward() {
        if (this.boss && this.gemSystem) {
            this.gemSystem.spawnBossReward(
                this.boss.x,
                this.boss.y,
                this.rewardGemCount
            );
        }
    }

    /**
     * Render boss
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        if (this.boss) {
            this.boss.render(ctx);
        }
    }

    /**
     * Reset boss system (for new stage)
     */
    reset() {
        this.boss = null;
        this.destroyedBlocks = [];
    }

    /**
     * Get boss health percentage (for UI)
     * @returns {number} - 0 to 1
     */
    get healthPercent() {
        if (!this.boss) return 0;
        return this.boss.health / this.boss.maxHealth;
    }
}
