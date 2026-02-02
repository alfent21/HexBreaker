/**
 * CursorManager.js - Dynamic Cursor Generation
 *
 * Generates custom cursors based on current tool and grid size.
 */

import { TOOLS } from '../core/Config.js';

export class CursorManager {
    constructor() {
        // Cache for generated cursors
        this.cursorCache = new Map();
    }

    /**
     * Generate cursor for tool and grid size
     * @param {string} tool - Current tool
     * @param {Object} gridSize - Grid size config
     * @param {boolean} isErasing - Shift held for brush eraser mode
     * @returns {string} CSS cursor value
     */
    getCursor(tool, gridSize, isErasing = false) {
        // Handle pan mode separately
        if (tool === TOOLS.HAND) {
            return 'grab';
        }

        // Generate cache key
        const cacheKey = `${tool}_${gridSize.radius}_${isErasing}`;

        // Return cached cursor if available
        if (this.cursorCache.has(cacheKey)) {
            return this.cursorCache.get(cacheKey);
        }

        // Generate new cursor
        let cursor;
        switch (tool) {
            case TOOLS.BRUSH:
                cursor = isErasing
                    ? this._generateEraserCursor(gridSize)
                    : this._generateBrushCursor(gridSize);
                break;
            case TOOLS.ERASER:
                cursor = this._generateEraserCursor(gridSize);
                break;
            case TOOLS.LINE:
                cursor = this._generateLineCursor();
                break;
            case TOOLS.FILL:
                cursor = this._generateFillCursor();
                break;
            case TOOLS.SELECT:
                cursor = this._generateSelectCursor();
                break;
            case TOOLS.EYEDROPPER:
                cursor = this._generateEyedropperCursor();
                break;
            default:
                cursor = 'default';
        }

        // Cache and return
        this.cursorCache.set(cacheKey, cursor);
        return cursor;
    }

    /**
     * Generate brush cursor (simple dot)
     * @private
     */
    _generateBrushCursor(gridSize) {
        const size = 16;
        const center = size / 2;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // シンプルなドット（青緑）
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(center, center, 3, 0, Math.PI * 2);
        ctx.fill();

        // 外枠（視認性向上）
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();

        const dataUrl = canvas.toDataURL();
        return `url(${dataUrl}) ${center} ${center}, crosshair`;
    }

    /**
     * Generate eraser cursor (simple dot)
     * @private
     */
    _generateEraserCursor(gridSize) {
        const size = 16;
        const center = size / 2;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // シンプルなドット（赤）
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(center, center, 3, 0, Math.PI * 2);
        ctx.fill();

        // 外枠（視認性向上）
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();

        const dataUrl = canvas.toDataURL();
        return `url(${dataUrl}) ${center} ${center}, crosshair`;
    }

    /**
     * Generate line tool cursor (crosshair)
     * @private
     */
    _generateLineCursor() {
        const size = 24;
        const center = size / 2;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Draw crosshair
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(0, center);
        ctx.lineTo(center - 4, center);
        ctx.moveTo(center + 4, center);
        ctx.lineTo(size, center);
        ctx.stroke();

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(center, 0);
        ctx.lineTo(center, center - 4);
        ctx.moveTo(center, center + 4);
        ctx.lineTo(center, size);
        ctx.stroke();

        // Center circle
        ctx.beginPath();
        ctx.arc(center, center, 3, 0, Math.PI * 2);
        ctx.stroke();

        const dataUrl = canvas.toDataURL();
        return `url(${dataUrl}) ${center} ${center}, crosshair`;
    }

    /**
     * Generate fill tool cursor (bucket)
     * @private
     */
    _generateFillCursor() {
        const size = 24;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Draw bucket shape
        ctx.strokeStyle = '#00ff00';
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 2;

        // Bucket body
        ctx.beginPath();
        ctx.moveTo(4, 8);
        ctx.lineTo(4, 18);
        ctx.lineTo(14, 22);
        ctx.lineTo(14, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Handle
        ctx.beginPath();
        ctx.moveTo(14, 10);
        ctx.quadraticCurveTo(20, 6, 18, 2);
        ctx.stroke();

        // Pour line
        ctx.strokeStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(4, 8);
        ctx.lineTo(2, 4);
        ctx.stroke();

        const dataUrl = canvas.toDataURL();
        return `url(${dataUrl}) 2 4, crosshair`;
    }

    /**
     * Generate select tool cursor (selection box)
     * @private
     */
    _generateSelectCursor() {
        const size = 24;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Draw selection corners
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        const margin = 4;
        const cornerLen = 6;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(margin, margin + cornerLen);
        ctx.lineTo(margin, margin);
        ctx.lineTo(margin + cornerLen, margin);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(size - margin - cornerLen, margin);
        ctx.lineTo(size - margin, margin);
        ctx.lineTo(size - margin, margin + cornerLen);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(margin, size - margin - cornerLen);
        ctx.lineTo(margin, size - margin);
        ctx.lineTo(margin + cornerLen, size - margin);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(size - margin - cornerLen, size - margin);
        ctx.lineTo(size - margin, size - margin);
        ctx.lineTo(size - margin, size - margin - cornerLen);
        ctx.stroke();

        const dataUrl = canvas.toDataURL();
        return `url(${dataUrl}) ${size/2} ${size/2}, crosshair`;
    }

    /**
     * Generate eyedropper cursor
     * @private
     */
    _generateEyedropperCursor() {
        const size = 24;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Draw eyedropper shape
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        // Tip
        ctx.beginPath();
        ctx.moveTo(2, 22);
        ctx.lineTo(8, 16);
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.moveTo(8, 16);
        ctx.lineTo(14, 10);
        ctx.lineTo(18, 14);
        ctx.lineTo(12, 20);
        ctx.closePath();
        ctx.stroke();

        // Bulb
        ctx.beginPath();
        ctx.arc(17, 7, 4, 0, Math.PI * 2);
        ctx.stroke();

        const dataUrl = canvas.toDataURL();
        return `url(${dataUrl}) 2 22, crosshair`;
    }

    /**
     * Clear cursor cache (call when grid size changes significantly)
     */
    clearCache() {
        this.cursorCache.clear();
    }
}
