/**
 * StageLoader.js - Stage Loading System
 *
 * Handles stage data loading, canvas setup, and initial game configuration.
 * Extracted from Game.js for single responsibility.
 */

import { GRID_SIZES } from '../../shared/HexMath.js';
import { Paddle } from '../entities/Paddle.js';
import { Shield } from '../entities/Shield.js';

export class StageLoader {
    constructor() {
        /** @type {number} - Current display scale */
        this.displayScale = 1;
    }

    /**
     * Load and configure a stage
     * @param {Object} stageData - Stage data from editor
     * @param {Object} context - Game context
     * @param {HTMLCanvasElement} context.canvas
     * @param {Object} context.collision - CollisionSystem
     * @param {Object} context.gemSystem - GemSystem
     * @param {Object} context.renderSystem - GameRenderSystem
     * @param {Object} context.bossSystem - BossSystem
     * @param {Object} context.state - GameState
     * @param {Object} context.weaponSystem - WeaponSystem
     * @param {Object} context.laserSystem - LaserSystem
     * @param {Function} context.showMessage - Message callback
     * @returns {Object} - { canvasWidth, canvasHeight, gridSize, paddle, shield }
     */
    loadStage(stageData, context) {
        const {
            canvas,
            collision,
            gemSystem,
            renderSystem,
            bossSystem,
            state,
            weaponSystem,
            laserSystem,
            showMessage
        } = context;

        // Set canvas size
        let canvasWidth = canvas.width;
        let canvasHeight = canvas.height;

        if (stageData.canvas) {
            canvasWidth = stageData.canvas.width;
            canvasHeight = stageData.canvas.height;
        }

        this._setupCanvas(canvas, canvasWidth, canvasHeight);

        // Set grid size
        let gridSize = GRID_SIZES.medium;

        if (stageData.gridSize) {
            if (typeof stageData.gridSize === 'string') {
                gridSize = GRID_SIZES[stageData.gridSize] || GRID_SIZES.medium;
                collision.setGridSize(stageData.gridSize);
            } else {
                gridSize = stageData.gridSize;
                const gridName = this._getGridSizeName(stageData.gridSize.radius);
                collision.setGridSize(gridName);
            }
        }

        // Update systems with new grid size
        gemSystem.setGridSize(gridSize);
        renderSystem.setCanvasSize(canvasWidth, canvasHeight);

        // Apply block render settings
        if (stageData.blockRenderSettings) {
            renderSystem.applyBlockRenderSettings(stageData.blockRenderSettings);
            const fillOpacity = Math.round((stageData.blockRenderSettings.fill?.opacity || 1) * 100);
            const borderWidth = Math.round((stageData.blockRenderSettings.border?.widthRatio || 0) * 100);
            const embossWidth = Math.round((stageData.blockRenderSettings.emboss?.lineWidthRatio || 0) * 100);
            showMessage(`描画設定: 塗り${fillOpacity}% 境界線${borderWidth}% エンボス${embossWidth}%`, 'info');
        } else {
            showMessage('描画設定: デフォルト使用', 'warning');
        }

        // Load backgrounds
        renderSystem.loadBackgrounds(stageData);

        // Load state
        state.loadStage(stageData);
        state.reset();

        // Reset all systems
        gemSystem.clear();
        laserSystem.clear();
        weaponSystem.reset();
        bossSystem.reset();

        // Load boss if configured
        if (stageData.boss) {
            bossSystem.loadBoss(stageData.boss, stageData.gridSize || 'medium');
        }

        // Create paddle and shield
        const paddle = new Paddle(canvasWidth / 2, canvasHeight - 50);
        paddle.setBounds(0, canvasWidth);
        const shield = new Shield(canvasHeight - 15);

        return {
            canvasWidth,
            canvasHeight,
            gridSize,
            paddle,
            shield,
            displayScale: this.displayScale
        };
    }

    /**
     * Generate test stage data (without loading)
     * @returns {Object} - Stage data for test stage
     */
    generateTestStageData() {
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

        return {
            canvas: { width: 1280, height: 720 },
            gridSize: 'medium',
            blocks
        };
    }

    /**
     * Setup canvas size to fit screen
     * @param {HTMLCanvasElement} canvas
     * @param {number} width
     * @param {number} height
     * @private
     */
    _setupCanvas(canvas, width, height) {
        canvas.width = width;
        canvas.height = height;

        const wrapper = canvas.parentElement;
        let availableWidth, availableHeight;

        if (wrapper && wrapper.offsetWidth > 0) {
            availableWidth = wrapper.clientWidth;
            availableHeight = wrapper.clientHeight;
        } else {
            availableWidth = window.innerWidth;
            availableHeight = window.innerHeight - 150;
        }

        const scaleX = availableWidth / canvas.width;
        const scaleY = availableHeight / canvas.height;
        const scale = Math.min(scaleX, scaleY, 1);

        canvas.style.width = (canvas.width * scale) + 'px';
        canvas.style.height = (canvas.height * scale) + 'px';
        this.displayScale = scale;
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
     * Get random block color for test stage
     * @returns {string}
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
}
