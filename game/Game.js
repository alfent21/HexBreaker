/**
 * Game.js - Main Game Class
 * Based on game_specification.md
 * 
 * Coordinates all game systems for a playable block breaker experience.
 */

import { GameState, STATES } from './GameState.js';
import { InputManager } from './InputManager.js';
import { Ball } from './entities/Ball.js';
import { Paddle } from './entities/Paddle.js';
import { PowerGem } from './entities/PowerGem.js';
import { Laser } from './entities/Laser.js';
import { Shield } from './entities/Shield.js';
import { CollisionSystem } from './physics/CollisionSystem.js';
import { Boss, BOSS_STATES } from './entities/Boss.js';
import { hexToPixel, GRID_SIZES } from '../shared/HexMath.js';
import { drawHexBlock, drawLines } from '../shared/Renderer.js';

// Weapon costs
const WEAPON_COSTS = {
    slow: 1,
    wide: 2,
    double: 2,
    laser: 3,
    shield: 4,
    magnet: 4,
    ghost: 4
};

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Systems
        this.state = new GameState();
        this.input = new InputManager(canvas);
        this.collision = new CollisionSystem();
        this.shield = null;

        // Entities
        this.balls = [];
        this.paddle = null;
        this.powerGems = [];
        this.lasers = [];
        this.laserStock = 0;
        this.activeWeapon = null;
        this.laserCooldown = 0;

        // Boss
        this.boss = null;
        this.destroyedBlocks = []; // For boss block regeneration

        // Game loop
        this.lastTime = 0;
        this.running = false;

        // UI callbacks
        this.onScoreUpdate = null;
        this.onLivesUpdate = null;
        this.onGemsUpdate = null;
        this.onComboUpdate = null;
        this.onWeaponUpdate = null; // New callback for UI update
        this.onGameOver = null;
        this.onStageClear = null;

        // Stage data
        this.canvasWidth = canvas.width;
        this.canvasHeight = canvas.height;
        this.gridSize = GRID_SIZES.medium;

        // Background images
        this.backgroundImages = [];
        this.displayScale = 1;

        // Bind methods
        this._gameLoop = this._gameLoop.bind(this);

        // Setup input callbacks
        this.input.onLaunch = () => this._launchBall();
        this.input.onWeapon = (weaponId) => this._purchaseWeapon(weaponId);

        // Window resize handler
        window.addEventListener('resize', () => this._setupCanvas());
    }

    /**
     * Setup canvas size to fit screen
     * @private
     */
    _setupCanvas() {
        // Set logical size
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;

        // Get available space
        const wrapper = this.canvas.parentElement;
        let availableWidth, availableHeight;

        if (wrapper && wrapper.offsetWidth > 0) {
            availableWidth = wrapper.clientWidth;
            availableHeight = wrapper.clientHeight;
        } else {
            availableWidth = window.innerWidth;
            availableHeight = window.innerHeight - 150; // UI space
        }

        // Calculate scale to fit
        const scaleX = availableWidth / this.canvas.width;
        const scaleY = availableHeight / this.canvas.height;
        const scale = Math.min(scaleX, scaleY, 1); // Shrink only, never enlarge

        // Apply CSS display size
        this.canvas.style.width = (this.canvas.width * scale) + 'px';
        this.canvas.style.height = (this.canvas.height * scale) + 'px';

        this.displayScale = scale;
    }

    /**
     * Load and start a stage
     * @param {Object} stageData - Stage data from editor
     */
    loadStage(stageData) {
        // Set canvas size
        if (stageData.canvas) {
            this.canvasWidth = stageData.canvas.width;
            this.canvasHeight = stageData.canvas.height;
        }

        // Setup canvas with resize
        this._setupCanvas();

        // Set grid size
        if (stageData.gridSize) {
            if (typeof stageData.gridSize === 'string') {
                // String key (e.g., 'medium') - look up in GRID_SIZES
                this.gridSize = GRID_SIZES[stageData.gridSize] || GRID_SIZES.medium;
                this.collision.setGridSize(stageData.gridSize);
            } else {
                // Object format from serialization - use directly
                this.gridSize = stageData.gridSize;
                // Determine grid size name for collision system
                const gridName = this._getGridSizeName(stageData.gridSize.radius);
                this.collision.setGridSize(gridName);
            }
        }

        // Load background images
        this._loadBackgrounds(stageData);

        // Load state
        this.state.loadStage(stageData);
        this.state.reset();

        this.balls = [];
        this.powerGems = [];
        this.lasers = [];
        this.laserStock = 0;
        this.activeWeapon = null;
        this.laserCooldown = 0;
        this.boss = null;
        this.destroyedBlocks = [];

        // Create boss if stage has boss config
        if (stageData.boss) {
            this.boss = new Boss({
                ...stageData.boss,
                gridSize: stageData.gridSize || 'medium'
            });
        }

        // Create paddle at bottom center
        this.paddle = new Paddle(this.canvasWidth / 2, this.canvasHeight - 50);
        this.paddle.setBounds(0, this.canvasWidth);
        this.shield = new Shield(this.canvasHeight - 15);

        // Create initial ball
        this._createBall();

        // Start game
        this.running = true;
        this.lastTime = performance.now();

        // Recalculate canvas size after DOM update
        requestAnimationFrame(() => {
            this._setupCanvas();
            requestAnimationFrame(this._gameLoop);
        });

        // Update UI
        this._updateUI();
    }

    /**
     * Create a test stage for demonstration
     */
    loadTestStage() {
        // Create simple test stage with grid of blocks
        const blocks = [];
        for (let row = 2; row < 8; row++) {
            const cols = row % 2 === 0 ? 15 : 14;
            for (let col = 2; col < cols; col++) {
                blocks.push({
                    row,
                    col,
                    durability: Math.floor(Math.random() * 3) + 1,
                    color: this._getRandomBlockColor()
                });
            }
        }

        this.loadStage({
            canvas: { width: 1280, height: 720 },
            gridSize: 'medium',
            blocks
        });
    }

    /**
     * Get random block color
     * @private
     */
    _getRandomBlockColor() {
        const colors = [
            '#F44336', '#E91E63', '#9C27B0', '#673AB7',
            '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
            '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
            '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Get grid size name from radius value
     * @param {number} radius
     * @returns {string}
     * @private
     */
    _getGridSizeName(radius) {
        if (radius <= 15) return 'small';
        if (radius <= 40) return 'medium';
        return 'large';
    }

    /**
     * Load background images from stage data
     * @param {Object} stageData
     * @private
     */
    _loadBackgrounds(stageData) {
        this.backgroundImages = [];

        // Collect backgrounds from baseLayer and backgrounds array
        const backgrounds = stageData.backgrounds || [];

        // Sort by zIndex
        const sorted = [...backgrounds].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        for (const bgData of sorted) {
            if (bgData.imageData) {
                const img = new Image();
                img.src = bgData.imageData;
                this.backgroundImages.push({
                    image: img,
                    x: bgData.x || 0,
                    y: bgData.y || 0,
                    width: bgData.width || this.canvasWidth,
                    height: bgData.height || this.canvasHeight,
                    zIndex: bgData.zIndex || 0
                });
            }
        }
    }

    /**
     * Create a new ball attached to paddle
     * @private
     */
    _createBall() {
        const pos = this.paddle.getBallAttachPosition();
        const ball = new Ball(pos.x, pos.y);
        ball.attached = true;
        this.balls.push(ball);
        return ball;
    }

    /**
     * Launch ball from paddle
     * @private
     */
    _launchBall() {
        for (const ball of this.balls) {
            if (ball.attached) {
                // Launch at slight random angle
                const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
                ball.launch(angle);
            }
        }
    }

    /**
     * Main game loop
     * @private
     */
    _gameLoop(currentTime) {
        if (!this.running) return;

        const dt = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        if (this.state.state === STATES.PLAYING) {
            this._update(dt);
        }

        this._render();

        requestAnimationFrame(this._gameLoop);
    }

    /**
     * Update game state
     * @private
     */
    _update(dt) {
        const speedMultiplier = this.input.getSpeedMultiplier();

        // Weapon Input (Laser)
        if (this.activeWeapon === 'laser' && (this.input.keys[' '] || this.input.isMouseDown)) {
            if (this.laserStock > 0 && this.laserCooldown <= 0) {
                this._fireLaser();
                this.laserCooldown = 0.5;
            }
        }
        if (this.laserCooldown > 0) this.laserCooldown -= dt;

        // Weapon Input (Ghost)
        if (this.activeWeapon === 'ghost' && this.balls.length > 0) {
            // Apply ghost effect to primary ball while mouse held
            this.balls[0].isGhost = this.input.isMouseDown;
        }

        // Update lasers
        this._updateLasers(dt);

        // Update paddle
        this.paddle.update(this.input, this.canvasWidth);

        // Update balls
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];

            if (ball.attached) {
                if (ball.attachOffset) {
                    ball.x = this.paddle.x + ball.attachOffset.x;
                    ball.y = this.paddle.y + ball.attachOffset.y;
                } else {
                    const pos = this.paddle.getBallAttachPosition();
                    ball.x = pos.x;
                    ball.y = pos.y;
                }
                continue;
            }

            // Magnet Attraction
            if (this.activeWeapon === 'magnet' && this.input.isMouseDown) {
                const dx = this.paddle.x - ball.x;
                const dy = (this.paddle.y - 20) - ball.y;
                // Simple attraction force
                ball.x += dx * 5 * dt;
                ball.y += dy * 5 * dt;
            }

            // Move ball
            ball.update(dt, speedMultiplier);

            // Wall collisions (canvas boundaries)
            this.collision.checkWallCollision(ball, this.canvasWidth, this.canvasHeight);

            // Line collisions (collision lines from editor)
            this._checkLineCollision(ball, i);

            // Paddle collision
            const paddleHit = this.paddle.checkCollision(ball);
            if (paddleHit.hit) {
                if (this.activeWeapon === 'magnet' && !ball.isGhost) {
                    // Catch ball
                    ball.attached = true;
                    ball.attachOffset = {
                        x: ball.x - this.paddle.x,
                        y: ball.y - this.paddle.y
                    };
                    ball.dx = 0;
                    ball.dy = 0;
                } else {
                    ball.reflectFromPaddle(paddleHit.offsetRatio);
                }
            }

            // Shield collision
            if (this.shield && this.shield.checkCollision(ball)) {
                // Handled in shield class (bounce)
            }

            // Block collisions
            this._checkBlockCollisions(ball);

            // Miss check (ball below screen)
            if (this.collision.checkMiss(ball, this.canvasHeight)) {
                this.balls.splice(i, 1);

                // If no balls left, lose life
                if (this.balls.length === 0) {
                    this._loseLife();
                }
            }
        }

        // Update power gems
        for (let i = this.powerGems.length - 1; i >= 0; i--) {
            const gem = this.powerGems[i];
            gem.update(dt);

            // Collection
            if (gem.checkCollection(this.paddle)) {
                this.state.addGems(1);
                this.state.addScore(100); // Bonus score for gem
                this.powerGems.splice(i, 1);
                this._updateUI();
                continue;
            }

            // Off screen
            if (gem.isOffScreen(this.canvasHeight)) {
                this.powerGems.splice(i, 1);
            }
        }

        // Update boss
        if (this.boss && this.boss.active) {
            this._updateBoss(dt);
        }

        // Check clear condition
        if (this.state.isCleared() && (!this.boss || !this.boss.active)) {
            this._stageClear();
        }
    }

    /**
     * Update boss entity
     * @private
     */
    _updateBoss(dt) {
        if (!this.boss) return;

        // Prepare context for boss
        const context = {
            balls: this.balls,
            blocks: this.state.blocks,
            destroyedBlocks: this.destroyedBlocks,
            paddle: this.paddle,
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            onDebuffHit: (type) => this._applyDebuff(type)
        };

        this.boss.update(dt, context);

        // Check ball collisions with boss
        for (const ball of this.balls) {
            if (ball.attached || !ball.active) continue;

            if (this.boss.checkBallCollision(ball)) {
                // Damage boss
                const defeated = this.boss.takeDamage(1);

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

                // Score for hitting boss
                this.state.addScore(100);
                this.state.incrementCombo();

                if (defeated) {
                    // Boss defeated bonus
                    this.state.addScore(5000);
                    this.state.setBossDefeated();
                    this._spawnBossReward();
                }

                this._updateUI();
            }
        }

        // Check laser collisions with boss
        for (const laser of this.lasers) {
            if (!laser.active) continue;

            const dist = Math.hypot(laser.x - this.boss.x, laser.y - this.boss.y);
            if (dist < this.boss.radius) {
                const defeated = this.boss.takeDamage(2);
                this.state.addScore(50);

                if (defeated) {
                    this.state.addScore(5000);
                    this.state.setBossDefeated();
                    this._spawnBossReward();
                }

                this._updateUI();
            }
        }
    }

    /**
     * Apply debuff effect from boss
     * @private
     */
    _applyDebuff(type) {
        switch (type) {
            case 'slow':
                // Slow paddle movement temporarily
                // Note: InputManager doesn't have direct speed control,
                // so we'll slow ball speed instead
                this.balls.forEach(ball => ball.setSpeedMultiplier(0.5));
                setTimeout(() => {
                    this.balls.forEach(ball => ball.setSpeedMultiplier(1.0));
                }, 5000);
                break;
            case 'shrink':
                // Shrink paddle
                this.paddle.setWidthMultiplier(0.6);
                setTimeout(() => {
                    this.paddle.setWidthMultiplier(1.0);
                }, 5000);
                break;
        }
    }

    /**
     * Spawn reward gems when boss is defeated
     * @private
     */
    _spawnBossReward() {
        // Spawn multiple gems at boss location
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI * 2 / 10) * i;
            const distance = 30 + Math.random() * 20;
            const x = this.boss.x + Math.cos(angle) * distance;
            const y = this.boss.y + Math.sin(angle) * distance;
            this.powerGems.push(new PowerGem(x, y));
        }
    }

    /**
     * Check block collisions for a ball
     * @private
     */
    _checkBlockCollisions(ball) {
        const hits = this.collision.findCollidingBlocks(ball, this.state.blocks);

        for (const { block, normal } of hits) {
            // Reflect ball (skip if Ghost)
            if (!ball.isGhost) {
                ball.reflect(normal.x, normal.y);
            }

            // Damage block
            block.durability--;
            this.state.addScore(10); // Hit score

            if (block.durability <= 0) {
                block.alive = false;
                this.state.addScore(50); // Destroy score
                this.state.incrementCombo();

                // Track destroyed block for boss regeneration
                this.destroyedBlocks.push({
                    row: block.row,
                    col: block.col,
                    originalColor: block.color
                });

                // Gem drop check
                if (block.gemDrop === 'guaranteed' || block.gemDrop === 'infinite') {
                    this._spawnGem(block);
                } else if (Math.random() < 0.15) { // 15% chance
                    this._spawnGem(block);
                }
            }

            this._updateUI();
            break; // Only process first collision per frame
        }
    }

    /**
     * Check collision with collision lines and apply Block Guide
     * @private
     * @param {Ball} ball - The ball to check
     * @param {number} ballIndex - Index in balls array (0 = primary ball)
     */
    _checkLineCollision(ball, ballIndex) {
        const lines = this.state.stageData?.lines;
        if (!lines || lines.length === 0) return;

        const lineHit = this.collision.checkLineCollision(ball, lines);
        if (!lineHit.hit) return;

        // Reflect ball off the line
        ball.reflect(lineHit.normal.x, lineHit.normal.y);

        // Push ball away from line to prevent multiple collisions
        ball.x += lineHit.normal.x * 2;
        ball.y += lineHit.normal.y * 2;

        // Apply Block Guide (primary ball only)
        if (ballIndex === 0) {
            const config = this._resolveBlockGuideConfig(lineHit.line);
            if (config?.enabled) {
                const reflectionAngle = Math.atan2(ball.dy, ball.dx);
                this.collision.applyBlockGuide(
                    ball,
                    reflectionAngle,
                    this.state.blocks,
                    config
                );
            }
        }
    }

    /**
     * Resolve Block Guide configuration from line and stage settings
     * @private
     * @param {Object} line - The collision line
     * @returns {{enabled: boolean, probability: number, angleLimit: number}|null}
     */
    _resolveBlockGuideConfig(line) {
        const stageMeta = this.state.stageData?.meta?.blockGuide;
        const lineConfig = line?.blockGuide;

        // Check if block guide is enabled at any level
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
     * Spawn a power gem at block location
     * @private
     */
    _spawnGem(block) {
        const center = hexToPixel(block.row, block.col, this.gridSize);
        this.powerGems.push(new PowerGem(center.x, center.y));
    }

    /**
     * Handle losing a life
     * @private
     */
    _loseLife() {
        const gameOver = this.state.loseLife();

        // Reset active weapons on life loss? (Design choice: keep or lose?)
        // For now, keep passive perks, lose active states if any

        if (gameOver) {
            this.state.state = STATES.GAMEOVER;
            if (this.onGameOver) {
                this.onGameOver(this.state.score);
            }
        } else {
            // Respawn ball
            this._createBall();
        }

        this._updateUI();
    }

    /**
     * Purchase and activate weapon
     * @private
     */
    _purchaseWeapon(weaponId) {
        if (!weaponId || this.state.state !== STATES.PLAYING) return;

        const cost = WEAPON_COSTS[weaponId];
        if (!cost) return;

        // Check affordability
        if (this.state.gems >= cost) {
            // Consume gems
            this.state.gems -= cost;

            // Activate weapon effect
            this._activateWeapon(weaponId);

            // Update UI
            this._updateUI();
        }
    }

    /**
     * Activate weapon effect
     * @private
     */
    _activateWeapon(weaponId) {
        console.log(`Activated weapon: ${weaponId}`);

        switch (weaponId) {
            case 'slow':
                // Slow down balls (0.6x speed for 15s)
                this.balls.forEach(ball => ball.setSpeedMultiplier(0.6));
                setTimeout(() => {
                    this.balls.forEach(ball => ball.setSpeedMultiplier(1.0));
                }, 15000);
                break;

            case 'wide':
                // Expand paddle (1.5x width for 20s)
                this.paddle.setWidthMultiplier(1.5);
                setTimeout(() => {
                    this.paddle.setWidthMultiplier(1.0);
                }, 20000);
                break;

            case 'double':
                // Duplicate balls
                const newBalls = [];
                this.balls.forEach(ball => {
                    if (!ball.active) return;

                    const newBall = new Ball(ball.x, ball.y);
                    newBall.dx = -ball.dx; // Reverse horizontal
                    newBall.dy = ball.dy;
                    newBall.speed = ball.speed;
                    newBall.active = true;
                    newBall.attached = false;
                    newBalls.push(newBall);
                });
                this.balls.push(...newBalls);
                break;

            case 'laser':
                this.activeWeapon = 'laser';
                this.laserStock += 5; // Add 5 shots
                break;

            case 'shield':
                if (this.shield) this.shield.activate();
                break;

            case 'magnet':
                this.activeWeapon = 'magnet';
                this.laserStock = 0; // Clear other active weapons
                setTimeout(() => { if (this.activeWeapon === 'magnet') this.activeWeapon = null; }, 20000);
                break;

            case 'ghost':
                this.activeWeapon = 'ghost';
                this.laserStock = 0;
                setTimeout(() => { if (this.activeWeapon === 'ghost') this.activeWeapon = null; }, 15000);
                break;
        }
    }

    /**
     * Handle stage clear
     * @private
     */
    _stageClear() {
        this.state.state = STATES.CLEAR;
        if (this.onStageClear) {
            this.onStageClear(this.state.score);
        }
    }

    /**
     * Update UI elements
     * @private
     */
    _updateUI() {
        if (this.onScoreUpdate) this.onScoreUpdate(this.state.score);
        if (this.onLivesUpdate) this.onLivesUpdate(this.state.lives);
        if (this.onGemsUpdate) this.onGemsUpdate(this.state.gems);
        if (this.onComboUpdate) this.onComboUpdate(this.state.combo);

        // Update weapon availability
        if (this.onWeaponUpdate) {
            const availability = {};
            for (const [id, cost] of Object.entries(WEAPON_COSTS)) {
                availability[id] = this.state.gems >= cost;
            }
            this.onWeaponUpdate(availability);
        }
    }

    /**
     * Render game
     * @private
     */
    _render() {
        const ctx = this.ctx;

        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Draw background images
        for (const bg of this.backgroundImages) {
            if (bg.image && bg.image.complete) {
                ctx.drawImage(bg.image, bg.x, bg.y, bg.width, bg.height);
            }
        }

        // Draw lines (collision, paddle, missline, decoration)
        this._renderLines();

        // Draw blocks
        this._renderBlocks();

        // Draw paddle
        this.paddle.render(ctx);

        // Draw shield
        if (this.shield) this.shield.render(ctx, this.canvasWidth);

        // Draw power gems
        for (const gem of this.powerGems) {
            gem.render(ctx);
        }

        // Draw lasers
        this._renderLasers();

        // Draw balls
        for (const ball of this.balls) {
            ball.render(ctx);
        }

        // Draw boss
        if (this.boss) {
            this.boss.render(ctx);
        }

        // Draw game state overlays
        if (this.state.state === STATES.GAMEOVER) {
            this._renderOverlay('GAME OVER', '#F44336');
        } else if (this.state.state === STATES.CLEAR) {
            this._renderOverlay('STAGE CLEAR!', '#4CAF50');
        }
    }

    /**
     * Render lines (collision, paddle, missline, decoration)
     * Uses shared Renderer module for consistent visuals
     * @private
     */
    _renderLines() {
        const lines = this.state.stageData?.lines;
        if (!lines || lines.length === 0) return;

        // Draw all lines using shared renderer
        // In game mode, labels are optional (default: false for cleaner visuals)
        drawLines(this.ctx, lines, {
            showLabels: false
        });
    }

    /**
     * Render hex blocks
     * Uses shared Renderer module for consistent visuals
     * @private
     */
    _renderBlocks() {
        // Debug: Log once on first render
        if (!this._debugBlocksLogged && this.state.blocks.length > 0) {
            console.log('[Debug] Blocks rendering:', {
                blockCount: this.state.blocks.length,
                firstBlock: this.state.blocks[0],
                gridSize: this.gridSize,
                sampleCenter: hexToPixel(this.state.blocks[0].row, this.state.blocks[0].col, this.gridSize)
            });
            this._debugBlocksLogged = true;
        }

        for (const block of this.state.blocks) {
            if (!block.alive) continue;

            const center = hexToPixel(block.row, block.col, this.gridSize);

            // Use shared renderer for block drawing
            drawHexBlock(this.ctx, center.x, center.y, this.gridSize.radius, block.color || '#64B5F6', {
                durability: block.durability,
                gemDrop: block.gemDrop,
                blockType: block.blockType
            });
        }
    }

    /**
     * Render state overlay
     * @private
     */
    _renderOverlay(text, color) {
        const ctx = this.ctx;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Text
        ctx.fillStyle = color;
        ctx.font = 'bold 64px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, this.canvasWidth / 2, this.canvasHeight / 2 - 50);

        // Score
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '32px sans-serif';
        ctx.fillText(`Score: ${this.state.score.toLocaleString()}`, this.canvasWidth / 2, this.canvasHeight / 2 + 20);

        // Instructions
        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#888888';
        ctx.fillText('Click to continue', this.canvasWidth / 2, this.canvasHeight / 2 + 80);
    }

    /**
     * Update lasers logic
     * @private
     */
    _updateLasers(dt) {
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];
            laser.update();

            if (!laser.active) {
                this.lasers.splice(i, 1);
                continue;
            }

            this._checkLaserCollisions(laser);
        }
    }

    /**
     * Check collisions for laser
     * @private
     */
    _checkLaserCollisions(laser) {
        // Simplified centered collision check
        const laserCenter = { x: laser.x, y: laser.y };

        for (const block of this.state.blocks) {
            if (!block.alive) continue;

            const blockCenter = hexToPixel(block.row, block.col, this.gridSize);
            const dx = laserCenter.x - blockCenter.x;
            const dy = laserCenter.y - blockCenter.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Check if within block radius roughly
            if (dist < this.gridSize.radius) {
                // Destroy block
                block.durability--;
                this.state.addScore(10);

                if (block.durability <= 0) {
                    block.alive = false;
                    this.state.addScore(50);
                    this.state.incrementCombo();

                    if (block.gemDrop === 'guaranteed' || (block.gemDrop !== 'infinite' && Math.random() < 0.15)) {
                        this._spawnGem(block);
                    }
                }

                this._updateUI();
                // Laser penetrates, so don't break loop or destroy laser
            }
        }
    }

    /**
     * Fire a laser
     * @private
     */
    _fireLaser() {
        // Fire from paddle center
        const x = this.paddle.x;
        const y = this.paddle.y - 10;
        this.lasers.push(new Laser(x, y));

        this.laserStock--;
        if (this.laserStock <= 0) {
            this.activeWeapon = null;
        }
        this._updateUI();
    }

    /**
     * Render lasers
     * @private
     */
    _renderLasers() {
        const ctx = this.ctx;
        for (const laser of this.lasers) {
            laser.render(ctx);
        }
    }

    /**
     * Restart game
     */
    restart() {
        if (this.state.stageData) {
            this.loadStage(this.state.stageData);
        } else {
            this.loadTestStage();
        }
    }

    /**
     * Stop game
     */
    stop() {
        this.running = false;
    }
}
