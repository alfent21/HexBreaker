/**
 * Config.js - Editor Configuration & Constants
 * Based on specification.md Section 2.1-2.4
 */

import { GRID_SIZES } from '../../shared/HexMath.js';

// Re-export grid sizes for convenience
export { GRID_SIZES };

// Canvas configuration
export const CANVAS_CONFIG = {
    defaultWidth: 1280,
    defaultHeight: 720,
    backgroundColor: '#1a1a2e',
    gridColor: 'rgba(100, 150, 255, 0.4)',
    gridHighlightColor: 'rgba(150, 200, 255, 0.6)'
};

// Default grid size
export const DEFAULT_GRID_SIZE = 'medium';

// Tool definitions
export const TOOLS = {
    SELECT: 'select',
    BRUSH: 'brush',
    ERASER: 'eraser',
    FILL: 'fill',
    LINE: 'line',
    EYEDROPPER: 'eyedropper',
    HAND: 'hand',
    ZOOM: 'zoom'
};

// Brush size definitions (Section 2.4)
export const BRUSH_SIZES = {
    S: { name: 'S', range: 0 },     // Center cell only
    M: { name: 'M', range: 1 },     // Center + adjacent 6 cells
    L: { name: 'L', range: 2 }      // Center + 2 levels of adjacency
};

// Block defaults
export const BLOCK_DEFAULTS = {
    durability: 1,
    color: '#64B5F6',               // Material Design Blue 300
    maxDurability: 10
};

// Durability color palette
export const DURABILITY_COLORS = {
    1: '#64B5F6',  // Blue 300
    2: '#4FC3F7',  // Light Blue 300
    3: '#4DD0E1',  // Cyan 300
    4: '#4DB6AC',  // Teal 300
    5: '#81C784',  // Green 300
    6: '#AED581',  // Light Green 300
    7: '#DCE775',  // Lime 300
    8: '#FFD54F',  // Amber 300
    9: '#FF8A65',  // Deep Orange 300
    10: '#E57373'  // Red 300
};

// Line type definitions (Section 2.3)
export const LINE_TYPES = {
    COLLISION: {
        id: 'collision',
        name: '壁',
        color: '#FFFF00',
        dashPattern: [],
        hasPhysics: true,
        label: null
    },
    MISSLINE: {
        id: 'missline',
        name: 'ミスライン',
        color: '#FF0000',
        dashPattern: [10, 5],
        hasPhysics: true,
        label: { text: 'MISS LINE', bgColor: '#FF0000', textColor: '#FFFFFF' }
    },
    PADDLE: {
        id: 'paddle',
        name: 'パドル',
        color: '#00FF00',
        dashPattern: [5, 3],
        hasPhysics: true,
        label: { text: 'PADDLE', bgColor: '#00FF00', textColor: '#000000' }
    },
    DECORATION: {
        id: 'decoration',
        name: '装飾',
        color: '#888888',
        dashPattern: [],
        hasPhysics: false,
        label: null
    }
};

// Line defaults
export const LINE_DEFAULTS = {
    type: 'collision',
    color: '#FFFF00',
    thickness: 3,
    opacity: 1.0,
    paddleControl: 'mouse-x'
};

// Paddle control options
export const PADDLE_CONTROLS = [
    { id: 'mouse-x', name: 'マウス(横)' },
    { id: 'mouse-y', name: 'マウス(縦)' },
    { id: 'mouse-x-inv', name: 'マウス(横・反転)' },
    { id: 'mouse-y-inv', name: 'マウス(縦・反転)' },
    { id: 'key-x', name: 'キーボード(横)' },
    { id: 'key-y', name: 'キーボード(縦)' },
    { id: 'key-x-inv', name: 'キーボード(横・反転)' },
    { id: 'key-y-inv', name: 'キーボード(縦・反転)' },
    { id: 'auto', name: '自動' }
];

// Selection highlight colors
export const SELECTION_COLORS = {
    hover: 'rgba(255, 255, 0, 0.3)',
    selected: 'rgba(0, 255, 0, 0.4)',
    eraser: 'rgba(255, 68, 68, 0.4)'
};

// Vertex handle styles (for line editing)
export const VERTEX_HANDLE = {
    size: 8,
    normalColor: '#ffff00',
    hoverColor: '#00ffff',
    dragColor: '#ff6600',
    outlineColor: '#000000',
    outlineWidth: 1
};

// Zoom limits
export const ZOOM_CONFIG = {
    min: 0.25,
    max: 4.0,
    step: 0.1,
    default: 1.0
};

// Message types for Message Panel
export const MESSAGE_TYPES = {
    ERROR: { icon: '⚠️', className: 'error' },
    WARNING: { icon: '⚡', className: 'warning' },
    INFO: { icon: 'ℹ️', className: 'info' },
    TIP: { icon: '💡', className: 'tip' }
};

// Stage defaults
export const STAGE_DEFAULTS = {
    initialLives: 3,
    clearBonus: 1000,
    powerGemChance: 0.15,
    resetGemsOnClear: false,
    blockGuide: {
        enabled: true,
        probability: 0.5,
        angleLimit: 30
    },
    weaponCosts: {
        slow: 1,
        wide: 2,
        double: 2,
        laser: 3,
        shield: 4,
        magnet: 4,
        ghost: 4
    }
};

// Project file version
export const PROJECT_VERSION = '5.0';
