/**
 * GameState.js - Game State Management
 * Based on game_specification.md Section 2.2
 */

export const STATES = {
    TITLE: 'title',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAMEOVER: 'gameover',
    CLEAR: 'clear'
};

export class GameState {
    constructor() {
        this.state = STATES.TITLE;
        this.score = 0;
        this.lives = 3;
        this.gems = 0;
        this.combo = 0;
        this.comboTimer = null;
        this.activeWeapons = {};

        // Stage data
        this.stageData = null;
        this.blocks = [];
        this.initialBlockCount = 0;
    }

    /**
     * Reset game state for new game
     */
    reset() {
        this.state = STATES.PLAYING;
        this.score = 0;
        this.lives = this.stageData?.meta?.initialLives || 3;
        this.gems = 0;
        this.combo = 0;
        this.activeWeapons = {};
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
            this.comboTimer = null;
        }
    }

    /**
     * Load stage data
     * @param {Object} data - Stage data from editor
     */
    loadStage(data) {
        this.stageData = data;
        this.blocks = [];

        // Extract blocks from stage data
        if (data.blocks) {
            this.blocks = data.blocks.map(block => ({
                row: block.row,
                col: block.col,
                durability: block.durability || 1,
                maxDurability: block.durability || 1,
                color: block.color || '#64B5F6',
                gemDrop: block.gemDrop || null,
                blockType: block.blockType || null,
                alive: true
            }));
        }

        this.initialBlockCount = this.blocks.filter(b =>
            b.blockType !== 'infinite' && b.gemDrop !== 'infinite'
        ).length;
    }

    /**
     * Add score
     * @param {number} points
     */
    addScore(points) {
        const multiplier = Math.max(1, this.combo);
        this.score += points * multiplier;
    }

    /**
     * Increment combo
     */
    incrementCombo() {
        this.combo++;

        // Reset combo timer
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
        }

        this.comboTimer = setTimeout(() => {
            this.combo = 0;
        }, 2000); // COMBO_TIMEOUT
    }

    /**
     * Add gems
     * @param {number} count
     */
    addGems(count) {
        this.gems += count;
    }

    /**
     * Lose a life
     * @returns {boolean} True if game over
     */
    loseLife() {
        this.lives--;
        this.combo = 0;
        return this.lives <= 0;
    }

    /**
     * Check if stage is cleared
     * @returns {boolean}
     */
    isCleared() {
        const aliveDestructible = this.blocks.filter(b =>
            b.alive &&
            b.blockType !== 'infinite' &&
            b.gemDrop !== 'infinite'
        );
        return aliveDestructible.length === 0;
    }

    /**
     * Get remaining destructible blocks
     * @returns {number}
     */
    getRemainingBlocks() {
        return this.blocks.filter(b =>
            b.alive &&
            b.blockType !== 'infinite' &&
            b.gemDrop !== 'infinite'
        ).length;
    }
}
