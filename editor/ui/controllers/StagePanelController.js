/**
 * StagePanelController.js - Stage Panel Controller
 *
 * Handles stage list display, selection, creation, and deletion.
 * Extracted from UIController.js for single responsibility.
 */

export class StagePanelController {
    /**
     * @param {import('../../core/Editor.js').Editor} editor
     * @param {Function} addMessage - Message callback function
     */
    constructor(editor, addMessage) {
        this.editor = editor;
        this._addMessage = addMessage;

        // DOM element references
        this.elements = {};
    }

    /**
     * Initialize the controller
     * @param {Object} elements - Cached DOM elements from UIController
     */
    init(elements) {
        this._cacheElements(elements);
        this._validateElements();
        this._bindEvents();
        this._bindEditorEvents();
        this.updateStageSelector();
        this.updateStageList();
    }

    /**
     * Cache DOM element references
     * @private
     */
    _cacheElements(elements) {
        this.elements = {
            // Toolbar
            stageSelect: elements.stageSelect,
            addStageBtn: elements.addStageBtn,

            // Panel
            stageList: elements.stageList,
            createStageBtn: elements.createStageBtn,

            // Dialog
            newStageDialog: elements.newStageDialog,
            newStageName: elements.newStageName,
            newStageImage: elements.newStageImage,
            newStageWidth: elements.newStageWidth,
            newStageHeight: elements.newStageHeight,
            newStageCancelBtn: elements.newStageCancelBtn,
            newStageCreateBtn: elements.newStageCreateBtn,
            newStageCloseBtn: elements.newStageCloseBtn
        };
    }

    /**
     * Validate required elements exist
     * @private
     */
    _validateElements() {
        // stageList and stageSelect are important for core functionality
        if (!this.elements.stageList) {
            console.warn('[StagePanelController] stageList element not found - panel display disabled');
        }
        if (!this.elements.stageSelect) {
            console.warn('[StagePanelController] stageSelect element not found - selector disabled');
        }
        if (!this.elements.newStageDialog) {
            console.warn('[StagePanelController] newStageDialog element not found - dialog disabled');
        }
    }

    /**
     * Bind event listeners
     * @private
     */
    _bindEvents() {
        // Stage selector
        if (this.elements.stageSelect) {
            this.elements.stageSelect.addEventListener('change', (e) => {
                this.editor.switchStage(e.target.value);
            });
        }

        // Add stage button (toolbar)
        if (this.elements.addStageBtn) {
            this.elements.addStageBtn.addEventListener('click', () => {
                this.showNewStageDialog();
            });
        }

        // Create stage button (panel)
        if (this.elements.createStageBtn) {
            this.elements.createStageBtn.addEventListener('click', () => {
                this.showNewStageDialog();
            });
        }

        // Dialog buttons
        if (this.elements.newStageCloseBtn) {
            this.elements.newStageCloseBtn.addEventListener('click', () => this.hideNewStageDialog());
        }
        if (this.elements.newStageCancelBtn) {
            this.elements.newStageCancelBtn.addEventListener('click', () => this.hideNewStageDialog());
        }
        if (this.elements.newStageCreateBtn) {
            this.elements.newStageCreateBtn.addEventListener('click', () => this._createNewStage());
        }

        // Auto-fill size from image
        if (this.elements.newStageImage) {
            this.elements.newStageImage.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const img = new Image();
                    img.onload = () => {
                        if (this.elements.newStageWidth) {
                            this.elements.newStageWidth.value = img.width;
                        }
                        if (this.elements.newStageHeight) {
                            this.elements.newStageHeight.value = img.height;
                        }
                    };
                    img.src = URL.createObjectURL(file);
                }
            });
        }
    }

    /**
     * Bind editor event handlers
     * @private
     */
    _bindEditorEvents() {
        this.editor.on('stagesChanged', () => {
            this.updateStageSelector();
            this.updateStageList();
        });
        this.editor.on('currentStageChanged', (stage) => this._onStageChanged(stage));
    }

    /**
     * Show new stage dialog
     */
    showNewStageDialog() {
        const dialog = this.elements.newStageDialog;
        if (!dialog) {
            this._addMessage('error', '[StagePanelController] Dialog element not found');
            return;
        }

        // Reset form
        if (this.elements.newStageName) {
            this.elements.newStageName.value = '';
        }
        if (this.elements.newStageImage) {
            this.elements.newStageImage.value = '';
        }
        if (this.elements.newStageWidth) {
            this.elements.newStageWidth.value = '1280';
        }
        if (this.elements.newStageHeight) {
            this.elements.newStageHeight.value = '720';
        }
        document.querySelector('input[name="grid-size"][value="medium"]')?.click();

        dialog.classList.remove('hidden');
    }

    /**
     * Hide new stage dialog
     */
    hideNewStageDialog() {
        if (this.elements.newStageDialog) {
            this.elements.newStageDialog.classList.add('hidden');
        }
    }

    /**
     * Create new stage from dialog
     * @private
     */
    async _createNewStage() {
        const name = this.elements.newStageName?.value || `Stage ${this.editor.getAllStages().length + 1}`;
        let width = parseInt(this.elements.newStageWidth?.value) || 1280;
        let height = parseInt(this.elements.newStageHeight?.value) || 720;
        const gridSize = document.querySelector('input[name="grid-size"]:checked')?.value || 'medium';
        const imageFile = this.elements.newStageImage?.files?.[0];

        // If image provided, ensure we get actual image dimensions
        if (imageFile) {
            try {
                const dimensions = await this._getImageDimensions(imageFile);
                width = dimensions.width;
                height = dimensions.height;
                this._addMessage('info', `[DEBUG] 画像サイズ取得: ${width}x${height}`);
            } catch (error) {
                this._addMessage('warning', `画像サイズ取得失敗: ${error.message}`);
            }
        }

        // Create stage with correct dimensions
        const stage = this.editor.createStage({
            name,
            width,
            height,
            gridSize
        });

        this._addMessage('info', `[DEBUG] ステージ作成: キャンバスサイズ ${width}x${height}`);

        // If base image provided, add it as first layer
        if (imageFile && stage) {
            try {
                await this.editor.addImageLayer(imageFile);
                this._addMessage('info', `[DEBUG] 画像レイヤー追加完了`);
            } catch (error) {
                this._addMessage('error', `画像の追加に失敗: ${error.message}`);
            }
        }

        this.hideNewStageDialog();
        this.updateStageSelector();
    }

    /**
     * Get image dimensions from file
     * @private
     * @param {File} file
     * @returns {Promise<{width: number, height: number}>}
     */
    _getImageDimensions(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                resolve({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                reject(new Error('Failed to load image'));
            };
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Update stage selector dropdown
     */
    updateStageSelector() {
        const select = this.elements.stageSelect;
        if (!select) return;

        const stages = this.editor.getAllStages();
        const currentStage = this.editor.getCurrentStage();

        select.innerHTML = stages.map(stage =>
            `<option value="${stage.id}" ${stage.id === currentStage?.id ? 'selected' : ''}>
                ${stage.name}
            </option>`
        ).join('');
    }

    /**
     * Update stage list in panel
     */
    updateStageList() {
        const list = this.elements.stageList;
        if (!list) return;

        const stages = this.editor.getAllStages();
        const currentStage = this.editor.getCurrentStage();

        if (stages.length === 0) {
            list.innerHTML = '<div class="empty-message">ステージがありません</div>';
            return;
        }

        list.innerHTML = stages.map((stage, index) => {
            const isBaseStage = index === 0;
            const canDelete = !isBaseStage && stages.length > 1;

            return `
                <div class="stage-item ${stage.id === currentStage?.id ? 'active' : ''} ${isBaseStage ? 'base-stage' : ''}" data-stage-id="${stage.id}">
                    <span class="stage-name">${stage.name}${isBaseStage ? ' <span class="stage-badge">ベース</span>' : ''}</span>
                    <span class="stage-info">${stage.canvas.width}×${stage.canvas.height}</span>
                    <div class="stage-actions">
                        <button class="btn btn--icon btn--small stage-duplicate-btn" data-stage-id="${stage.id}" title="複製">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn--icon btn--small stage-delete-btn" data-stage-id="${stage.id}" title="削除" ${canDelete ? '' : 'disabled'}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Bind click events for stage selection
        list.querySelectorAll('.stage-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.stage-actions')) return;
                const stageId = item.dataset.stageId;
                this.editor.switchStage(stageId);
            });
        });

        // Bind duplicate buttons
        list.querySelectorAll('.stage-duplicate-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const stageId = btn.dataset.stageId;
                this.editor.duplicateStage(stageId);
            });
        });

        // Bind delete buttons
        list.querySelectorAll('.stage-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const stageId = btn.dataset.stageId;
                if (confirm('このステージを削除しますか？')) {
                    this.editor.deleteStage(stageId);
                }
            });
        });
    }

    /**
     * Handle stage change
     * @private
     */
    _onStageChanged(stage) {
        this.updateStageSelector();
        this.updateStageList();

        if (stage) {
            this._addMessage('info', `ステージ「${stage.name}」を選択しました`);
        }
    }
}
