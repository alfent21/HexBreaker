/**
 * HexMath.js - Hex Grid Coordinate Mathematics
 * Shared utility for both Editor and Game
 * 
 * Flat-top hexagon grid system implementation
 * Based on specification.md Section 2.1
 */

// Grid size definitions from specification
export const GRID_SIZES = {
    small: {
        name: '小(10px)',
        radius: 10,
        width: Math.sqrt(3) * 10,      // ~17.32
        height: 20,
        verticalSpacing: 10 * 1.5      // 15
    },
    medium: {
        name: '中(30px)',
        radius: 30,
        width: Math.sqrt(3) * 30,      // ~51.96
        height: 60,
        verticalSpacing: 30 * 1.5      // 45
    },
    large: {
        name: '大(50px)',
        radius: 50,
        width: Math.sqrt(3) * 50,      // ~86.60
        height: 100,
        verticalSpacing: 50 * 1.5      // 75
    }
};

/**
 * Convert hex grid coordinates to pixel coordinates
 * @param {number} row - Grid row
 * @param {number} col - Grid column
 * @param {Object} gridSize - Grid size config (from GRID_SIZES)
 * @returns {{x: number, y: number}} Pixel coordinates (center of hex)
 */
export function hexToPixel(row, col, gridSize) {
    const { width, radius, verticalSpacing } = gridSize;

    // Odd rows are offset by half a cell width
    const offsetX = (row % 2 === 1) ? width / 2 : 0;

    const x = col * width + offsetX + width / 2;
    const y = row * verticalSpacing + radius;

    return { x, y };
}

/**
 * Convert pixel coordinates to hex grid coordinates
 * Uses nearest-neighbor search in 3x3 area
 * @param {number} x - Pixel X
 * @param {number} y - Pixel Y
 * @param {Object} gridSize - Grid size config
 * @returns {{row: number, col: number}} Grid coordinates
 */
export function pixelToHex(x, y, gridSize) {
    const { width, radius, verticalSpacing } = gridSize;

    // Approximate position
    const approxRow = Math.round((y - radius) / verticalSpacing);
    const offsetX = (approxRow % 2 === 1) ? width / 2 : 0;
    const approxCol = Math.round((x - offsetX - width / 2) / width);

    // Search 3x3 neighborhood for closest hex center
    let minDist = Infinity;
    let bestRow = approxRow;
    let bestCol = approxCol;

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const testRow = approxRow + dr;
            const testCol = approxCol + dc;

            const center = hexToPixel(testRow, testCol, gridSize);
            const dist = Math.hypot(x - center.x, y - center.y);

            if (dist < minDist) {
                minDist = dist;
                bestRow = testRow;
                bestCol = testCol;
            }
        }
    }

    return { row: bestRow, col: bestCol };
}

/**
 * Get the 6 vertex positions of a flat-top hexagon
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @param {number} radius - Hexagon radius
 * @returns {Array<{x: number, y: number}>} Array of 6 vertex positions
 */
export function getHexVertices(centerX, centerY, radius) {
    const vertices = [];

    // Flat-top hexagon: start at -30° (top-left vertex) and go clockwise
    // This creates vertices at: -30°, 30°, 90°, 150°, 210°, 270°
    // Which gives us a flat top and bottom, pointed sides
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;  // Start at -30° (-π/6)
        vertices.push({
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
        });
    }

    return vertices;
}

/**
 * Get neighbor cell offsets based on row parity
 * @param {number} row - Current row
 * @returns {Array<[number, number]>} Array of [dRow, dCol] offsets
 */
export function getNeighborOffsets(row) {
    if (row % 2 === 0) {
        // Even row
        return [
            [-1, -1], [-1, 0],  // Top-left, Top-right
            [0, -1], [0, 1],    // Left, Right
            [1, -1], [1, 0]     // Bottom-left, Bottom-right
        ];
    } else {
        // Odd row
        return [
            [-1, 0], [-1, 1],   // Top-left, Top-right
            [0, -1], [0, 1],    // Left, Right
            [1, 0], [1, 1]      // Bottom-left, Bottom-right
        ];
    }
}

/**
 * Get all neighbor coordinates for a hex cell
 * @param {number} row - Cell row
 * @param {number} col - Cell column
 * @returns {Array<{row: number, col: number}>} Neighbor coordinates
 */
export function getHexNeighbors(row, col) {
    const offsets = getNeighborOffsets(row);
    return offsets.map(([dr, dc]) => ({
        row: row + dr,
        col: col + dc
    }));
}

/**
 * Check if a point is inside a hexagon
 * @param {number} px - Point X
 * @param {number} py - Point Y
 * @param {number} centerX - Hex center X
 * @param {number} centerY - Hex center Y
 * @param {number} radius - Hex radius
 * @returns {boolean} True if point is inside
 */
export function isPointInHex(px, py, centerX, centerY, radius) {
    const dist = Math.hypot(px - centerX, py - centerY);

    // Quick rejection: outside bounding circle
    if (dist > radius) return false;

    // For more precision, check against hex edges
    // Using the inner radius (apothem) for flat-top hex
    const innerRadius = radius * Math.sqrt(3) / 2;

    // Transform to hex-local coordinates
    const dx = Math.abs(px - centerX);
    const dy = Math.abs(py - centerY);

    // Check against hex boundaries
    return dx <= innerRadius &&
        dy <= radius * 0.5 + (innerRadius - dx) / Math.sqrt(3);
}

/**
 * Generate a unique key for a hex cell (for Map storage)
 * @param {number} row - Cell row
 * @param {number} col - Cell column
 * @returns {string} Key in "row,col" format
 */
export function getHexKey(row, col) {
    return `${row},${col}`;
}

/**
 * Parse a hex key back to coordinates
 * @param {string} key - Key in "row,col" format
 * @returns {{row: number, col: number}} Coordinates
 */
export function parseHexKey(key) {
    const [row, col] = key.split(',').map(Number);
    return { row, col };
}

/**
 * Calculate distance between two hex cells (in grid units)
 * @param {number} row1 - First cell row
 * @param {number} col1 - First cell column
 * @param {number} row2 - Second cell row
 * @param {number} col2 - Second cell column
 * @returns {number} Grid distance
 */
export function hexDistance(row1, col1, row2, col2) {
    // Convert offset coords to cube coords for distance calculation
    const x1 = col1 - (row1 - (row1 & 1)) / 2;
    const z1 = row1;
    const y1 = -x1 - z1;

    const x2 = col2 - (row2 - (row2 & 1)) / 2;
    const z2 = row2;
    const y2 = -x2 - z2;

    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

/**
 * Calculate the maximum valid row index for a given canvas height
 * @param {number} canvasHeight - Canvas height in pixels
 * @param {Object} gridSize - Grid size config
 * @returns {number} Maximum row index (0-based)
 */
export function getMaxRow(canvasHeight, gridSize) {
    const { radius, verticalSpacing } = gridSize;
    // Hex center.y = row * verticalSpacing + radius
    // For center.y to be within canvas: row * verticalSpacing + radius <= canvasHeight
    // row <= (canvasHeight - radius) / verticalSpacing
    return Math.floor((canvasHeight - radius) / verticalSpacing);
}

/**
 * Calculate the maximum valid column index for a given canvas width
 * @param {number} canvasWidth - Canvas width in pixels
 * @param {Object} gridSize - Grid size config
 * @returns {number} Maximum column index (0-based)
 */
export function getMaxCol(canvasWidth, gridSize) {
    const { width } = gridSize;
    // For odd rows, center.x = col * width + width/2 + width/2 = col * width + width
    // For even rows, center.x = col * width + width/2
    // Worst case (odd row): col * width + width <= canvasWidth
    // col <= (canvasWidth - width) / width
    return Math.floor((canvasWidth - width) / width);
}

/**
 * Check if a hex position is within valid canvas bounds
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} canvasWidth - Canvas width in pixels
 * @param {number} canvasHeight - Canvas height in pixels
 * @param {Object} gridSize - Grid size config
 * @returns {boolean} True if position is valid
 */
export function isValidHexPosition(row, col, canvasWidth, canvasHeight, gridSize) {
    if (row < 0 || col < 0) return false;
    const maxRow = getMaxRow(canvasHeight, gridSize);
    const maxCol = getMaxCol(canvasWidth, gridSize);
    return row <= maxRow && col <= maxCol;
}
