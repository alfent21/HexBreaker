/**
 * Game.js - Main Game Class
 * Based on game_specification.md
 *
 * Coordinates all game systems for a playable block breaker experience.
 * Refactored to delegate to specialized systems.
 */

import { GameState, STATES } from './GameState.js';
import { InputManager } from './InputManager.js';
import { CollisionSystem } from './physics/CollisionSystem.js';
import { GRID_SIZES } from '../shared/HexMath.js';

// Import systems
import { GameMessageSystem } from './ui/GameMessageSystem.js';
import { GemSystem } from './systems/GemSystem.js';
import { LaserSystem } from './systems/LaserSystem.js';
import { WeaponSystem, WEAPON_COSTS } from './systems/WeaponSystem.js';
import { BossSystem } from './systems/BossSystem.js';
import { GameRenderSystem } from './systems/GameRenderSystem.js';
import { BallSystem } from './systems/BallSystem.js';
import { StageLoader } from './systems/StageLoader.js';
import { TapSystem } from './systems/TapSystem.js';
import { PathMoveSystem } from './systems/PathMoveSystem.js';

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

        // Initialize sub-systems
        this.messageSystem = new GameMessageSystem();
        this.gemSystem = new GemSystem(this.gridSize);
        this.laserSystem = new LaserSystem();
        this.weaponSystem = new WeaponSystem(this.messageSystem, this.laserSystem);
        this.bossSystem = new BossSystem(this.gemSystem);
        this.renderSystem = new GameRenderSystem(this.ctx, this.canvasWidth, this.canvasHeight);
        this.ballSystem = new BallSystem(this.collision);
        this.stageLoader = new StageLoader();
        this.tapSystem = new TapSystem();
        this.pathMoveSystem = new PathMoveSystem();

        // Connect render system message callback
        this.renderSystem.showMessage = (text, type, duration) => {
            this.messageSystem.showMessage(text, type, duration);
        };

        // Entities (managed externally or by systems)
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
        this.input.onTap = (x, y) => this._handleTap(x, y);

        // Window resize handler
        window.addEventListener('resize', () => this._handleResize());
    }

    /**
     * Handle window resize
     * @private
     */
    _handleResize() {
        if (this.canvasWidth && this.canvasHeight) {
            this.stageLoader._setupCanvas(this.canvas, this.canvasWidth, this.canvasHeight);
        }
    }

    /**
     * Load and start a stage
     * @param {Object} stageData - Stage data from editor
     */
    loadStage(stageData) {
        const result = this.stageLoader.loadStage(stageData, {
            canvas: this.canvas,
            collision: this.collision,
            gemSystem: this.gemSystem,
            renderSystem: this.renderSystem,
            bossSystem: this.bossSystem,
            state: this.state,
            weaponSystem: this.weaponSystem,
            laserSystem: this.laserSystem,
            showMessage: (text, type) => this.showMessage(text, type)
        });

        this.canvasWidth = result.canvasWidth;
        this.canvasHeight = result.canvasHeight;
        this.gridSize = result.gridSize;
        this.paddle = result.paddle;
        this.shield = result.shield;

        // Deep copy lines for runtime mutation by PathMoveSystem
        if (this.state.stageData.lines) {
            this.state.stageData.lines = JSON.parse(JSON.stringify(this.state.stageData.lines));
        }

        // Initialize tap system and path movement
        this.tapSystem.loadFromStage(this.state.stageData);
        this.pathMoveSystem.loadFromStage(this.state.stageData);

        // Clear and create initial ball
        this.ballSystem.clear();
        this.ballSystem.createBall(this.paddle);

        // Start game
        this.running = true;
        this.lastTime = performance.now();

        requestAnimationFrame(() => {
            this.stageLoader._setupCanvas(this.canvas, this.canvasWidth, this.canvasHeight);
            requestAnimationFrame(this._gameLoop);
        });

        this._updateUI();
    }

    /**
     * Create a test stage for demonstration
     */
    loadTestStage() {
        this.loadStage(this.stageLoader.generateTestStageData());
    }

    /**
     * Launch ball from paddle
     * @private
     */
    _launchBall() {
        this.ballSystem.launchBalls(this.messageSystem);
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

        // Update path movement (before paddle, so lines are at new positions)
        const pathDelta = this.pathMoveSystem.update(dt);

        // Apply conveyor-belt effect to paddle
        if (this.paddle.visible && (pathDelta.x !== 0 || pathDelta.y !== 0)) {
            this.paddle.x += pathDelta.x;
            this.paddle.y += pathDelta.y;
            this.paddle.minX += pathDelta.x;
            this.paddle.maxX += pathDelta.x;
        }

        // Update weapon system (handles laser/magnet/ghost input)
        this.weaponSystem.update(dt, this.input, this.ballSystem.balls, this.paddle);

        // Update laser system
        this.laserSystem.update(dt, this.state.blocks, this.gridSize, (block, laser) => {
            this._onBlockHitByLaser(block);
        });

        // Update paddle
        this.paddle.update(this.input, this.canvasWidth);

        // Update balls
        this.ballSystem.update(dt, speedMultiplier, {
            paddle: this.paddle,
            shield: this.shield,
            weaponSystem: this.weaponSystem,
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            input: this.input,
            stageData: this.state.stageData,
            blocks: this.state.blocks,
            state: this.state,
            bossSystem: this.bossSystem,
            gemSystem: this.gemSystem
        }, {
            onMiss: () => this._loseLife(),
            onUIUpdate: () => this._updateUI()
        });

        // Update gems
        this.gemSystem.update(dt, this.paddle, this.canvasHeight, (gem) => {
            this.state.addGems(1);
            this.state.addScore(100);
            this._updateUI();
        });

        // Update tap effects (pass balls to reset wasHitInTapArea flags and continue hit detection)
        if (this.tapSystem.active) {
            this.tapSystem.update(dt, this.ballSystem.balls);
        }

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
     * Update boss entity
     * @private
     */
    _updateBoss(dt) {
        this.bossSystem.update(dt, {
            balls: this.ballSystem.balls,
            blocks: this.state.blocks,
            paddle: this.paddle,
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            onDebuffHit: (type) => this._applyDebuff(type)
        });

        // Ball collisions with boss
        const ballResult = this.bossSystem.checkBallCollisions(this.ballSystem.balls, this.state);
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
                this.ballSystem.balls.forEach(ball => ball.setSpeedMultiplier(0.5));
                setTimeout(() => {
                    this.ballSystem.balls.forEach(ball => ball.setSpeedMultiplier(1.0));
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
            this.ballSystem.createBall(this.paddle);
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
            balls: this.ballSystem.balls,
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
            balls: this.ballSystem.balls,
            paddle: this.paddle,
            shield: this.shield,
            gridSize: this.gridSize
        });

        // Render tap area
        this.tapSystem.render(this.ctx);

        // Render gems
        this.gemSystem.render(this.ctx);

        // Render lasers
        this.laserSystem.render(this.ctx);

        // Render boss
        this.bossSystem.render(this.ctx);
    }

    /**
     * Handle tap mode click
     * Priority: Ball hit > Gem collection
     * @private
     */
    _handleTap(x, y) {
        if (!this.tapSystem.active) return;
        if (this.state.state !== STATES.PLAYING) return;

        // Hit ball and collect gem simultaneously
        this.tapSystem.handleTap(x, y, this.ballSystem.balls);

        // Collect gem in same hitRadius
        this.gemSystem.collectByTap(x, y, this.tapSystem.hitRadius, (gem) => {
            this.state.addGems(1);
            // Spawn +1 popup at gem position
            this.tapSystem.spawnTextEffect(gem.x, gem.y, '+1');
        });
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
