/**
 * Boss.js - Boss Entity (Spider-type)
 * Based on game_specification.md Boss Feature
 *
 * A spider-like boss that moves across the hex grid,
 * regenerates blocks, catches balls, and releases debuffs.
 */

import { hexToPixel, getHexNeighbors, getHexKey, GRID_SIZES } from '../../shared/HexMath.js';

/**
 * Boss states
 */
export const BOSS_STATES = {
    IDLE: 'idle',
    MOVING: 'moving',
    ATTACKING: 'attacking',
    REGENERATING: 'regenerating',
    STUNNED: 'stunned',
    DEFEATED: 'defeated'
};

/**
 * Boss ability types
 */
export const BOSS_ABILITIES = {
    BLOCK_REGEN: 'block_regen',    // Regenerate destroyed blocks
    BALL_CATCH: 'ball_catch',       // Catch and redirect ball
    DEBUFF_RELEASE: 'debuff_release' // Release debuff projectiles
};

export class Boss {
    /**
     * @param {Object} config - Boss configuration from stage data
     * @param {number} config.row - Starting row
     * @param {number} config.col - Starting column
     * @param {number} config.health - Total health
     * @param {string} config.gridSize - Grid size key
     * @param {string[]} [config.abilities] - Enabled abilities
     */
    constructor(config) {
        // Grid position
        this.row = config.row;
        this.col = config.col;
        this.gridSize = GRID_SIZES[config.gridSize] || GRID_SIZES.medium;

        // Pixel position (center)
        const pos = hexToPixel(this.row, this.col, this.gridSize);
        this.x = pos.x;
        this.y = pos.y;
        this.targetX = this.x;
        this.targetY = this.y;

        // Health
        this.maxHealth = config.health || 50;
        this.health = this.maxHealth;

        // Visual size (spans multiple hexes)
        this.radius = this.gridSize.radius * 2.5;
        this.legSpan = this.gridSize.radius * 3;

        // State
        this.state = BOSS_STATES.IDLE;
        this.stateTimer = 0;

        // Movement
        this.moveSpeed = 0.5; // Hexes per second
        this.moveCooldown = 0;
        this.moveInterval = 2000; // ms between moves
        this.path = [];

        // Abilities
        this.abilities = config.abilities || [
            BOSS_ABILITIES.BLOCK_REGEN,
            BOSS_ABILITIES.BALL_CATCH,
            BOSS_ABILITIES.DEBUFF_RELEASE
        ];

        // Ability cooldowns (ms)
        this.abilityCooldowns = {
            [BOSS_ABILITIES.BLOCK_REGEN]: 0,
            [BOSS_ABILITIES.BALL_CATCH]: 0,
            [BOSS_ABILITIES.DEBUFF_RELEASE]: 0
        };
        this.abilityIntervals = {
            [BOSS_ABILITIES.BLOCK_REGEN]: 5000,
            [BOSS_ABILITIES.BALL_CATCH]: 3000,
            [BOSS_ABILITIES.DEBUFF_RELEASE]: 8000
        };

        // Caught ball reference
        this.caughtBall = null;
        this.catchHoldTime = 1500; // ms to hold ball before redirecting
        this.catchTimer = 0;

        // Stun
        this.stunDuration = 1000;
        this.stunTimer = 0;

        // Animation
        this.animationTime = 0;
        this.legPhase = 0;
        this.hitFlash = 0;

        // Colors
        this.bodyColor = '#6A1B9A';
        this.legColor = '#9C27B0';
        this.eyeColor = '#FF5722';

        // Active flag
        this.active = true;

        // Debuff projectiles
        this.debuffProjectiles = [];
    }

    /**
     * Update boss
     * @param {number} dt - Delta time in seconds
     * @param {Object} context - Game context {blocks, balls, paddle, gameState}
     */
    update(dt, context) {
        if (!this.active) return;

        const dtMs = dt * 1000;
        this.animationTime += dt;
        this.legPhase = Math.sin(this.animationTime * 4) * 0.3;

        // Decrease cooldowns
        for (const ability of Object.keys(this.abilityCooldowns)) {
            this.abilityCooldowns[ability] = Math.max(0, this.abilityCooldowns[ability] - dtMs);
        }

        // Hit flash decay
        if (this.hitFlash > 0) {
            this.hitFlash -= dt * 5;
        }

        // State machine
        switch (this.state) {
            case BOSS_STATES.IDLE:
                this._updateIdle(dt, dtMs, context);
                break;
            case BOSS_STATES.MOVING:
                this._updateMoving(dt, context);
                break;
            case BOSS_STATES.ATTACKING:
                this._updateAttacking(dt, dtMs, context);
                break;
            case BOSS_STATES.STUNNED:
                this._updateStunned(dtMs);
                break;
            case BOSS_STATES.DEFEATED:
                // Boss is defeated, do nothing
                break;
        }

        // Update debuff projectiles
        this._updateDebuffProjectiles(dt, context);
    }

    /**
     * Update idle state
     * @private
     */
    _updateIdle(dt, dtMs, context) {
        this.moveCooldown -= dtMs;

        // Try to use abilities
        this._tryUseAbilities(context);

        // Move periodically
        if (this.moveCooldown <= 0) {
            this._planMove(context);
            if (this.path.length > 0) {
                this.state = BOSS_STATES.MOVING;
            }
            this.moveCooldown = this.moveInterval;
        }
    }

    /**
     * Update moving state
     * @private
     */
    _updateMoving(dt, context) {
        // Lerp towards target position
        const speed = this.moveSpeed * this.gridSize.width * dt;
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < speed || dist < 1) {
            // Arrived at target
            this.x = this.targetX;
            this.y = this.targetY;

            // Update grid position
            const nextStep = this.path.shift();
            if (nextStep) {
                this.row = nextStep.row;
                this.col = nextStep.col;
            }

            if (this.path.length > 0) {
                // Continue to next waypoint
                const next = this.path[0];
                const pos = hexToPixel(next.row, next.col, this.gridSize);
                this.targetX = pos.x;
                this.targetY = pos.y;
            } else {
                // Finished moving
                this.state = BOSS_STATES.IDLE;
            }
        } else {
            // Move towards target
            this.x += (dx / dist) * speed;
            this.y += (dy / dist) * speed;
        }
    }

    /**
     * Update attacking state (holding caught ball)
     * @private
     */
    _updateAttacking(dt, dtMs, context) {
        if (this.caughtBall) {
            this.catchTimer += dtMs;

            // Hold ball at center
            this.caughtBall.x = this.x;
            this.caughtBall.y = this.y;
            this.caughtBall.dx = 0;
            this.caughtBall.dy = 0;

            if (this.catchTimer >= this.catchHoldTime) {
                // Redirect ball towards paddle
                this._releaseCaughtBall(context);
            }
        } else {
            this.state = BOSS_STATES.IDLE;
        }
    }

    /**
     * Update stunned state
     * @private
     */
    _updateStunned(dtMs) {
        this.stunTimer -= dtMs;
        if (this.stunTimer <= 0) {
            this.state = BOSS_STATES.IDLE;
        }
    }

    /**
     * Plan movement path
     * @private
     */
    _planMove(context) {
        // Get valid neighbors
        const neighbors = getHexNeighbors(this.row, this.col);

        // Filter to valid positions (not off-screen, prefer positions with blocks nearby)
        const validMoves = neighbors.filter(n => {
            const pos = hexToPixel(n.row, n.col, this.gridSize);
            return pos.x > this.legSpan &&
                pos.x < context.canvasWidth - this.legSpan &&
                pos.y > this.legSpan &&
                pos.y < context.canvasHeight - this.legSpan - 100; // Stay above paddle area
        });

        if (validMoves.length === 0) return;

        // Prefer moving towards blocks or towards center
        const centerX = context.canvasWidth / 2;
        const centerY = context.canvasHeight / 3;

        validMoves.sort((a, b) => {
            const posA = hexToPixel(a.row, a.col, this.gridSize);
            const posB = hexToPixel(b.row, b.col, this.gridSize);
            const distA = Math.hypot(posA.x - centerX, posA.y - centerY);
            const distB = Math.hypot(posB.x - centerX, posB.y - centerY);
            return distA - distB;
        });

        // Choose random from top 3 moves for variety
        const choice = validMoves[Math.floor(Math.random() * Math.min(3, validMoves.length))];
        this.path = [choice];

        const pos = hexToPixel(choice.row, choice.col, this.gridSize);
        this.targetX = pos.x;
        this.targetY = pos.y;
    }

    /**
     * Try to use abilities
     * @private
     */
    _tryUseAbilities(context) {
        // Block regeneration
        if (this.abilities.includes(BOSS_ABILITIES.BLOCK_REGEN) &&
            this.abilityCooldowns[BOSS_ABILITIES.BLOCK_REGEN] <= 0) {
            this._useBlockRegen(context);
        }

        // Ball catch
        if (this.abilities.includes(BOSS_ABILITIES.BALL_CATCH) &&
            this.abilityCooldowns[BOSS_ABILITIES.BALL_CATCH] <= 0) {
            this._tryBallCatch(context);
        }

        // Debuff release
        if (this.abilities.includes(BOSS_ABILITIES.DEBUFF_RELEASE) &&
            this.abilityCooldowns[BOSS_ABILITIES.DEBUFF_RELEASE] <= 0) {
            this._useDebuffRelease(context);
        }
    }

    /**
     * Regenerate nearby destroyed blocks
     * @private
     */
    _useBlockRegen(context) {
        const { blocks, destroyedBlocks } = context;
        if (!destroyedBlocks || destroyedBlocks.length === 0) return;

        // Find destroyed blocks near the boss
        const regenCandidates = destroyedBlocks.filter(db => {
            const pos = hexToPixel(db.row, db.col, this.gridSize);
            const dist = Math.hypot(pos.x - this.x, pos.y - this.y);
            return dist < this.gridSize.radius * 5;
        });

        if (regenCandidates.length > 0) {
            // Regenerate up to 3 blocks
            const toRegen = regenCandidates.slice(0, 3);
            for (const block of toRegen) {
                const key = getHexKey(block.row, block.col);

                // Find and revive the block
                const existingBlock = blocks.find(b =>
                    b.row === block.row && b.col === block.col
                );

                if (existingBlock && !existingBlock.alive) {
                    existingBlock.alive = true;
                    existingBlock.durability = 1;
                }
            }

            this.abilityCooldowns[BOSS_ABILITIES.BLOCK_REGEN] =
                this.abilityIntervals[BOSS_ABILITIES.BLOCK_REGEN];
        }
    }

    /**
     * Try to catch a ball
     * @private
     */
    _tryBallCatch(context) {
        const { balls } = context;
        if (!balls || this.caughtBall) return;

        for (const ball of balls) {
            if (!ball.active || ball.attached) continue;

            const dist = Math.hypot(ball.x - this.x, ball.y - this.y);
            if (dist < this.radius) {
                // Catch the ball
                this.caughtBall = ball;
                this.catchTimer = 0;
                this.state = BOSS_STATES.ATTACKING;
                this.abilityCooldowns[BOSS_ABILITIES.BALL_CATCH] =
                    this.abilityIntervals[BOSS_ABILITIES.BALL_CATCH];
                break;
            }
        }
    }

    /**
     * Release caught ball towards paddle
     * @private
     */
    _releaseCaughtBall(context) {
        if (!this.caughtBall) return;

        const { paddle } = context;
        if (paddle) {
            // Aim at paddle with some randomness
            const targetX = paddle.x + (Math.random() - 0.5) * paddle.width;
            const targetY = paddle.y;
            const dx = targetX - this.caughtBall.x;
            const dy = targetY - this.caughtBall.y;
            const len = Math.hypot(dx, dy);

            if (len > 0) {
                this.caughtBall.dx = dx / len;
                this.caughtBall.dy = dy / len;
                // Boost speed slightly
                this.caughtBall.speed = this.caughtBall.baseSpeed * 1.2;
            }
        }

        this.caughtBall = null;
        this.state = BOSS_STATES.IDLE;
    }

    /**
     * Release debuff projectiles
     * @private
     */
    _useDebuffRelease(context) {
        // Create debuff projectiles
        const numProjectiles = 3;
        const spreadAngle = Math.PI / 4;

        for (let i = 0; i < numProjectiles; i++) {
            const angle = Math.PI / 2 + (i - (numProjectiles - 1) / 2) * (spreadAngle / numProjectiles);
            this.debuffProjectiles.push({
                x: this.x,
                y: this.y,
                dx: Math.cos(angle),
                dy: Math.sin(angle),
                speed: 3,
                radius: 6,
                type: 'slow', // Effect type
                active: true
            });
        }

        this.abilityCooldowns[BOSS_ABILITIES.DEBUFF_RELEASE] =
            this.abilityIntervals[BOSS_ABILITIES.DEBUFF_RELEASE];
    }

    /**
     * Update debuff projectiles
     * @private
     */
    _updateDebuffProjectiles(dt, context) {
        const { paddle, canvasWidth, canvasHeight } = context;

        for (const proj of this.debuffProjectiles) {
            if (!proj.active) continue;

            // Move projectile
            proj.x += proj.dx * proj.speed * dt * 60;
            proj.y += proj.dy * proj.speed * dt * 60;

            // Check bounds
            if (proj.x < 0 || proj.x > canvasWidth ||
                proj.y < 0 || proj.y > canvasHeight) {
                proj.active = false;
                continue;
            }

            // Check paddle collision
            if (paddle) {
                const halfWidth = paddle.width / 2;
                const halfHeight = paddle.height / 2;

                if (proj.x >= paddle.x - halfWidth - proj.radius &&
                    proj.x <= paddle.x + halfWidth + proj.radius &&
                    proj.y >= paddle.y - halfHeight - proj.radius &&
                    proj.y <= paddle.y + halfHeight + proj.radius) {
                    // Hit paddle - apply debuff
                    proj.active = false;
                    if (context.onDebuffHit) {
                        context.onDebuffHit(proj.type);
                    }
                }
            }
        }

        // Remove inactive projectiles
        this.debuffProjectiles = this.debuffProjectiles.filter(p => p.active);
    }

    /**
     * Take damage
     * @param {number} amount - Damage amount
     * @returns {boolean} True if defeated
     */
    takeDamage(amount = 1) {
        if (this.state === BOSS_STATES.DEFEATED) return false;

        this.health -= amount;
        this.hitFlash = 1;

        // Brief stun on hit
        this.state = BOSS_STATES.STUNNED;
        this.stunTimer = this.stunDuration;

        // Release caught ball if any
        if (this.caughtBall) {
            this.caughtBall.applyRandomScatter();
            this.caughtBall = null;
        }

        if (this.health <= 0) {
            this.health = 0;
            this.state = BOSS_STATES.DEFEATED;
            this.active = false;
            return true;
        }

        return false;
    }

    /**
     * Check collision with ball
     * @param {Ball} ball
     * @returns {boolean} True if collision
     */
    checkBallCollision(ball) {
        if (!this.active || ball.attached) return false;

        const dist = Math.hypot(ball.x - this.x, ball.y - this.y);
        return dist < this.radius + ball.radius;
    }

    /**
     * Render boss
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        if (!this.active && this.state !== BOSS_STATES.DEFEATED) return;

        ctx.save();

        // Defeated fade out
        if (this.state === BOSS_STATES.DEFEATED) {
            ctx.globalAlpha = 0.3;
        }

        // Hit flash effect
        if (this.hitFlash > 0) {
            ctx.filter = `brightness(${1 + this.hitFlash})`;
        }

        // Stun effect
        if (this.state === BOSS_STATES.STUNNED) {
            ctx.filter = 'saturate(0.5)';
        }

        // Draw legs
        this._renderLegs(ctx);

        // Draw body
        this._renderBody(ctx);

        // Draw eyes
        this._renderEyes(ctx);

        // Health bar
        this._renderHealthBar(ctx);

        ctx.restore();

        // Draw debuff projectiles
        this._renderDebuffProjectiles(ctx);
    }

    /**
     * Render spider legs
     * @private
     */
    _renderLegs(ctx) {
        ctx.strokeStyle = this.legColor;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        const legCount = 8;
        const legLength = this.legSpan;

        for (let i = 0; i < legCount; i++) {
            const side = i < 4 ? -1 : 1;
            const legIndex = i % 4;
            const baseAngle = (legIndex * Math.PI / 6 + Math.PI / 6) * side;

            // Leg animation
            const phase = this.legPhase * (legIndex % 2 === 0 ? 1 : -1);

            ctx.beginPath();
            ctx.moveTo(this.x, this.y);

            // First segment
            const midX = this.x + Math.cos(baseAngle + phase) * legLength * 0.5;
            const midY = this.y + Math.sin(baseAngle + phase) * legLength * 0.5;

            // Second segment (bent knee)
            const endX = midX + Math.cos(baseAngle + Math.PI / 4 * side) * legLength * 0.6;
            const endY = midY + Math.abs(Math.sin(baseAngle)) * legLength * 0.4 + legLength * 0.3;

            ctx.quadraticCurveTo(midX, midY, endX, endY);
            ctx.stroke();
        }
    }

    /**
     * Render body
     * @private
     */
    _renderBody(ctx) {
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.radius * 0.8, this.radius * 0.8, this.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body gradient
        const gradient = ctx.createRadialGradient(
            this.x - this.radius * 0.3, this.y - this.radius * 0.3, 0,
            this.x, this.y, this.radius
        );
        gradient.addColorStop(0, '#9C27B0');
        gradient.addColorStop(0.7, this.bodyColor);
        gradient.addColorStop(1, '#4A148C');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Body pattern
        ctx.strokeStyle = '#7B1FA2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * Render eyes
     * @private
     */
    _renderEyes(ctx) {
        const eyeRadius = this.radius * 0.15;
        const eyeSpacing = this.radius * 0.4;

        // Main eyes (larger)
        for (let i = -1; i <= 1; i += 2) {
            ctx.fillStyle = this.eyeColor;
            ctx.beginPath();
            ctx.arc(this.x + i * eyeSpacing * 0.8, this.y - this.radius * 0.2, eyeRadius, 0, Math.PI * 2);
            ctx.fill();

            // Pupil
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(this.x + i * eyeSpacing * 0.8, this.y - this.radius * 0.2, eyeRadius * 0.5, 0, Math.PI * 2);
            ctx.fill();

            // Glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.eyeColor;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Secondary eyes (smaller)
        for (let i = -1; i <= 1; i += 2) {
            ctx.fillStyle = this.eyeColor;
            ctx.beginPath();
            ctx.arc(this.x + i * eyeSpacing * 1.2, this.y - this.radius * 0.1, eyeRadius * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Render health bar
     * @private
     */
    _renderHealthBar(ctx) {
        const barWidth = this.radius * 2;
        const barHeight = 8;
        const barX = this.x - barWidth / 2;
        const barY = this.y - this.radius - 20;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Health fill
        const healthPercent = this.health / this.maxHealth;
        const healthColor = healthPercent > 0.5 ? '#4CAF50' :
            healthPercent > 0.25 ? '#FFC107' : '#F44336';

        ctx.fillStyle = healthColor;
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    /**
     * Render debuff projectiles
     * @private
     */
    _renderDebuffProjectiles(ctx) {
        for (const proj of this.debuffProjectiles) {
            if (!proj.active) continue;

            ctx.save();

            // Glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#FF5722';

            ctx.fillStyle = '#FF5722';
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
            ctx.fill();

            // Inner
            ctx.fillStyle = '#FFEB3B';
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, proj.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    /**
     * Get boss bounds for collision detection
     * @returns {{x: number, y: number, radius: number}}
     */
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            radius: this.radius
        };
    }
}
