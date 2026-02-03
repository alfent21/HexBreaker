/**
 * BlockifyService.js - Image to Block Conversion Service
 *
 * Handles conversion of image layers to block data.
 * Extracted from LayerManager.js for single responsibility.
 */

import { ImageAnalyzer } from '../utils/ImageAnalyzer.js';

/**
 * Blockify service for converting images to blocks
 */
export class BlockifyService {
    /**
     * Generate blocks from an image layer
     * @param {Object} imageLayer - Source image layer
     * @param {Object} options - Blockify options
     * @param {string} [options.gridSize='medium'] - Grid size
     * @param {number} [options.alphaThreshold=128] - Alpha threshold (0-255)
     * @param {number} [options.coverageThreshold=0.3] - Minimum hex coverage (0-1)
     * @param {number} [options.defaultDurability=1] - Default block durability
     * @param {string} [options.defaultColor='#64B5F6'] - Default block color
     * @param {boolean} [options.useImageColor=true] - Extract color from image
     * @returns {{blocks: Map<string, Object>, totalHexes: number, filledHexes: number}}
     */
    static blockify(imageLayer, options = {}) {
        if (!imageLayer || imageLayer.type !== 'image') {
            throw new Error('有効な画像レイヤーを指定してください');
        }

        if (!imageLayer.image) {
            throw new Error('画像が読み込まれていません');
        }

        return ImageAnalyzer.analyzeAlpha(imageLayer.image, options);
    }

    /**
     * Generate blocks from difference between two images
     * @param {Object} beforeLayer - "Before" image layer
     * @param {Object} afterLayer - "After" image layer
     * @param {Object} options - Blockify options
     * @returns {{blocks: Map<string, Object>, totalHexes: number, filledHexes: number}}
     */
    static blockifyDiff(beforeLayer, afterLayer, options = {}) {
        if (!beforeLayer || beforeLayer.type !== 'image') {
            throw new Error('有効な「前」画像レイヤーを指定してください');
        }
        if (!afterLayer || afterLayer.type !== 'image') {
            throw new Error('有効な「後」画像レイヤーを指定してください');
        }

        if (!beforeLayer.image || !afterLayer.image) {
            throw new Error('画像が読み込まれていません');
        }

        return ImageAnalyzer.analyzeDiff(
            beforeLayer.image,
            afterLayer.image,
            options
        );
    }

    /**
     * Get blockify preview without creating layer
     * @param {Object} imageLayer - Source image layer
     * @param {Object} options - Blockify options
     * @returns {{blocks: Map<string, Object>, totalHexes: number, filledHexes: number}}
     */
    static getPreview(imageLayer, options = {}) {
        if (!imageLayer || imageLayer.type !== 'image' || !imageLayer.image) {
            return { blocks: new Map(), totalHexes: 0, filledHexes: 0 };
        }

        return ImageAnalyzer.analyzeAlpha(imageLayer.image, options);
    }

    /**
     * Apply blockify result to a block layer
     * @param {Object} blockLayer - Target block layer
     * @param {Map<string, Object>} blocks - Generated blocks
     * @param {number} sourceLayerId - Source image layer ID
     * @param {Object} options
     * @param {boolean} [options.mergeBlocks=false] - Merge with existing blocks
     */
    static applyToLayer(blockLayer, blocks, sourceLayerId, options = {}) {
        if (!blockLayer || blockLayer.type !== 'block') {
            throw new Error('有効なブロックレイヤーを指定してください');
        }

        if (options.mergeBlocks) {
            // Merge with existing blocks
            for (const [key, block] of blocks) {
                if (!blockLayer.blocks.has(key)) {
                    blockLayer.blocks.set(key, block);
                }
            }
        } else {
            // Replace existing blocks
            blockLayer.blocks = blocks;
        }

        // Link to source image
        blockLayer.sourceLayerId = sourceLayerId;
    }
}
