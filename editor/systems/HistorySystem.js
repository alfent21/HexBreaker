/**
 * HistorySystem.js - Undo/Redo System
 * Ported from Hexposed, adapted for HexBreaker's multi-layer architecture.
 *
 * Records block and line changes as actions (groups of changes).
 * Each action can be undone/redone as a unit.
 */

export class HistorySystem {
    /**
     * @param {import('../core/Editor.js').Editor} editor
     */
    constructor(editor) {
        this.editor = editor;

        /** @type {Action[]} */
        this.undoStack = [];

        /** @type {Action[]} */
        this.redoStack = [];

        /** @type {number} Maximum number of undo steps */
        this.maxSteps = 50;

        /** @type {Action|null} Currently recording action */
        this.currentAction = null;
    }

    /**
     * Start recording a new action.
     * All subsequent recordChange() calls will be added to this action.
     */
    beginAction() {
        this.currentAction = { changes: [] };
    }

    /**
     * Record a single change within the current action.
     * @param {BlockChange|LineChange} change
     */
    recordChange(change) {
        if (this.currentAction) {
            this.currentAction.changes.push(change);
        }
    }

    /**
     * End the current action and push it to the undo stack.
     * Empty actions (no changes) are discarded.
     */
    endAction() {
        if (this.currentAction && this.currentAction.changes.length > 0) {
            this.undoStack.push(this.currentAction);

            // Enforce max history limit
            if (this.undoStack.length > this.maxSteps) {
                this.undoStack.shift();
            }

            // New action invalidates redo history
            this.redoStack = [];
        }
        this.currentAction = null;
        this.updateButtons();
    }

    /**
     * Undo the last action.
     */
    undo() {
        if (this.undoStack.length === 0) return;

        const action = this.undoStack.pop();
        const redoAction = { changes: [] };

        // Suppress change notifications during undo
        this.editor.blockManager._suppressNotify = true;
        this.editor.lineManager._suppressNotify = true;

        // Apply changes in reverse order
        for (const change of action.changes.slice().reverse()) {
            const reverseChange = this._applyChange(change, true);
            if (reverseChange) {
                redoAction.changes.push(reverseChange);
            }
        }

        // Restore notifications and sync once
        this.editor.blockManager._suppressNotify = false;
        this.editor.lineManager._suppressNotify = false;
        this._syncAndRender();

        this.redoStack.push(redoAction);
        this.updateButtons();
    }

    /**
     * Redo the last undone action.
     */
    redo() {
        if (this.redoStack.length === 0) return;

        const action = this.redoStack.pop();
        const undoAction = { changes: [] };

        // Suppress change notifications during redo
        this.editor.blockManager._suppressNotify = true;
        this.editor.lineManager._suppressNotify = true;

        // Apply changes in reverse order
        for (const change of action.changes.slice().reverse()) {
            const reverseChange = this._applyChange(change, false);
            if (reverseChange) {
                undoAction.changes.push(reverseChange);
            }
        }

        // Restore notifications and sync once
        this.editor.blockManager._suppressNotify = false;
        this.editor.lineManager._suppressNotify = false;
        this._syncAndRender();

        this.undoStack.push(undoAction);
        this.updateButtons();
    }

    /**
     * Apply a single change and return its reverse.
     * @private
     * @param {BlockChange|LineChange} change
     * @param {boolean} isUndo - true for undo, false for redo
     * @returns {BlockChange|LineChange|null}
     */
    _applyChange(change, isUndo) {
        switch (change.type) {
            case 'block':
                return this._applyBlockChange(change, isUndo);
            case 'line':
                return this._applyLineChange(change, isUndo);
            default:
                console.error(`[HistorySystem] Unknown change type: ${change.type}`);
                return null;
        }
    }

    /**
     * Apply a block change and return its reverse.
     * @private
     * @param {BlockChange} change - { type:'block', layerId, key, oldValue, newValue }
     * @param {boolean} isUndo
     * @returns {BlockChange|null}
     */
    _applyBlockChange(change, isUndo) {
        const layer = this.editor.layerManager.getLayer(change.layerId);
        if (!layer || layer.type !== 'block') {
            console.error(`[HistorySystem] Block layer ${change.layerId} not found`);
            return null;
        }

        const reverseChange = {
            type: 'block',
            layerId: change.layerId,
            key: change.key,
            oldValue: change.newValue,
            newValue: change.oldValue
        };

        const targetValue = isUndo ? change.oldValue : change.newValue;
        if (targetValue) {
            layer.blocks.set(change.key, { ...targetValue });
        } else {
            layer.blocks.delete(change.key);
        }

        return reverseChange;
    }

    /**
     * Apply a line change and return its reverse.
     * @private
     * @param {LineChange} change
     * @param {boolean} isUndo
     * @returns {LineChange|null}
     */
    _applyLineChange(change, isUndo) {
        const lines = this.editor.lineManager.lines;

        switch (change.action) {
            case 'add': {
                // Undo add = remove the line
                const idx = lines.findIndex(l => l.id === change.line.id);
                if (idx !== -1) {
                    lines.splice(idx, 1);
                }
                // Clear selection if this line was selected
                if (this.editor.lineManager.selectedLineId === change.line.id) {
                    this.editor.lineManager.selectedLineId = null;
                    this.editor.lineManager.selectedVertexIndex = null;
                }
                return {
                    type: 'line',
                    action: 'remove',
                    line: JSON.parse(JSON.stringify(change.line))
                };
            }

            case 'remove': {
                // Undo remove = re-add the line
                lines.push(JSON.parse(JSON.stringify(change.line)));
                return {
                    type: 'line',
                    action: 'add',
                    line: JSON.parse(JSON.stringify(change.line))
                };
            }

            case 'update': {
                const idx = lines.findIndex(l => l.id === change.lineId);
                if (idx !== -1) {
                    const targetLine = isUndo ? change.oldLine : change.newLine;
                    lines[idx] = JSON.parse(JSON.stringify(targetLine));
                }
                return {
                    type: 'line',
                    action: 'update',
                    lineId: change.lineId,
                    oldLine: JSON.parse(JSON.stringify(change.newLine)),
                    newLine: JSON.parse(JSON.stringify(change.oldLine))
                };
            }

            default:
                console.error(`[HistorySystem] Unknown line action: ${change.action}`);
                return null;
        }
    }

    /**
     * Sync stage data and render after undo/redo.
     * @private
     */
    _syncAndRender() {
        this.editor.isDirty = true;
        this.editor._syncLayersToStage();
        this.editor._syncLinesToStage();
        this.editor.render();
        this.editor.emit('blocksChanged');
        this.editor.emit('linesChanged', this.editor.lineManager.getAllLines());
    }

    /**
     * Update Undo/Redo button states.
     */
    updateButtons() {
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');

        if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
    }

    /**
     * Clear all history (e.g., on stage switch).
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentAction = null;
        this.updateButtons();
    }

    /**
     * Check if currently recording an action.
     * @returns {boolean}
     */
    isRecording() {
        return this.currentAction !== null;
    }
}

/**
 * @typedef {Object} Action
 * @property {(BlockChange|LineChange)[]} changes
 */

/**
 * @typedef {Object} BlockChange
 * @property {'block'} type
 * @property {number} layerId - ID of the block layer
 * @property {string} key - "row,col"
 * @property {Object|null} oldValue - Block data before change (null if didn't exist)
 * @property {Object|null} newValue - Block data after change (null if deleted)
 */

/**
 * @typedef {Object} LineChange
 * @property {'line'} type
 * @property {'add'|'remove'|'update'} action
 * @property {Object} [line] - Full line data (for add/remove)
 * @property {string} [lineId] - Line ID (for update)
 * @property {Object} [oldLine] - Line data before change (for update)
 * @property {Object} [newLine] - Line data after change (for update)
 */
