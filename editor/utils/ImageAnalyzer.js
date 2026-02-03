/**
 * ImageAnalyzer.js - Image Analysis for Blockify Feature
 * Based on specification.md Section 2.2
 *
 * Analyzes image layers to generate block placement data.
 */

import { hexToPixel, pixelToHex, getHexVertices, getHexKey, GRID_SIZES } from '../../shared/HexMath.js';

/**
 * @typedef {Object} BlockifyOptions
 * @property {string} gridSize - 'small' | 'medium' | 'large'
 * @property {number} alphaThreshold - Alpha threshold (0-255)
 * @property {number} coverageThreshold - Minimum hex coverage (0-1)
 * @property {number} defaultDurability - Default durability for generated blocks
 * @property {string} defaultColor - Default block color
 * @property {boolean} useImageColor - Extract color from image
 */

/**
 * @typedef {Object} BlockifyResult
 * @property {Map<string, Object>} blocks - Generated blocks (key = "row,col")
 * @property {number} totalHexes - Total hexes analyzed
 * @property {number} filledHexes - Hexes that passed threshold
 */

export class ImageAnalyzer {
    /**
     * Default blockify options
     */
    static get DEFAULT_OPTIONS() {
        return {
            gridSize: 'medium',
            alphaThreshold: 250, // ほぼ完全に不透明なピクセルのみ対象
            coverageThreshold: 0.3,
            defaultDurability: 1,
            defaultColor: '#64B5F6',
            useImageColor: true
        };
    }

    /**
     * Analyze an image layer and generate block placement data
     * @param {HTMLImageElement} image - Image element to analyze
     * @param {BlockifyOptions} options - Analysis options
     * @returns {BlockifyResult} Generated block data
     */
    static analyzeAlpha(image, options = {}) {
        const opts = { ...ImageAnalyzer.DEFAULT_OPTIONS, ...options };
        const gridSize = GRID_SIZES[opts.gridSize] || GRID_SIZES.medium;

        // Create off-screen canvas to read pixel data
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Calculate grid bounds
        const maxRow = Math.ceil(canvas.height / gridSize.verticalSpacing) + 1;
        const maxCol = Math.ceil(canvas.width / gridSize.width) + 1;

        const blocks = new Map();
        let totalHexes = 0;
        let filledHexes = 0;

        // Iterate through each hex position
        for (let row = 0; row < maxRow; row++) {
            for (let col = 0; col < maxCol; col++) {
                const center = hexToPixel(row, col, gridSize);

                // Skip if center is outside image bounds
                if (center.x < 0 || center.x >= canvas.width ||
                    center.y < 0 || center.y >= canvas.height) {
                    continue;
                }

                totalHexes++;

                // Sample pixels within the hex
                const result = this._sampleHex(
                    pixels,
                    canvas.width,
                    canvas.height,
                    center.x,
                    center.y,
                    gridSize.radius,
                    opts.alphaThreshold
                );

                // Check if coverage exceeds threshold
                if (result.coverage >= opts.coverageThreshold) {
                    filledHexes++;

                    const blockData = {
                        row,
                        col,
                        durability: opts.defaultDurability,
                        color: opts.useImageColor && result.avgColor
                            ? result.avgColor
                            : opts.defaultColor
                    };

                    blocks.set(getHexKey(row, col), blockData);
                }
            }
        }

        return { blocks, totalHexes, filledHexes };
    }

    /**
     * Sample pixels within a hex area
     * @private
     * @param {Uint8ClampedArray} pixels - Image pixel data
     * @param {number} imageWidth - Image width
     * @param {number} imageHeight - Image height
     * @param {number} centerX - Hex center X
     * @param {number} centerY - Hex center Y
     * @param {number} radius - Hex radius
     * @param {number} alphaThreshold - Minimum alpha to consider "filled"
     * @returns {{coverage: number, avgColor: string|null}}
     */
    static _sampleHex(pixels, imageWidth, imageHeight, centerX, centerY, radius, alphaThreshold) {
        // Sample points in a grid pattern within the hex bounding box
        const sampleSpacing = Math.max(2, Math.floor(radius / 5));
        const innerRadius = radius * Math.sqrt(3) / 2;

        let totalSamples = 0;
        let filledSamples = 0;
        let sumR = 0, sumG = 0, sumB = 0;
        let colorSamples = 0;

        for (let dy = -radius; dy <= radius; dy += sampleSpacing) {
            for (let dx = -innerRadius; dx <= innerRadius; dx += sampleSpacing) {
                const px = Math.round(centerX + dx);
                const py = Math.round(centerY + dy);

                // Check bounds
                if (px < 0 || px >= imageWidth || py < 0 || py >= imageHeight) {
                    continue;
                }

                // Check if point is actually inside hex (simple approximation)
                const distFromCenter = Math.hypot(dx, dy);
                if (distFromCenter > radius) continue;

                totalSamples++;

                // Get pixel index
                const idx = (py * imageWidth + px) * 4;
                const r = pixels[idx];
                const g = pixels[idx + 1];
                const b = pixels[idx + 2];
                const a = pixels[idx + 3];

                if (a >= alphaThreshold) {
                    filledSamples++;
                    sumR += r;
                    sumG += g;
                    sumB += b;
                    colorSamples++;
                }
            }
        }

        const coverage = totalSamples > 0 ? filledSamples / totalSamples : 0;

        let avgColor = null;
        if (colorSamples > 0) {
            const avgR = Math.round(sumR / colorSamples);
            const avgG = Math.round(sumG / colorSamples);
            const avgB = Math.round(sumB / colorSamples);
            avgColor = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
        }

        return { coverage, avgColor };
    }

    /**
     * Analyze difference between two images
     * @param {HTMLImageElement} image1 - First image (before)
     * @param {HTMLImageElement} image2 - Second image (after)
     * @param {Object} options - Analysis options
     * @returns {BlockifyResult} Blocks where images differ
     */
    static analyzeDiff(image1, image2, options = {}) {
        const opts = { ...ImageAnalyzer.DEFAULT_OPTIONS, ...options };
        const gridSize = GRID_SIZES[opts.gridSize] || GRID_SIZES.medium;

        // Validate image sizes match
        if (image1.width !== image2.width || image1.height !== image2.height) {
            throw new Error('画像サイズが一致しません');
        }

        // Create canvases for both images
        const canvas1 = document.createElement('canvas');
        canvas1.width = image1.width;
        canvas1.height = image1.height;
        const ctx1 = canvas1.getContext('2d');
        ctx1.drawImage(image1, 0, 0);
        const pixels1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height).data;

        const canvas2 = document.createElement('canvas');
        canvas2.width = image2.width;
        canvas2.height = image2.height;
        const ctx2 = canvas2.getContext('2d');
        ctx2.drawImage(image2, 0, 0);
        const pixels2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height).data;

        // Calculate grid bounds
        const maxRow = Math.ceil(canvas1.height / gridSize.verticalSpacing) + 1;
        const maxCol = Math.ceil(canvas1.width / gridSize.width) + 1;

        const blocks = new Map();
        let totalHexes = 0;
        let filledHexes = 0;

        const diffThreshold = opts.diffThreshold || 30; // Color difference threshold

        for (let row = 0; row < maxRow; row++) {
            for (let col = 0; col < maxCol; col++) {
                const center = hexToPixel(row, col, gridSize);

                if (center.x < 0 || center.x >= canvas1.width ||
                    center.y < 0 || center.y >= canvas1.height) {
                    continue;
                }

                totalHexes++;

                // Sample difference within the hex
                const result = this._sampleHexDiff(
                    pixels1,
                    pixels2,
                    canvas1.width,
                    canvas1.height,
                    center.x,
                    center.y,
                    gridSize.radius,
                    diffThreshold
                );

                if (result.coverage >= opts.coverageThreshold) {
                    filledHexes++;

                    const blockData = {
                        row,
                        col,
                        durability: opts.defaultDurability,
                        color: opts.useImageColor && result.avgColor
                            ? result.avgColor
                            : opts.defaultColor
                    };

                    blocks.set(getHexKey(row, col), blockData);
                }
            }
        }

        return { blocks, totalHexes, filledHexes };
    }

    /**
     * Sample pixel differences within a hex area
     * @private
     */
    static _sampleHexDiff(pixels1, pixels2, imageWidth, imageHeight, centerX, centerY, radius, diffThreshold) {
        const sampleSpacing = Math.max(2, Math.floor(radius / 5));
        const innerRadius = radius * Math.sqrt(3) / 2;

        let totalSamples = 0;
        let diffSamples = 0;
        let sumR = 0, sumG = 0, sumB = 0;
        let colorSamples = 0;

        for (let dy = -radius; dy <= radius; dy += sampleSpacing) {
            for (let dx = -innerRadius; dx <= innerRadius; dx += sampleSpacing) {
                const px = Math.round(centerX + dx);
                const py = Math.round(centerY + dy);

                if (px < 0 || px >= imageWidth || py < 0 || py >= imageHeight) {
                    continue;
                }

                const distFromCenter = Math.hypot(dx, dy);
                if (distFromCenter > radius) continue;

                totalSamples++;

                const idx = (py * imageWidth + px) * 4;
                const r1 = pixels1[idx], g1 = pixels1[idx + 1], b1 = pixels1[idx + 2], a1 = pixels1[idx + 3];
                const r2 = pixels2[idx], g2 = pixels2[idx + 1], b2 = pixels2[idx + 2], a2 = pixels2[idx + 3];

                // Calculate color difference
                const colorDiff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) + Math.abs(a1 - a2);

                if (colorDiff > diffThreshold) {
                    diffSamples++;
                    // Use color from second image (the "after" state)
                    if (a2 > 0) {
                        sumR += r2;
                        sumG += g2;
                        sumB += b2;
                        colorSamples++;
                    }
                }
            }
        }

        const coverage = totalSamples > 0 ? diffSamples / totalSamples : 0;

        let avgColor = null;
        if (colorSamples > 0) {
            const avgR = Math.round(sumR / colorSamples);
            const avgG = Math.round(sumG / colorSamples);
            const avgB = Math.round(sumB / colorSamples);
            avgColor = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
        }

        return { coverage, avgColor };
    }

    /**
     * Get preview data for blockify operation
     * @param {HTMLImageElement} image - Source image
     * @param {BlockifyOptions} options - Options
     * @returns {Array<{row: number, col: number, coverage: number, color: string}>}
     */
    static getPreview(image, options = {}) {
        const result = this.analyzeAlpha(image, options);
        const preview = [];

        for (const [key, block] of result.blocks) {
            preview.push({
                row: block.row,
                col: block.col,
                color: block.color
            });
        }

        return preview;
    }
}
