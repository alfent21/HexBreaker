/**
 * LayerSerializer.js - Layer Serialization Service
 *
 * Handles serialization and deserialization of layer data.
 * Extracted from LayerManager.js for single responsibility.
 */

/**
 * Layer serialization utilities
 */
export class LayerSerializer {
    /**
     * Serialize layers for saving (.hbp project file)
     * @param {Object} data - { baseLayer, layers }
     * @returns {Object}
     */
    static serialize(data) {
        const { baseLayer, layers } = data;
        const result = {
            baseLayer: null,
            layers: []
        };

        // Serialize base layer
        if (baseLayer) {
            result.baseLayer = {
                id: baseLayer.id,
                name: baseLayer.name,
                type: 'base',
                width: baseLayer.width,
                height: baseLayer.height,
                imageData: baseLayer.imageData,
                backgroundColor: baseLayer.backgroundColor
            };
        }

        // Serialize regular layers
        result.layers = layers.map(layer => {
            if (layer.type === 'image') {
                return {
                    id: layer.id,
                    name: layer.name,
                    type: 'image',
                    visible: layer.visible,
                    zIndex: layer.zIndex,
                    imageData: layer.imageData
                };
            } else {
                return {
                    id: layer.id,
                    name: layer.name,
                    type: 'block',
                    visible: layer.visible,
                    zIndex: layer.zIndex,
                    sourceLayerId: layer.sourceLayerId,
                    blocks: Array.from(layer.blocks.entries())
                };
            }
        });

        return result;
    }

    /**
     * Deserialize layers from saved data (async - loads images)
     * @param {Object} data - Serialized layer data
     * @returns {Promise<Object>} - { baseLayer, layers, nextId, gameAreaSize }
     */
    static async deserialize(data) {
        const result = {
            baseLayer: null,
            layers: [],
            nextId: 1,
            gameAreaSize: null
        };

        // Handle both old format (array) and new format (object with baseLayer)
        const layersData = Array.isArray(data) ? data : (data.layers || []);
        const baseLayerData = Array.isArray(data) ? null : data.baseLayer;

        // Restore base layer first
        if (baseLayerData) {
            if (baseLayerData.imageData) {
                // Load base layer image
                const img = await this._loadImage(baseLayerData.imageData);

                result.baseLayer = {
                    id: 0,
                    name: baseLayerData.name || 'ベース',
                    type: 'base',
                    visible: true,
                    zIndex: 0,
                    width: baseLayerData.width,
                    height: baseLayerData.height,
                    image: img,
                    imageData: baseLayerData.imageData,
                    backgroundColor: null
                };
            } else {
                // Solid color base layer
                result.baseLayer = {
                    id: 0,
                    name: baseLayerData.name || 'ベース',
                    type: 'base',
                    visible: true,
                    zIndex: 0,
                    width: baseLayerData.width,
                    height: baseLayerData.height,
                    image: null,
                    imageData: null,
                    backgroundColor: baseLayerData.backgroundColor || '#FFFFFF'
                };
            }

            result.gameAreaSize = {
                width: baseLayerData.width,
                height: baseLayerData.height
            };
        }

        // Restore regular layers
        for (const layerData of layersData) {
            if (layerData.type === 'image') {
                // Load image from base64
                const img = await this._loadImage(layerData.imageData);

                // Set game area from first image (fallback for old format)
                if (!result.gameAreaSize) {
                    result.gameAreaSize = { width: img.width, height: img.height };
                }

                result.layers.push({
                    id: layerData.id,
                    name: layerData.name,
                    type: 'image',
                    image: img,
                    imageData: layerData.imageData,
                    visible: layerData.visible,
                    zIndex: layerData.zIndex
                });
            } else if (layerData.type === 'block') {
                result.layers.push({
                    id: layerData.id,
                    name: layerData.name,
                    type: 'block',
                    visible: layerData.visible,
                    zIndex: layerData.zIndex,
                    sourceLayerId: layerData.sourceLayerId,
                    blocks: new Map(layerData.blocks)
                });
            }

            if (layerData.id >= result.nextId) {
                result.nextId = layerData.id + 1;
            }
        }

        return result;
    }

    /**
     * Load layers from stage data (synchronous - images may load async)
     * @param {Object} stageData - Stage data
     * @returns {Object} - { baseLayer, layers, nextId, gameAreaSize }
     */
    static loadFromStage(stageData) {
        const result = {
            baseLayer: null,
            layers: [],
            nextId: 1,
            gameAreaSize: null
        };

        // Handle both old format (array) and new format (object with baseLayer)
        const stageLayers = Array.isArray(stageData) ? stageData : (stageData.layers || []);
        const baseLayerData = Array.isArray(stageData) ? null : stageData.baseLayer;

        // Load base layer
        if (baseLayerData) {
            let img = baseLayerData.image;
            if (!img && baseLayerData.imageData) {
                img = new Image();
                img.src = baseLayerData.imageData;
            }

            result.baseLayer = {
                id: 0,
                name: baseLayerData.name || 'ベース',
                type: 'base',
                visible: true,
                zIndex: 0,
                width: baseLayerData.width,
                height: baseLayerData.height,
                image: img,
                imageData: baseLayerData.imageData || null,
                backgroundColor: baseLayerData.backgroundColor || null
            };

            result.gameAreaSize = {
                width: baseLayerData.width,
                height: baseLayerData.height
            };
        }

        // Load regular layers
        for (const layerData of stageLayers) {
            if (layerData.type === 'image') {
                // If image element doesn't exist, create placeholder
                let img = layerData.image;
                if (!img && layerData.imageData) {
                    img = new Image();
                    img.src = layerData.imageData;
                }

                result.layers.push({
                    id: layerData.id,
                    name: layerData.name,
                    type: 'image',
                    image: img,
                    imageData: layerData.imageData,
                    visible: layerData.visible !== false,
                    zIndex: layerData.zIndex || 0
                });

                // Fallback: set game area from first image (old format)
                if (!result.gameAreaSize && img) {
                    result.gameAreaSize = { width: img.width, height: img.height };
                }
            } else if (layerData.type === 'block') {
                // Convert array blocks to Map if necessary
                let blocks = layerData.blocks;
                if (Array.isArray(blocks)) {
                    blocks = new Map(blocks);
                } else if (!(blocks instanceof Map)) {
                    blocks = new Map();
                }

                result.layers.push({
                    id: layerData.id,
                    name: layerData.name,
                    type: 'block',
                    visible: layerData.visible !== false,
                    zIndex: layerData.zIndex || 0,
                    blocks: blocks,
                    sourceLayerId: layerData.sourceLayerId || null
                });
            }

            if (layerData.id >= result.nextId) {
                result.nextId = layerData.id + 1;
            }
        }

        return result;
    }

    /**
     * Serialize layers for stage storage
     * @param {Object} data - { baseLayer, layers }
     * @returns {Object}
     */
    static serializeForStage(data) {
        const { baseLayer, layers } = data;
        const result = {
            baseLayer: null,
            layers: []
        };

        // Serialize base layer
        if (baseLayer) {
            result.baseLayer = {
                id: baseLayer.id,
                name: baseLayer.name,
                type: 'base',
                width: baseLayer.width,
                height: baseLayer.height,
                imageData: baseLayer.imageData,
                backgroundColor: baseLayer.backgroundColor
            };
        }

        // Serialize regular layers
        result.layers = layers.map(layer => {
            if (layer.type === 'image') {
                return {
                    id: layer.id,
                    name: layer.name,
                    type: 'image',
                    visible: layer.visible,
                    zIndex: layer.zIndex,
                    imageData: layer.imageData
                };
            } else {
                return {
                    id: layer.id,
                    name: layer.name,
                    type: 'block',
                    visible: layer.visible,
                    zIndex: layer.zIndex,
                    sourceLayerId: layer.sourceLayerId,
                    blocks: layer.blocks instanceof Map
                        ? Array.from(layer.blocks.entries())
                        : layer.blocks
                };
            }
        });

        return result;
    }

    /**
     * Load image from data URL
     * @param {string} dataURL
     * @returns {Promise<HTMLImageElement>}
     * @private
     */
    static _loadImage(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataURL;
        });
    }
}
