/**
 * GameMessageSystem.js - Game Message System
 *
 * Handles message display, stacking, and logging for the game.
 * Messages are shown in the header area during gameplay.
 */

export class GameMessageSystem {
    constructor() {
        /** @type {Array<{text: string, type: string, time: number}>} */
        this._messageLog = [];

        // DOM element IDs
        this._hudId = 'header-hud';
        this._containerId = 'header-message-container';
        this._stackId = 'header-message-stack';
        this._copyAllBtnId = 'header-message-copy-all';

        // Max visible messages
        this._maxVisible = 5;
    }

    /**
     * Show a message in the header area (stack display)
     * @param {string} text - Message text
     * @param {string} type - Message type ('info', 'success', 'warning', 'error')
     * @param {number} duration - Display duration in ms (default: 3000, currently unused - messages stay until game starts)
     */
    showMessage(text, type = 'info', duration = 3000) {
        const now = Date.now();

        // Add to log
        this._messageLog.push({ text, type, time: now });

        // Get DOM elements
        const hud = document.getElementById(this._hudId);
        const container = document.getElementById(this._containerId);
        const stack = document.getElementById(this._stackId);
        const copyAllBtn = document.getElementById(this._copyAllBtnId);

        if (!hud || !container || !stack) {
            // DOM elements not found - this is an error in game page setup
            throw new Error('[GameMessageSystem] Required DOM elements not found. Check game_index.html.');
        }

        // Hide HUD, show message container
        hud.classList.add('hidden');
        container.classList.add('visible');

        // Create message item
        const timeStr = new Date(now).toLocaleTimeString('ja-JP', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        const item = document.createElement('div');
        item.className = `header-message-item header-message-item--${type}`;
        item.innerHTML = `
            <span class="msg-time">${timeStr}</span>
            <span class="msg-text">${text}</span>
            <button class="msg-copy" title="コピー">📋</button>
        `;

        // Single message copy button
        const copyBtn = item.querySelector('.msg-copy');
        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.textContent = '✓';
                    setTimeout(() => { copyBtn.textContent = '📋'; }, 1000);
                });
            };
        }

        stack.appendChild(item);
        stack.scrollTop = stack.scrollHeight;

        // Limit visible messages
        while (stack.children.length > this._maxVisible) {
            stack.removeChild(stack.firstChild);
        }

        // Setup copy all button (once)
        if (copyAllBtn && !copyAllBtn._bound) {
            copyAllBtn._bound = true;
            copyAllBtn.onclick = () => this._copyAllMessages(copyAllBtn);
        }
    }

    /**
     * Copy all messages to clipboard
     * @param {HTMLElement} button - The copy all button element
     * @private
     */
    _copyAllMessages(button) {
        const allText = this._messageLog
            .map(m => {
                const t = new Date(m.time).toLocaleTimeString('ja-JP', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
                return `[${t}] [${m.type.toUpperCase()}] ${m.text}`;
            })
            .join('\n');

        navigator.clipboard.writeText(allText).then(() => {
            button.textContent = '✓全部';
            setTimeout(() => { button.textContent = '📋全部'; }, 1000);
        });
    }

    /**
     * Hide messages and restore HUD (called when game starts)
     */
    hideMessages() {
        const hud = document.getElementById(this._hudId);
        const container = document.getElementById(this._containerId);
        const stack = document.getElementById(this._stackId);

        if (container) {
            container.classList.remove('visible');
        }
        if (hud) {
            hud.classList.remove('hidden');
        }
        if (stack) {
            stack.innerHTML = '';
        }
    }

    /**
     * Get message log for pause screen
     * @returns {Array<{text: string, type: string, time: number}>}
     */
    getMessageLog() {
        return this._messageLog;
    }

    /**
     * Clear message log
     */
    clearMessageLog() {
        this._messageLog = [];
    }

    /**
     * Reset the message system (for new game/stage)
     */
    reset() {
        this._messageLog = [];
        this.hideMessages();
    }
}
