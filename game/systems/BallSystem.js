/**
 * BallSystem.js - Ball Management System
 *
 * Handles ball creation, launching, movement, and collision detection.
 * Extracted from Game.js for single responsibility.
 */

import { Ball } from '../entities/Ball.js';

export class BallSystem {
    /**
     * @param {Object} collision - CollisionSystem instance
     */
    constructor(collision) {
        this.collision = collision;

        /** @type {Ball[]} */
        this.balls = [];
    }

    /**
     * Create a new ball attached to paddle
     * @param {Object} paddle - Paddle entity
     * @returns {Ball}
     */
    createBall(paddle) {
        const pos = paddle.getBallAttachPosition();
        const ball = new Ball(pos.x, pos.y);
        ball.attached = true;
        this.balls.push(ball);
        return ball;
    }

    /**
     * Launch all attached balls
     * @param {Object} messageSystem - GameMessageSystem for hiding messages
     * @returns {boolean} - True if any ball was launched
     */
    launchBalls(messageSystem) {
        let launched = false;

        for (const ball of this.balls) {
            if (ball.attached) {
                const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
                ball.launch(angle);
                launched = true;
            }
        }

        if (launched && messageSystem) {
            messageSystem.hideMessages();
        }

        return launched;
    }

    /**
     * Update all balls
     * @param {number} dt - Delta time
     * @param {number} speedMultiplier - Speed multiplier from input
     * @param {Object} context - Update context
     * @param {Object} context.paddle
     * @param {Object} context.shield
     * @param {Object} context.weaponSystem
     * @param {number} context.canvasWidth
     * @param {number} context.canvasHeight
     * @param {Object} context.input
     * @param {Object} context.stageData
     * @param {Array} context.blocks
     * @param {Object} context.state - GameState for scoring
     * @param {Object} context.bossSystem - BossSystem for tracking destroyed blocks
     * @param {Object} context.gemSystem - GemSystem for gem drops
     * @param {Object} callbacks
     * @param {Function} callbacks.onMiss - Called when all balls are lost
     * @param {Function} callbacks.onUIUpdate - Called when UI needs update
     */
    update(dt, speedMultiplier, context, callbacks) {
        const {
            paddle,
            shield,
            weaponSystem,
            canvasWidth,
            canvasHeight,
            input,
            stageData,
            blocks,
            state,
            bossSystem,
            gemSystem
        } = context;

        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];

            // Handle attached balls
            if (ball.attached) {
                if (ball.attachOffset) {
                    ball.x = paddle.x + ball.attachOffset.x;
                    ball.y = paddle.y + ball.attachOffset.y;
                } else {
                    const pos = paddle.getBallAttachPosition();
                    ball.x = pos.x;
                    ball.y = pos.y;
                }
                continue;
            }

            // Magnet attraction
            if (weaponSystem.activeWeapon === 'magnet' && input.isMouseDown) {
                const dx = paddle.x - ball.x;
                const dy = (paddle.y - 20) - ball.y;
                ball.x += dx * 5 * dt;
                ball.y += dy * 5 * dt;
            }

            // Move ball
            ball.update(dt, speedMultiplier);

            // Wall collisions
            this.collision.checkWallCollision(ball, canvasWidth, canvasHeight);

            // Line collisions
            this._checkLineCollision(ball, i, stageData, blocks);

            // Paddle collision
            const paddleHit = paddle.checkCollision(ball);
            if (paddleHit.hit) {
                if (weaponSystem.handleMagnetCatch(ball, paddle)) {
                    // Ball was caught by magnet
                } else {
                    ball.reflectFromPaddle(paddleHit.offsetRatio);
                }
            }

            // Shield collision
            if (shield) {
                shield.checkCollision(ball);
            }

            // Block collisions
            this._checkBlockCollisions(ball, blocks, state, bossSystem, gemSystem, callbacks);

            // Miss check
            if (this.collision.checkMiss(ball, canvasHeight)) {
                this.balls.splice(i, 1);
                if (this.balls.length === 0) {
                    callbacks.onMiss();
                }
            }
        }
    }

    /**
     * Check block collisions for a ball
     * @private
     */
    _checkBlockCollisions(ball, blocks, state, bossSystem, gemSystem, callbacks) {
        const hits = this.collision.findCollidingBlocks(ball, blocks);

        for (const { block, normal } of hits) {
            if (!ball.isGhost) {
                ball.reflect(normal.x, normal.y);
            }

            block.durability--;
            state.addScore(10);

            if (block.durability <= 0) {
                block.alive = false;
                state.addScore(50);
                state.incrementCombo();

                // Track for boss regeneration
                bossSystem.trackDestroyedBlock(block);

                // Gem drop
                if (gemSystem.shouldDropGem(block)) {
                    gemSystem.spawnFromBlock(block);
                }
            }

            callbacks.onUIUpdate();
            break;
        }
    }

    /**
     * Check collision with lines and apply Block Guide
     * @private
     */
    _checkLineCollision(ball, ballIndex, stageData, blocks) {
        // stageData may be null during initialization
        const lines = stageData?.lines;
        if (!lines || lines.length === 0) return;

        const lineHit = this.collision.checkLineCollision(ball, lines);
        if (!lineHit.hit) return;

        // Prevent rapid repeated collisions
        const lineId = lineHit.line.id || lineHit.segmentIndex;
        const now = performance.now();
        const cooldown = 50;

        if (ball.lastLineHitId === lineId && (now - ball.lastLineHitTime) < cooldown) {
            return;
        }

        ball.lastLineHitId = lineId;
        ball.lastLineHitTime = now;

        ball.reflect(lineHit.normal.x, lineHit.normal.y);

        const lineThickness = lineHit.line.thickness || 3;
        const hitThreshold = ball.radius + lineThickness / 2;
        const pushDistance = hitThreshold + 2;

        ball.x += lineHit.normal.x * pushDistance;
        ball.y += lineHit.normal.y * pushDistance;

        // Block Guide (primary ball only)
        if (ballIndex === 0) {
            const config = this._resolveBlockGuideConfig(lineHit.line, stageData);
            if (config?.enabled) {
                const reflectionAngle = Math.atan2(ball.dy, ball.dx);
                this.collision.applyBlockGuide(ball, reflectionAngle, blocks, config);
            }
        }
    }

    /**
     * Resolve Block Guide configuration
     * @private
     */
    _resolveBlockGuideConfig(line, stageData) {
        const stageMeta = stageData?.meta?.blockGuide;
        const lineConfig = line?.blockGuide;

        const stageEnabled = stageMeta?.enabled !== false;
        const lineEnabled = lineConfig?.enabled !== false;

        if (!stageEnabled && !lineEnabled) return null;

        return {
            enabled: lineConfig?.enabled ?? stageMeta?.enabled ?? true,
            probability: lineConfig?.probability ?? stageMeta?.probability ?? 0.5,
            angleLimit: lineConfig?.angleLimit ?? stageMeta?.angleLimit ?? 30
        };
    }

    /**
     * Clear all balls
     */
    clear() {
        this.balls = [];
    }

    /**
     * Get ball count
     * @returns {number}
     */
    get count() {
        return this.balls.length;
    }

    /**
     * Get all balls (for rendering and other systems)
     * @returns {Ball[]}
     */
    getAll() {
        return this.balls;
    }

    /**
     * Add balls (for weapon system double effect)
     * @param {Ball[]} newBalls
     */
    addBalls(newBalls) {
        this.balls.push(...newBalls);
    }
}
