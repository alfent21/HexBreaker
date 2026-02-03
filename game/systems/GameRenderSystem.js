/**
 * GameRenderSystem.js - Game Render System
 *
 * Handles all game rendering: backgrounds, lines, blocks, and overlays.
 * Uses shared Renderer module for consistent visuals with the editor.
 */

import { hexToPixel } from '../../shared/HexMath.js';
import { drawHexBlock, drawLines, RENDER_CONFIG } from '../../shared/Renderer.js';
import { STATES } from '../GameState.js';

export class GameRenderSystem {
    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     */
    constructor(ctx, canvasWidth, canvasHeight) {
        this.ctx = ctx;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        /** @type {Array} - Background image data */
        this.backgroundImages = [];

        /** @type {boolean} - Flag for first render debug message */
        this._blocksMessageShown = false;

        /** @type {Function|null} - Message callback for debug output */
        this.showMessage = null;
    }

    /**
     * Update canvas dimensions (when stage loads)
     * @param {number} width
     * @param {number} height
     */
    setCanvasSize(width, height) {
        this.canvasWidth = width;
        this.canvasHeight = height;
    }

    /**
     * Load background images from stage data
     * @param {Object} stageData
     */
    loadBackgrounds(stageData) {
        this.backgroundImages = [];
        this._blocksMessageShown = false;

        const backgrounds = stageData.backgrounds || [];
        const sorted = [...backgrounds].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        for (const bgData of sorted) {
            if (bgData.imageData) {
                const img = new Image();
                img.src = bgData.imageData;
                this.backgroundImages.push({
                    id: bgData.id || null,
                    image: img,
                    x: bgData.x || 0,
                    y: bgData.y || 0,
                    width: bgData.width || this.canvasWidth,
                    height: bgData.height || this.canvasHeight,
                    zIndex: bgData.zIndex || 0,
                    isBlockSource: bgData.isBlockSource || false
                });
            }
        }
    }

    /**
     * Apply block render settings from stage data
     * @param {Object} settings
     */
    applyBlockRenderSettings(settings) {
        if (!settings) return;

        if (settings.fill) {
            Object.assign(RENDER_CONFIG.block.fill, settings.fill);
        }
        if (settings.border) {
            Object.assign(RENDER_CONFIG.block.border, settings.border);
        }
        if (settings.emboss) {
            Object.assign(RENDER_CONFIG.block.emboss, settings.emboss);
        }
    }

    /**
     * Main render method
     * @param {Object} context - Render context
     * @param {Object} context.state - GameState
     * @param {Array} context.balls - Ball array
     * @param {Object} context.paddle - Paddle entity
     * @param {Object} context.shield - Shield entity
     * @param {Object} context.gridSize - Grid size
     */
    render(context) {
        const { state, balls, paddle, shield, gridSize } = context;
        const ctx = this.ctx;

        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Draw backgrounds (skip block source images)
        this._renderBackgrounds();

        // Draw lines
        this._renderLines(state.stageData);

        // Draw blocks
        this._renderBlocks(state.blocks, gridSize);

        // Draw paddle
        paddle.render(ctx);

        // Draw shield
        if (shield) {
            shield.render(ctx, this.canvasWidth);
        }

        // Draw balls
        for (const ball of balls) {
            ball.render(ctx);
        }

        // Draw state overlays
        if (state.state === STATES.GAMEOVER) {
            this._renderOverlay('GAME OVER', '#F44336', state.score);
        } else if (state.state === STATES.CLEAR) {
            this._renderOverlay('STAGE CLEAR!', '#4CAF50', state.score);
        }
    }

    /**
     * Render background images
     * @private
     */
    _renderBackgrounds() {
        for (const bg of this.backgroundImages) {
            if (bg.isBlockSource) continue; // Skip block source images
            if (bg.image && bg.image.complete) {
                this.ctx.drawImage(bg.image, bg.x, bg.y, bg.width, bg.height);
            }
        }
    }

    /**
     * Render lines (collision, paddle, missline, decoration)
     * @param {Object} stageData
     * @private
     */
    _renderLines(stageData) {
        const lines = stageData?.lines;
        if (!lines || lines.length === 0) return;

        drawLines(this.ctx, lines, { showLabels: false });
    }

    /**
     * Render hex blocks
     * @param {Array} blocks
     * @param {Object} gridSize
     * @private
     */
    _renderBlocks(blocks, gridSize) {
        // Debug message on first render
        if (!this._blocksMessageShown && blocks.length > 0 && this.showMessage) {
            this.showMessage(`✓ ${blocks.length} blocks loaded`, 'success');
            this._blocksMessageShown = true;

            // Additional debug info
            const blocksWithSource = blocks.filter(b => b.sourceLayerId != null);
            const bgIds = this.backgroundImages.map(bg => bg.id).join(',');
            const sampleSourceId = blocksWithSource.length > 0 ? blocksWithSource[0].sourceLayerId : 'none';
            const borderW = Math.round((RENDER_CONFIG.block.border.widthRatio || 0) * 100);
            const embossW = Math.round((RENDER_CONFIG.block.emboss.lineWidthRatio || 0) * 100);
            this.showMessage(
                `[DEBUG] blocks:${blocksWithSource.length}/${blocks.length}, bgIds:[${bgIds}], 境界線:${borderW}%, エンボス:${embossW}%`,
                'warning',
                8000
            );
        }

        for (const block of blocks) {
            if (!block.alive) continue;

            const center = hexToPixel(block.row, block.col, gridSize);

            // Find clip image from background by sourceLayerId
            let clipImage = null;
            if (block.sourceLayerId != null) {
                const bgEntry = this.backgroundImages.find(bg => bg.id === block.sourceLayerId);
                if (bgEntry && bgEntry.image) {
                    clipImage = bgEntry.image;
                }
            }

            drawHexBlock(this.ctx, center.x, center.y, gridSize.radius, block.color || '#64B5F6', {
                durability: block.durability,
                gemDrop: block.gemDrop,
                blockType: block.blockType,
                clipImage: clipImage
            });
        }
    }

    /**
     * Render state overlay (game over / stage clear)
     * @param {string} text - Main text
     * @param {string} color - Text color
     * @param {number} score - Current score
     * @private
     */
    _renderOverlay(text, color, score) {
        const ctx = this.ctx;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Main text
        ctx.fillStyle = color;
        ctx.font = 'bold 64px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, this.canvasWidth / 2, this.canvasHeight / 2 - 50);

        // Score
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '32px sans-serif';
        ctx.fillText(`Score: ${score.toLocaleString()}`, this.canvasWidth / 2, this.canvasHeight / 2 + 20);

        // Instructions
        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#888888';
        ctx.fillText('Click to continue', this.canvasWidth / 2, this.canvasHeight / 2 + 80);
    }

    /**
     * Get background image by ID (for block clipping)
     * @param {number|string} id
     * @returns {HTMLImageElement|null}
     */
    getBackgroundById(id) {
        const bg = this.backgroundImages.find(b => b.id === id);
        return bg?.image || null;
    }

    /**
     * Reset render system (for new stage)
     */
    reset() {
        this.backgroundImages = [];
        this._blocksMessageShown = false;
    }
}
