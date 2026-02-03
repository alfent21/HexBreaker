/**
 * MessageController.js - Message Panel Controller
 *
 * Handles message panel display, copy, and clear operations.
 * Extracted from UIController.js for single responsibility.
 */

import { MESSAGE_TYPES } from '../../core/Config.js';

export class MessageController {
    /**
     * @param {import('../../core/Editor.js').Editor} editor
     */
    constructor(editor) {
        this.editor = editor;

        // Message queue
        this.messages = [];
        this.maxMessages = 50;

        // DOM element references (set during init)
        this.elements = {
            messageList: null,
            copyMessagesBtn: null,
            clearMessagesBtn: null
        };
    }

    /**
     * Initialize the message controller
     * @param {Object} elements - Cached DOM elements from UIController
     */
    init(elements) {
        this._cacheElements(elements);
        this._validateElements();
        this._bindEvents();
    }

    /**
     * Cache DOM element references
     * @private
     */
    _cacheElements(elements) {
        this.elements.messageList = elements.messageList;
        this.elements.copyMessagesBtn = elements.copyMessagesBtn;
        this.elements.clearMessagesBtn = elements.clearMessagesBtn;
    }

    /**
     * Validate required elements exist
     * @private
     */
    _validateElements() {
        // messageList is required for core functionality
        if (!this.elements.messageList) {
            throw new Error('[MessageController] Required element "messageList" not found');
        }
        // Buttons are optional but log warning if missing
        if (!this.elements.copyMessagesBtn) {
            console.warn('[MessageController] copyMessagesBtn element not found - copy feature disabled');
        }
        if (!this.elements.clearMessagesBtn) {
            console.warn('[MessageController] clearMessagesBtn element not found - clear button disabled');
        }
    }

    /**
     * Bind event listeners
     * @private
     */
    _bindEvents() {
        // Copy all messages button
        if (this.elements.copyMessagesBtn) {
            this.elements.copyMessagesBtn.addEventListener('click', () => this._copyAllMessages());
        }

        // Clear messages button
        if (this.elements.clearMessagesBtn) {
            this.elements.clearMessagesBtn.addEventListener('click', () => this._clearMessages());
        }

        // Listen for message events from editor
        this.editor.on('message', (msg) => this.addMessage(msg.type, msg.text));
    }

    /**
     * Add message to message panel
     * @param {string} type - Message type (info, warning, error, success)
     * @param {string} text - Message text
     */
    addMessage(type, text) {
        const typeConfig = MESSAGE_TYPES[type.toUpperCase()] || MESSAGE_TYPES.INFO;

        const message = {
            type,
            text,
            time: new Date().toLocaleTimeString()
        };

        this.messages.push(message);
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }

        this._renderMessages();
    }

    /**
     * Render messages to the panel
     * @private
     */
    _renderMessages() {
        const list = this.elements.messageList;
        // Already validated in init, but defensive check
        if (!list) return;

        list.innerHTML = '';

        // Show last 10 messages
        for (const msg of this.messages.slice(-10)) {
            const typeConfig = MESSAGE_TYPES[msg.type.toUpperCase()] || MESSAGE_TYPES.INFO;
            const div = document.createElement('div');
            div.className = `message ${typeConfig.className}`;
            div.innerHTML = `
                <span class="message-icon">${typeConfig.icon}</span>
                <span class="message-text">${msg.text}</span>
                <span class="message-time">${msg.time}</span>
                <button class="message-copy-btn" title="コピー">📋</button>
            `;

            // Add copy button click handler for individual message
            const copyBtn = div.querySelector('.message-copy-btn');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(msg.text).then(() => {
                    copyBtn.textContent = '✓';
                    setTimeout(() => { copyBtn.textContent = '📋'; }, 1000);
                });
            });

            list.appendChild(div);
        }

        // Scroll to bottom to show latest message
        list.scrollTop = list.scrollHeight;
    }

    /**
     * Clear all messages
     * @private
     */
    _clearMessages() {
        this.messages = [];
        this._renderMessages();
    }

    /**
     * Copy all messages to clipboard
     * @private
     */
    _copyAllMessages() {
        const text = this.messages.map(msg => `[${msg.time}] ${msg.text}`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            const btn = this.elements.copyMessagesBtn;
            if (btn) {
                const original = btn.textContent;
                btn.textContent = '✓';
                setTimeout(() => { btn.textContent = original; }, 1000);
            }
        });
    }

    /**
     * Get all messages (for external access)
     * @returns {Array}
     */
    getMessages() {
        return [...this.messages];
    }
}
