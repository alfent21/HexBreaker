/**
 * Game.js - Main Game Class
 * Based on game_specification.md
 *
 * Coordinates all game systems for a playable block breaker experience.
 * Refactored to delegate to specialized systems.
 */

import { GameState, STATES } from './GameState.js';
import { InputManager } from './InputManager.js';
import { Ball } from './entities/Ball.js';
import { Paddle } from './entities/Paddle.js';
import { Shield } from './entities/Shield.js';
import { CollisionSystem } from './physics/CollisionSystem.js';
import { GRID_SIZES } from '../shared/HexMath.js';

// Import systems
import { GameMessageSystem } from './ui/GameMessageSystem.js';
import { GemSystem } from './systems/GemSystem.js';
import { LaserSystem } from './systems/LaserSystem.js';
import { WeaponSystem, WEAPON_COSTS } from './systems/WeaponSystem.js';
import { BossSystem } from './systems/BossSystem.js';
import { GameRenderSystem } from './systems/GameRenderSystem.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Core systems
        this.state = new GameState();
        this.input = new InputManager(canvas);
        this.collision = new CollisionSystem();

        // Stage settings
        this.canvasWidth = canvas.width;
        this.canvasHeight = canvas.height;
        this.gridSize = GRID_SIZES.medium;
        this.displayScale = 1;

        // Initialize sub-systems
        this.messageSystem = new GameMessageSystem();
        this.gemSystem = new GemSystem(this.gridSize);
        this.laserSystem = new LaserSystem();
        this.weaponSystem = new WeaponSystem(this.messageSystem, this.laserSystem);
        this.bossSystem = new BossSystem(this.gemSystem);
        this.renderSystem = new GameRenderSystem(this.ctx, this.canvasWidth, this.canvasHeight);

        // Connect render system message callback
        this.renderSystem.showMessage = (text, type, duration) => {
            this.messageSystem.showMessage(text, type, duration);
        };

        // Entities
        this.balls = [];
        this.paddle = null;
        this.shield = null;

        // Game loop
        this.lastTime = 0;
        this.running = false;

        // UI callbacks
        this.onScoreUpdate = null;
        this.onLivesUpdate = null;
        this.onGemsUpdate = null;
        this.onComboUpdate = null;
        this.onWeaponUpdate = null;
        this.onGameOver = null;
        this.onStageClear = null;

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
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;

        const wrapper = this.canvas.parentElement;
        let availableWidth, availableHeight;

        if (wrapper && wrapper.offsetWidth > 0) {
            availableWidth = wrapper.clientWidth;
            availableHeight = wrapper.clientHeight;
        } else {
            availableWidth = window.innerWidth;
            availableHeight = window.innerHeight - 150;
        }

        const scaleX = availableWidth / this.canvas.width;
        const scaleY = availableHeight / this.canvas.height;
        const scale = Math.min(scaleX, scaleY, 1);

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
        this._setupCanvas();

        // Set grid size
        if (stageData.gridSize) {
            if (typeof stageData.gridSize === 'string') {
                this.gridSize = GRID_SIZES[stageData.gridSize] || GRID_SIZES.medium;
                this.collision.setGridSize(stageData.gridSize);
            } else {
                this.gridSize = stageData.gridSize;
                const gridName = this._getGridSizeName(stageData.gridSize.radius);
                this.collision.setGridSize(gridName);
            }
        }

        // Update systems with new grid size
        this.gemSystem.setGridSize(this.gridSize);
        this.renderSystem.setCanvasSize(this.canvasWidth, this.canvasHeight);

        // Apply block render settings
        if (stageData.blockRenderSettings) {
            this.renderSystem.applyBlockRenderSettings(stageData.blockRenderSettings);
            const fillOpacity = Math.round((stageData.blockRenderSettings.fill?.opacity || 1) * 100);
            const borderWidth = Math.round((stageData.blockRenderSettings.border?.widthRatio || 0) * 100);
            const embossWidth = Math.round((stageData.blockRenderSettings.emboss?.lineWidthRatio || 0) * 100);
            this.showMessage(`描画設定: 塗り${fillOpacity}% 境界線${borderWidth}% エンボス${embossWidth}%`, 'info');
        } else {
            this.showMessage('描画設定: デフォルト使用', 'warning');
        }

        // Load backgrounds
        this.renderSystem.loadBackgrounds(stageData);

        // Load state
        this.state.loadStage(stageData);
        this.state.reset();

        // Reset all systems
        this.balls = [];
        this.gemSystem.clear();
        this.laserSystem.clear();
        this.weaponSystem.reset();
        this.bossSystem.reset();

        // Load boss if configured
        if (stageData.boss) {
            this.bossSystem.loadBoss(stageData.boss, stageData.gridSize || 'medium');
        }

        // Create paddle and shield
        this.paddle = new Paddle(this.canvasWidth / 2, this.canvasHeight - 50);
        this.paddle.setBounds(0, this.canvasWidth);
        this.shield = new Shield(this.canvasHeight - 15);

        // Create initial ball
        this._createBall();

        // Start game
        this.running = true;
        this.lastTime = performance.now();

        requestAnimationFrame(() => {
            this._setupCanvas();
            requestAnimationFrame(this._gameLoop);
        });

        this._updateUI();
    }

    /**
     * Create a test stage for demonstration
     */
    loadTestStage() {
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
     * @private
     */
    _getGridSizeName(radius) {
        if (radius <= 15) return 'small';
        if (radius <= 40) return 'medium';
        return 'large';
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
        let launched = false;
        for (const ball of this.balls) {
            if (ball.attached) {
                const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
                ball.launch(angle);
                launched = true;
            }
        }
        if (launched) {
            this.messageSystem.hideMessages();
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

        // Update weapon system (handles laser/magnet/ghost input)
        this.weaponSystem.update(dt, this.input, this.balls, this.paddle);

        // Update laser system
        this.laserSystem.update(dt, this.state.blocks, this.gridSize, (block, laser) => {
            this._onBlockHitByLaser(block);
        });

        // Update paddle
        this.paddle.update(this.input, this.canvasWidth);

        // Update balls
        this._updateBalls(dt, speedMultiplier);

        // Update gems
        this.gemSystem.update(dt, this.paddle, this.canvasHeight, (gem) => {
            this.state.addGems(1);
            this.state.addScore(100);
            this._updateUI();
        });

        // Update boss
        if (this.bossSystem.isActive) {
            this._updateBoss(dt);
        }

        // Check clear condition
        if (this.state.isCleared() && !this.bossSystem.isActive) {
            this._stageClear();
        }
    }

    /**
     * Update all balls
     * @private
     */
    _updateBalls(dt, speedMultiplier) {
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

            // Magnet attraction
            if (this.weaponSystem.activeWeapon === 'magnet' && this.input.isMouseDown) {
                const dx = this.paddle.x - ball.x;
                const dy = (this.paddle.y - 20) - ball.y;
                ball.x += dx * 5 * dt;
                ball.y += dy * 5 * dt;
            }

            // Move ball
            ball.update(dt, speedMultiplier);

            // Wall collisions
            this.collision.checkWallCollision(ball, this.canvasWidth, this.canvasHeight);

            // Line collisions
            this._checkLineCollision(ball, i);

            // Paddle collision
            const paddleHit = this.paddle.checkCollision(ball);
            if (paddleHit.hit) {
                if (this.weaponSystem.handleMagnetCatch(ball, this.paddle)) {
                    // Ball was caught by magnet
                } else {
                    ball.reflectFromPaddle(paddleHit.offsetRatio);
                }
            }

            // Shield collision
            if (this.shield) {
                this.shield.checkCollision(ball);
            }

            // Block collisions
            this._checkBlockCollisions(ball);

            // Miss check
            if (this.collision.checkMiss(ball, this.canvasHeight)) {
                this.balls.splice(i, 1);
                if (this.balls.length === 0) {
                    this._loseLife();
                }
            }
        }
    }

    /**
     * Update boss entity
     * @private
     */
    _updateBoss(dt) {
        this.bossSystem.update(dt, {
            balls: this.balls,
            blocks: this.state.blocks,
            paddle: this.paddle,
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            onDebuffHit: (type) => this._applyDebuff(type)
        });

        // Ball collisions with boss
        const ballResult = this.bossSystem.checkBallCollisions(this.balls, this.state);
        if (ballResult.hit) {
            this._updateUI();
        }

        // Laser collisions with boss
        const laserResult = this.bossSystem.checkLaserCollisions(this.laserSystem.lasers, this.state);
        if (laserResult.hit) {
            this._updateUI();
        }
    }

    /**
     * Apply debuff effect from boss
     * @private
     */
    _applyDebuff(type) {
        switch (type) {
            case 'slow':
                this.balls.forEach(ball => ball.setSpeedMultiplier(0.5));
                setTimeout(() => {
                    this.balls.forEach(ball => ball.setSpeedMultiplier(1.0));
                }, 5000);
                break;
            case 'shrink':
                this.paddle.setWidthMultiplier(0.6);
                setTimeout(() => {
                    this.paddle.setWidthMultiplier(1.0);
                }, 5000);
                break;
        }
    }

    /**
     * Check block collisions for a ball
     * @private
     */
    _checkBlockCollisions(ball) {
        const hits = this.collision.findCollidingBlocks(ball, this.state.blocks);

        for (const { block, normal } of hits) {
            if (!ball.isGhost) {
                ball.reflect(normal.x, normal.y);
            }

            block.durability--;
            this.state.addScore(10);

            if (block.durability <= 0) {
                block.alive = false;
                this.state.addScore(50);
                this.state.incrementCombo();

                // Track for boss regeneration
                this.bossSystem.trackDestroyedBlock(block);

                // Gem drop
                if (this.gemSystem.shouldDropGem(block)) {
                    this.gemSystem.spawnFromBlock(block);
                }
            }

            this._updateUI();
            break;
        }
    }

    /**
     * Handle block hit by laser
     * @private
     */
    _onBlockHitByLaser(block) {
        block.durability--;
        this.state.addScore(10);

        if (block.durability <= 0) {
            block.alive = false;
            this.state.addScore(50);
            this.state.incrementCombo();

            if (this.gemSystem.shouldDropGem(block)) {
                this.gemSystem.spawnFromBlock(block);
            }
        }

        this._updateUI();
    }

    /**
     * Check collision with lines and apply Block Guide
     * @private
     */
    _checkLineCollision(ball, ballIndex) {
        const lines = this.state.stageData?.lines;
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
            const config = this._resolveBlockGuideConfig(lineHit.line);
            if (config?.enabled) {
                const reflectionAngle = Math.atan2(ball.dy, ball.dx);
                this.collision.applyBlockGuide(ball, reflectionAngle, this.state.blocks, config);
            }
        }
    }

    /**
     * Resolve Block Guide configuration
     * @private
     */
    _resolveBlockGuideConfig(line) {
        const stageMeta = this.state.stageData?.meta?.blockGuide;
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
     * Handle losing a life
     * @private
     */
    _loseLife() {
        const gameOver = this.state.loseLife();

        if (gameOver) {
            this.state.state = STATES.GAMEOVER;
            if (this.onGameOver) {
                this.onGameOver(this.state.score);
            }
        } else {
            this._createBall();
        }

        this._updateUI();
    }

    /**
     * Purchase weapon
     * @private
     */
    _purchaseWeapon(weaponId) {
        if (!weaponId || this.state.state !== STATES.PLAYING) return;

        const success = this.weaponSystem.purchase(weaponId, {
            state: this.state,
            balls: this.balls,
            paddle: this.paddle,
            shield: this.shield
        });

        if (success) {
            this._updateUI();
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

        if (this.onWeaponUpdate) {
            this.onWeaponUpdate(this.weaponSystem.getAvailability(this.state.gems));
        }
    }

    /**
     * Render game
     * @private
     */
    _render() {
        // Main render
        this.renderSystem.render({
            state: this.state,
            balls: this.balls,
            paddle: this.paddle,
            shield: this.shield,
            gridSize: this.gridSize
        });

        // Render gems
        this.gemSystem.render(this.ctx);

        // Render lasers
        this.laserSystem.render(this.ctx);

        // Render boss
        this.bossSystem.render(this.ctx);
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
     * Pause game
     */
    pause() {
        if (this.state.state === STATES.PLAYING) {
            this.state.state = STATES.PAUSED;
        }
    }

    /**
     * Resume game
     */
    resume() {
        if (this.state.state === STATES.PAUSED) {
            this.state.state = STATES.PLAYING;
        }
    }

    /**
     * Stop game
     */
    stop() {
        this.running = false;
    }

    // =========================================================================
    // Message System Delegation
    // =========================================================================

    /**
     * Show a message (delegated to GameMessageSystem)
     */
    showMessage(text, type = 'info', duration = 3000) {
        this.messageSystem.showMessage(text, type, duration);
    }

    /**
     * Hide messages
     */
    hideMessages() {
        this.messageSystem.hideMessages();
    }

    /**
     * Get message log
     */
    getMessageLog() {
        return this.messageSystem.getMessageLog();
    }

    /**
     * Clear message log
     */
    clearMessageLog() {
        this.messageSystem.clearMessageLog();
    }
}
