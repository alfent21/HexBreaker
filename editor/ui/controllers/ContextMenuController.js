/**
 * ContextMenuController.js - Context Menu Controller
 *
 * Handles right-click context menu for layer operations.
 * Extracted from UIController.js for single responsibility.
 */

import { dialogService } from '../DialogService.js';

export class ContextMenuController {
    /**
     * @param {import('../../core/Editor.js').Editor} editor
     * @param {Function} addMessage - Message callback function
     * @param {Function} updateLayerList - Layer list update callback
     * @param {Function} showBlockifyDialog - Blockify dialog callback
     */
    constructor(editor, addMessage, updateLayerList, showBlockifyDialog) {
        this.editor = editor;
        this._addMessage = addMessage;
        this._updateLayerList = updateLayerList;
        this._showBlockifyDialog = showBlockifyDialog;

        // DOM element references
        this.elements = {};

        // Current context layer ID
        this._currentLayerId = null;
    }

    /**
     * Initialize the controller
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
        this.elements = {
            contextMenu: elements.contextMenu,
            layerList: elements.layerList
        };
    }

    /**
     * Validate required elements exist
     * @private
     */
    _validateElements() {
        if (!this.elements.contextMenu) {
            throw new Error('[ContextMenuController] Required element "contextMenu" not found');
        }
        if (!this.elements.layerList) {
            console.warn('[ContextMenuController] layerList element not found - context menu trigger disabled');
        }
    }

    /**
     * Bind event listeners
     * @private
     */
    _bindEvents() {
        const contextMenu = this.elements.contextMenu;

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                this.hide();
            }
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        });

        // Right-click on layer list
        if (this.elements.layerList) {
            this.elements.layerList.addEventListener('contextmenu', (e) => {
                const layerItem = e.target.closest('.layer-item');
                if (layerItem) {
                    e.preventDefault();
                    const layerId = parseInt(layerItem.dataset.layerId);
                    this.show(e.clientX, e.clientY, layerId);
                }
            });
        }
    }

    /**
     * Show context menu for a layer
     * @param {number} x - Mouse X position
     * @param {number} y - Mouse Y position
     * @param {number} layerId - Layer ID
     */
    show(x, y, layerId) {
        const menu = this.elements.contextMenu;
        if (!menu) return;

        // ベースレイヤーの場合は特別処理
        const isBaseLayer = layerId === 0;
        const layer = isBaseLayer
            ? this.editor.layerManager.getBaseLayer()
            : this.editor.layerManager.getLayer(layerId);
        if (!layer) return;

        this._currentLayerId = layerId;

        // Build menu items based on layer type
        const items = this._buildMenuItems(layer, isBaseLayer);

        // Render menu
        menu.innerHTML = items.map(item => {
            if (item.type === 'separator') {
                return '<div class="context-menu-separator"></div>';
            }
            return `
                <div class="context-menu-item ${item.danger ? 'danger' : ''}" data-action="${item.action}">
                    <span class="context-menu-icon">${item.icon}</span>
                    <span class="context-menu-label">${item.label}</span>
                </div>
            `;
        }).join('');

        // Bind click handlers
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                this._executeAction(item.dataset.action);
                this.hide();
            });
        });

        // Position menu
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.classList.remove('hidden');

        // Adjust if off-screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 10}px`;
        }
    }

    /**
     * Build menu items based on layer type
     * @private
     */
    _buildMenuItems(layer, isBaseLayer) {
        const items = [];

        if (isBaseLayer) {
            // ベースレイヤー専用メニュー
            items.push({ label: '名前を変更', action: 'rename', icon: '✏️' });
            items.push({ label: '画像を差し替え', action: 'replace-image', icon: '🖼️' });
        } else {
            // 通常レイヤーメニュー
            items.push({ label: '名前を変更', action: 'rename', icon: '✏️' });
            items.push({ label: '複製', action: 'duplicate', icon: '📋' });
            items.push({ type: 'separator' });

            // Image layer specific
            if (layer.type === 'image') {
                items.push({ label: 'ブロック化...', action: 'blockify', icon: '🧱' });
                items.push({ type: 'separator' });
            }

            // Block layer specific
            if (layer.type === 'block') {
                items.push({ label: 'ソース画像を設定...', action: 'set-source-image', icon: '🔗' });
                items.push({ label: 'ブロックをクリア', action: 'clear-blocks', icon: '🗑️' });
                items.push({ type: 'separator' });
            }

            items.push({ label: '上へ移動', action: 'move-up', icon: '⬆️' });
            items.push({ label: '下へ移動', action: 'move-down', icon: '⬇️' });
            items.push({ type: 'separator' });
            items.push({ label: '削除', action: 'delete', icon: '🗑️', danger: true });
        }

        return items;
    }

    /**
     * Hide context menu
     */
    hide() {
        this.elements.contextMenu?.classList.add('hidden');
        this._currentLayerId = null;
    }

    /**
     * Execute context menu action
     * @private
     */
    async _executeAction(action) {
        const layerId = this._currentLayerId;
        if (layerId === null || layerId === undefined) return;

        // ベースレイヤーの場合は特別処理
        const isBaseLayer = layerId === 0;
        const layer = isBaseLayer
            ? this.editor.layerManager.getBaseLayer()
            : this.editor.layerManager.getLayer(layerId);
        if (!layer) return;

        switch (action) {
            case 'rename':
                this._handleRename(layer, layerId, isBaseLayer);
                break;

            case 'replace-image':
                this._handleReplaceImage();
                break;

            case 'duplicate':
                this._handleDuplicate(layerId);
                break;

            case 'blockify':
                this._showBlockifyDialog(layerId);
                break;

            case 'clear-blocks':
                await this._handleClearBlocks(layer);
                break;

            case 'set-source-image':
                this._handleSetSourceImage(layer, layerId);
                break;

            case 'move-up':
                this.editor.layerManager.moveUp(layerId);
                break;

            case 'move-down':
                this.editor.layerManager.moveDown(layerId);
                break;

            case 'delete':
                await this._handleDelete(layer, layerId);
                break;
        }
    }

    /**
     * Handle rename action
     * @private
     */
    _handleRename(layer, layerId, isBaseLayer) {
        const newName = prompt('新しい名前:', layer.name);
        if (newName && newName !== layer.name) {
            if (isBaseLayer) {
                layer.name = newName;
                this._updateLayerList();
            } else {
                this.editor.layerManager.renameLayer(layerId, newName);
            }
        }
    }

    /**
     * Handle replace image action (base layer only)
     * @private
     */
    _handleReplaceImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await this.editor.layerManager.updateBaseLayerFromFile(file);
                    this.editor.render();
                    this._addMessage('info', '画像を差し替えました');
                } catch (error) {
                    this._addMessage('error', `画像の差し替えに失敗: ${error.message}`);
                }
            }
        };
        input.click();
    }

    /**
     * Handle duplicate action
     * @private
     */
    _handleDuplicate(layerId) {
        try {
            const newLayer = this.editor.layerManager.duplicateLayer(layerId);
            this._addMessage('info', `レイヤー「${newLayer.name}」を作成しました`);
        } catch (error) {
            this._addMessage('error', `複製に失敗しました: ${error.message}`);
        }
    }

    /**
     * Handle clear blocks action
     * @private
     */
    async _handleClearBlocks(layer) {
        if (layer.type === 'block' && await dialogService.confirm('すべてのブロックを削除しますか？', { type: 'danger' })) {
            layer.blocks.clear();
            this.editor.render();
            this._addMessage('info', 'ブロックをクリアしました');
        }
    }

    /**
     * Handle set source image action
     * @private
     */
    _handleSetSourceImage(layer, layerId) {
        if (layer.type !== 'block') return;

        // 利用可能な画像レイヤーを取得
        const imageLayers = this.editor.layerManager.getImageLayers();

        if (imageLayers.length === 0) {
            this._addMessage('warning', '画像レイヤーがありません');
            return;
        }

        // 選択肢を構築（現在リンク中のものにマーク、解除オプションも含む）
        const currentSourceId = layer.sourceLayerId;
        const options = imageLayers.map(imgLayer => {
            const isCurrent = imgLayer.id === currentSourceId;
            return `${imgLayer.id}: ${imgLayer.name}${isCurrent ? ' (現在)' : ''}`;
        });

        // 解除オプションを追加
        if (currentSourceId !== null) {
            options.unshift('0: リンクを解除');
        }

        const choice = prompt(
            `ソース画像を選択してください:\n\n${options.join('\n')}\n\n番号を入力:`,
            currentSourceId !== null ? String(currentSourceId) : ''
        );

        if (choice === null) return; // キャンセル

        const selectedId = parseInt(choice);
        if (isNaN(selectedId)) {
            this._addMessage('error', '無効な入力です');
            return;
        }

        if (selectedId === 0) {
            // リンク解除
            this.editor.layerManager.setBlockLayerSource(layerId, null);
            this._addMessage('info', 'ソース画像のリンクを解除しました');
        } else {
            // 指定IDの画像レイヤーを検証
            const targetLayer = imageLayers.find(l => l.id === selectedId);
            if (!targetLayer) {
                this._addMessage('error', '指定された画像レイヤーが見つかりません');
                return;
            }
            this.editor.layerManager.setBlockLayerSource(layerId, selectedId);
            this._addMessage('info', `ソース画像を「${targetLayer.name}」に設定しました`);
        }
        this.editor.render();
    }

    /**
     * Handle delete action
     * @private
     */
    async _handleDelete(layer, layerId) {
        if (await dialogService.confirm(`レイヤー「${layer.name}」を削除しますか？`, { type: 'danger' })) {
            this.editor.layerManager.removeLayer(layerId);
        }
    }
}
