/**
 * Renderer.js - Shared Rendering Module
 *
 * Provides unified drawing functions for Editor and Game
 * to ensure visual consistency between both applications.
 *
 * Based on specification.md and game_specification.md
 */

import { getHexVertices } from './HexMath.js';

// ========== Rendering Configuration ==========

export const RENDER_CONFIG = {
    block: {
        gap: 2,  // Gap between blocks (radius reduction)
        // 境界線設定（画像クリッピング時）
        border: {
            color: '#ffffff',
            widthRatio: 0.03  // radius の 3%
        },
        // エンボス設定（パーセンテージベース）
        emboss: {
            insetRatio: 0.10,       // radius の 10%
            lineWidthRatio: 0.08,   // radius の 8%
            highlightColor: '#ffffff',
            highlightOpacity: 0.5,
            shadowColor: '#000000',
            shadowOpacity: 0.4
        }
    },
    line: {
        collision: {
            dashPattern: [],
            label: null
        },
        paddle: {
            dashPattern: [5, 3],
            label: {
                text: 'PADDLE',
                bgColor: '#2196F3',
                textColor: '#FFFFFF'
            }
        },
        missline: {
            dashPattern: [10, 5],
            label: {
                text: 'MISS LINE',
                bgColor: '#F44336',
                textColor: '#FFFFFF'
            }
        },
        decoration: {
            dashPattern: [],
            label: null
        }
    }
};

// ========== Helper Functions ==========

/**
 * Convert hex color to rgba string
 * @private
 * @param {string} hex - Hex color (e.g., '#ffffff')
 * @param {number} opacity - Opacity (0-1)
 * @returns {string} rgba string
 */
function _hexToRgba(hex, opacity) {
    // Remove # if present
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// ========== Block Drawing ==========

/**
 * Draw a hexagonal block with emboss effect
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} centerX - Block center X coordinate
 * @param {number} centerY - Block center Y coordinate
 * @param {number} radius - Hex radius
 * @param {string} color - Block fill color
 * @param {Object} options - Optional parameters
 * @param {number} options.durability - Durability value (shown as text if > 1)
 * @param {string} options.gemDrop - Gem drop type ('guaranteed', 'infinite', or null)
 * @param {string} options.blockType - Block type ('key', 'lock', or null)
 * @param {HTMLImageElement} options.clipImage - Image to clip to hex shape
 */
export function drawHexBlock(ctx, centerX, centerY, radius, color, options = {}) {
    const { durability, gemDrop, blockType, clipImage } = options;

    // Calculate actual radius with gap (画像クリッピング時は隙間なし)
    const gap = clipImage ? 0 : RENDER_CONFIG.block.gap;
    const actualRadius = radius - gap;

    // Get hex vertices
    const vertices = getHexVertices(centerX, centerY, actualRadius);

    // Draw hex path
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();

    // Fill with color or clipped image
    if (clipImage) {
        ctx.save();
        ctx.clip();
        ctx.drawImage(clipImage, 0, 0);
        ctx.restore();

        // 境界線を描画（gap=0 の場合、太さが0%なら描画しない）
        const borderConfig = RENDER_CONFIG.block.border;
        if (borderConfig.widthRatio > 0) {
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
                ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            ctx.closePath();
            ctx.strokeStyle = borderConfig.color;
            ctx.lineWidth = Math.max(1, actualRadius * borderConfig.widthRatio);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
    } else {
        ctx.fillStyle = color;
        ctx.fill();
    }

    // Draw emboss effect (inside the hex)
    _drawHexEmbossInset(ctx, centerX, centerY, actualRadius);

    // Draw durability indicator
    if (durability && durability > 1) {
        _drawDurabilityText(ctx, centerX, centerY, durability);
    }

    // Draw special block indicators
    if (gemDrop === 'guaranteed') {
        _drawGemIcon(ctx, centerX, centerY, '#FFD700');
    } else if (gemDrop === 'infinite') {
        _drawGemIcon(ctx, centerX, centerY, '#FF00FF');
    }

    if (blockType === 'key') {
        _drawKeyIcon(ctx, centerX, centerY);
    } else if (blockType === 'lock') {
        _drawLockIcon(ctx, centerX, centerY);
    }
}

/**
 * Draw emboss effect inside the hex (inset from edges)
 * @private
 */
function _drawHexEmbossInset(ctx, centerX, centerY, radius) {
    const config = RENDER_CONFIG.block.emboss;

    // 太さが0%ならエンボスを描画しない
    if (config.lineWidthRatio <= 0) return;

    // パーセンテージベースで計算
    const insetRadius = radius - (radius * config.insetRatio);
    const lineWidth = Math.max(1, radius * config.lineWidthRatio);

    // Get inset vertices
    const vertices = getHexVertices(centerX, centerY, insetRadius);

    // Highlight (top-left edges: vertices 5 -> 0 -> 1)
    ctx.strokeStyle = _hexToRgba(config.highlightColor, config.highlightOpacity);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(vertices[5].x, vertices[5].y);
    ctx.lineTo(vertices[0].x, vertices[0].y);
    ctx.lineTo(vertices[1].x, vertices[1].y);
    ctx.stroke();

    // Shadow (bottom-right edges: vertices 2 -> 3 -> 4)
    ctx.strokeStyle = _hexToRgba(config.shadowColor, config.shadowOpacity);

    ctx.beginPath();
    ctx.moveTo(vertices[2].x, vertices[2].y);
    ctx.lineTo(vertices[3].x, vertices[3].y);
    ctx.lineTo(vertices[4].x, vertices[4].y);
    ctx.stroke();
}

/**
 * Draw durability text
 * @private
 */
function _drawDurabilityText(ctx, centerX, centerY, durability) {
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw text shadow for readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(durability.toString(), centerX, centerY);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

/**
 * Draw gem icon
 * @private
 */
function _drawGemIcon(ctx, centerX, centerY, color) {
    ctx.fillStyle = color;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('\u{1F48E}', centerX, centerY - 5);  // Diamond emoji
}

/**
 * Draw key icon
 * @private
 */
function _drawKeyIcon(ctx, centerX, centerY) {
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F511}', centerX, centerY);  // Key emoji
}

/**
 * Draw lock icon
 * @private
 */
function _drawLockIcon(ctx, centerX, centerY) {
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F512}', centerX, centerY);  // Lock emoji
}

// ========== Line Drawing ==========

/**
 * Draw a line with type-specific styling
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} line - Line object
 * @param {Array<{x: number, y: number}>} line.points - Line points
 * @param {string} line.type - Line type ('collision', 'paddle', 'missline', 'decoration')
 * @param {string} line.color - Line color
 * @param {number} line.thickness - Line thickness
 * @param {number} line.opacity - Line opacity (0-1)
 * @param {boolean} line.closed - Whether line is closed
 * @param {Object} options - Optional parameters
 * @param {boolean} options.showLabel - Whether to show type label (default: true)
 * @param {boolean} options.isSelected - Whether line is selected (for editor)
 */
export function drawLine(ctx, line, options = {}) {
    const { showLabel = true, isSelected = false } = options;

    if (!line.points || line.points.length < 2) return;

    const typeConfig = RENDER_CONFIG.line[line.type] || RENDER_CONFIG.line.collision;

    // Draw selection highlight (editor only)
    if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = line.thickness + 4;
        ctx.globalAlpha = 0.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        _drawLinePath(ctx, line);
        ctx.stroke();
        ctx.restore();
    }

    // Draw main line
    ctx.save();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.thickness;
    ctx.globalAlpha = line.opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(typeConfig.dashPattern || []);

    _drawLinePath(ctx, line);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    // Draw label
    if (showLabel && typeConfig.label && line.points.length >= 2) {
        _drawLineLabel(ctx, line.points[0], line.points[1], typeConfig.label);
    }
}

/**
 * Draw line path
 * @private
 */
function _drawLinePath(ctx, line) {
    ctx.beginPath();
    ctx.moveTo(line.points[0].x, line.points[0].y);

    for (let i = 1; i < line.points.length; i++) {
        ctx.lineTo(line.points[i].x, line.points[i].y);
    }

    if (line.closed) {
        ctx.closePath();
    }
}

/**
 * Draw line label
 * @private
 */
function _drawLineLabel(ctx, p1, p2, label) {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2 - 25;

    ctx.save();

    ctx.font = 'bold 14px sans-serif';
    const textWidth = ctx.measureText(label.text).width;

    // Background
    ctx.fillStyle = label.bgColor;
    ctx.fillRect(midX - textWidth / 2 - 4, midY - 9, textWidth + 8, 18);

    // Text
    ctx.fillStyle = label.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.text, midX, midY);

    ctx.restore();
}

/**
 * Draw all lines from a line array
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} lines - Array of line objects
 * @param {Object} options - Optional parameters
 * @param {boolean} options.showLabels - Whether to show labels (default: true)
 * @param {string} options.selectedLineId - ID of selected line (editor only)
 */
export function drawLines(ctx, lines, options = {}) {
    const { showLabels = true, selectedLineId = null } = options;

    for (const line of lines) {
        drawLine(ctx, line, {
            showLabel: showLabels,
            isSelected: line.id === selectedLineId
        });
    }
}
