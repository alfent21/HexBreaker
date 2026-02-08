/**
 * StartupManager.js - 起動フロー管理
 *
 * 起動時のダイアログ表示、新規プロジェクトウィザード、
 * IndexedDBからの自動復元を担当。
 */

import { BG_COLOR_PRESETS } from './LayerManager.js';
import { fileManager } from '../systems/FileManager.js';

/**
 * @typedef {Object} WizardState
 * @property {number} step - Current wizard step (1-3)
 * @property {File|null} imageFile - Selected image file
 * @property {string|null} imageData - Base64 image data
 * @property {number} imageWidth - Image width
 * @property {number} imageHeight - Image height
 * @property {boolean} solidColorMode - Using solid color instead of image
 * @property {string} backgroundColor - Solid color (#RRGGBB)
 * @property {number} manualWidth - Manual width input
 * @property {number} manualHeight - Manual height input
 * @property {string} extraAreaMode - 'external' | 'none'
 * @property {string} extraAreaPosition - 'top' | 'bottom' | 'left' | 'right'
 * @property {number} extraAreaSize - Extra area size in px
 * @property {string} paddleAxisPreset - 'auto' | 'none'
 * @property {string} missLinePreset - 'auto' | 'none'
 * @property {string} gridSize - 'small' | 'medium' | 'large'
 */

export class StartupManager {
    /**
     * @param {import('../core/Editor.js').Editor} editor
     */
    constructor(editor) {
        this.editor = editor;
        this.loadingFromStartup = false;

        /** @type {WizardState} */
        this.wizardState = this._createInitialState();
    }

    /**
     * Create initial wizard state
     * @private
     * @returns {WizardState}
     */
    _createInitialState() {
        return {
            step: 1,
            imageFile: null,
            imageData: null,
            imageWidth: 0,
            imageHeight: 0,
            solidColorMode: false,
            backgroundColor: '#808080',
            manualWidth: 1280,
            manualHeight: 720,
            extraAreaMode: 'none',
            extraAreaPosition: 'bottom',
            extraAreaSize: 100,
            paddleAxisPreset: 'auto',
            missLinePreset: 'auto',
            gridSize: 'medium'
        };
    }

    /**
     * Initialize startup manager and setup event listeners
     */
    setup() {
        this._setupStartupDialog();
        this._setupNewProjectWizard();
    }

    /**
     * Check and handle startup flow
     * @returns {Promise<boolean>} True if project was restored
     */
    async checkStartup() {
        try {
            // IndexedDBから復元を試みる
            const restored = await this.editor.projectFileSystem.restoreFromLocalStorage();

            if (restored) {
                this._hideStartupDialog();
                this.editor.emit('message', { type: 'success', text: '前回のプロジェクトを復元しました' });
                return true;
            }
        } catch (e) {
            this.editor.emit('message', { type: 'error', text: `復元失敗: ${e.message}` });
            await this.editor.projectFileSystem.clearLocalStorage();
        }

        this.editor.emit('message', { type: 'warning', text: '保存データなし - 新規作成してください' });

        // Show startup dialog
        this._showStartupDialog();
        return false;
    }

    /**
     * Save current project to IndexedDB
     */
    saveToLocalStorage() {
        return this.editor.projectFileSystem.saveToLocalStorage();
    }

    /**
     * Clear saved project from IndexedDB
     */
    async clearLocalStorage() {
        await this.editor.projectFileSystem.clearLocalStorage();
    }

    // ==================== Startup Dialog ====================

    /**
     * @private
     */
    _setupStartupDialog() {
        const dialog = document.getElementById('startup-dialog');
        if (!dialog) return;

        const btnNew = document.getElementById('btn-startup-new');
        const btnOpen = document.getElementById('btn-startup-open');

        btnNew?.addEventListener('click', () => {
            this._hideStartupDialog();
            this.showWizard();
        });

        btnOpen?.addEventListener('click', async () => {
            this._hideStartupDialog();
            const success = await this.editor.projectFileSystem.openProject();
            if (!success) {
                // キャンセルまたは失敗時はダイアログを再表示
                this._showStartupDialog();
            }
        });
    }

    /**
     * @private
     */
    _showStartupDialog() {
        document.getElementById('startup-dialog')?.classList.remove('hidden');
    }

    /**
     * @private
     */
    _hideStartupDialog() {
        document.getElementById('startup-dialog')?.classList.add('hidden');
    }

    /**
     * Handle file load cancel from startup
     */
    handleFileLoadCancel() {
        if (this.loadingFromStartup) {
            this.loadingFromStartup = false;
            this._showStartupDialog();
        }
    }

    /**
     * Handle file load success
     */
    handleFileLoadSuccess() {
        this.loadingFromStartup = false;
    }

    // ==================== New Project Wizard ====================

    /**
     * @private
     */
    _setupNewProjectWizard() {
        const state = this.wizardState;

        // Step 1: Image/Size selection
        this._setupStep1();

        // Step 2: Paddle area settings
        this._setupStep2();

        // Step 3: Grid size and summary
        this._setupStep3();

        // Cancel buttons (in wizard footer, enabled only when project is already loaded)
        ['btn-wizard-cancel-1', 'btn-wizard-cancel-2', 'btn-wizard-cancel-3'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => {
                document.getElementById('new-project-wizard')?.classList.add('hidden');
            });
        });
    }

    /**
     * Setup Step 1: Base layer selection
     * @private
     */
    _setupStep1() {
        const state = this.wizardState;
        const dropZone = document.getElementById('wizard-drop-zone');
        const btnNext = document.getElementById('btn-wizard-step1-next');

        // Tab switching (image / solid color)
        document.querySelectorAll('#wizard-base-tabs .wizard-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                // Update tab active state
                document.querySelectorAll('#wizard-base-tabs .wizard-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Show/hide tab content
                const imageContent = document.getElementById('wizard-tab-image');
                const solidContent = document.getElementById('wizard-tab-solid');
                if (tabName === 'image') {
                    imageContent.classList.remove('hidden');
                    solidContent.classList.add('hidden');
                    state.solidColorMode = false;
                } else {
                    imageContent.classList.add('hidden');
                    solidContent.classList.remove('hidden');
                    state.solidColorMode = true;
                }
                this._updateStep1NextButton();
            });
        });

        // Drag and drop
        dropZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone?.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer?.files[0];
            if (file?.type.startsWith('image/')) {
                this._handleImageSelect(file);
            }
        });

        // Image select button
        document.getElementById('btn-wizard-select-image')?.addEventListener('click', () => {
            document.getElementById('file-input-wizard-image')?.click();
        });

        // File input change
        document.getElementById('file-input-wizard-image')?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                this._handleImageSelect(file);
            }
        });

        // Clear image button
        document.getElementById('btn-wizard-clear-image')?.addEventListener('click', () => {
            this._clearImageSelection();
        });

        // Background color presets
        document.querySelectorAll('.bg-color-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.bg-color-preset').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                state.backgroundColor = btn.dataset.color;
            });
        });

        // Size presets
        document.querySelectorAll('.size-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const w = parseInt(btn.dataset.width);
                const h = parseInt(btn.dataset.height);
                document.getElementById('wizard-width').value = w;
                document.getElementById('wizard-height').value = h;
                state.manualWidth = w;
                state.manualHeight = h;
            });
        });

        // Manual size inputs
        document.getElementById('wizard-width')?.addEventListener('input', (e) => {
            state.manualWidth = parseInt(e.target.value) || 1280;
        });

        document.getElementById('wizard-height')?.addEventListener('input', (e) => {
            state.manualHeight = parseInt(e.target.value) || 720;
        });

        // Next button
        btnNext?.addEventListener('click', () => {
            this._goToStep(2);
        });
    }

    /**
     * Setup Step 2: Paddle area settings
     * @private
     */
    _setupStep2() {
        const state = this.wizardState;

        // Extra area mode cards
        document.querySelectorAll('.extra-area-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.extra-area-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.extraAreaMode = card.dataset.mode;

                const posPanel = document.getElementById('wizard-extra-area-settings');
                if (state.extraAreaMode === 'external') {
                    posPanel?.classList.remove('hidden');
                } else {
                    posPanel?.classList.add('hidden');
                }
            });
        });

        // Extra area position
        document.getElementById('wizard-extra-position')?.addEventListener('change', (e) => {
            state.extraAreaPosition = e.target.value;
        });

        // Extra area size
        document.getElementById('wizard-extra-size')?.addEventListener('input', (e) => {
            state.extraAreaSize = parseInt(e.target.value) || 100;
        });

        // Paddle axis preset
        document.querySelectorAll('.paddle-preset-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.paddle-preset-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.paddleAxisPreset = card.dataset.preset;
            });
        });

        // Missline preset
        document.querySelectorAll('.missline-preset-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.missline-preset-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.missLinePreset = card.dataset.preset;
            });
        });

        // Back button
        document.getElementById('btn-wizard-step2-back')?.addEventListener('click', () => {
            this._goToStep(1);
        });

        // Next button
        document.getElementById('btn-wizard-step2-next')?.addEventListener('click', () => {
            this._goToStep(3);
        });
    }

    /**
     * Setup Step 3: Grid size and confirmation
     * @private
     */
    _setupStep3() {
        const state = this.wizardState;

        // Grid size cards
        document.querySelectorAll('.grid-size-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.grid-size-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.gridSize = card.dataset.size;
                this._updateSummary();
            });
        });

        // Back button
        document.getElementById('btn-wizard-step3-back')?.addEventListener('click', () => {
            this._goToStep(2);
        });

        // Create button
        document.getElementById('btn-wizard-create')?.addEventListener('click', () => {
            this._createProjectFromWizard();
        });
    }

    /**
     * Handle image selection
     * @private
     * @param {File} file
     */
    async _handleImageSelect(file) {
        const state = this.wizardState;

        try {
            // FileManagerを使用して画像を読み込み
            const { image, dataURL, width, height } = await fileManager.loadImageFile(file);

            state.imageFile = file;
            state.imageData = dataURL;
            state.imageWidth = width;
            state.imageHeight = height;

            // Update UI - hide entire drop zone, show preview
            const dropZone = document.getElementById('wizard-drop-zone');
            const previewContainer = document.getElementById('wizard-image-preview');

            dropZone?.classList.add('hidden');
            previewContainer?.classList.remove('hidden');

            document.getElementById('wizard-preview-img').src = dataURL;
            document.getElementById('wizard-image-name').textContent = file.name;
            document.getElementById('wizard-image-size').textContent =
                `${width} x ${height} px`;

            this._updateStep1NextButton();
        } catch (error) {
            console.error('画像読み込みエラー:', error);
            this.editor.emit('message', { type: 'error', text: error.message });
        }
    }

    /**
     * Clear image selection
     * @private
     */
    _clearImageSelection() {
        const state = this.wizardState;
        state.imageFile = null;
        state.imageData = null;
        state.imageWidth = 0;
        state.imageHeight = 0;

        const dropZone = document.getElementById('wizard-drop-zone');
        const previewContainer = document.getElementById('wizard-image-preview');

        dropZone?.classList.remove('hidden');
        previewContainer?.classList.add('hidden');

        this._updateStep1NextButton();
    }

    /**
     * Update Step 1 Next button state
     * @private
     */
    _updateStep1NextButton() {
        const state = this.wizardState;
        const btn = document.getElementById('btn-wizard-step1-next');
        if (btn) {
            btn.disabled = !(state.imageFile || state.solidColorMode);
        }
    }

    /**
     * Go to wizard step
     * @private
     * @param {number} step
     */
    _goToStep(step) {
        this.wizardState.step = step;

        document.querySelectorAll('.wizard-step').forEach(s => s.classList.add('hidden'));
        document.getElementById(`wizard-step-${step}`)?.classList.remove('hidden');

        // Update step indicators
        document.querySelectorAll('.step-indicator').forEach((ind, i) => {
            ind.classList.toggle('active', i + 1 === step);
            ind.classList.toggle('completed', i + 1 < step);
        });

        if (step === 3) {
            this._updateSummary();
        }
    }

    /**
     * Update summary display
     * @private
     */
    _updateSummary() {
        const state = this.wizardState;
        let baseWidth, baseHeight;

        if (state.solidColorMode) {
            baseWidth = state.manualWidth;
            baseHeight = state.manualHeight;
        } else {
            baseWidth = state.imageWidth;
            baseHeight = state.imageHeight;
        }

        // Base layer info
        const baseType = state.solidColorMode ?
            `単色 (${state.backgroundColor})` :
            `画像 (${state.imageFile?.name || ''})`;
        document.getElementById('summary-base-layer').textContent = baseType;
        document.getElementById('summary-base-size').textContent = `${baseWidth} x ${baseHeight} px`;

        // Extra area info
        let canvasWidth = baseWidth;
        let canvasHeight = baseHeight;
        let extraAreaText = 'なし';

        if (state.extraAreaMode === 'external') {
            const posNames = { top: '上', bottom: '下', left: '左', right: '右' };
            extraAreaText = `${posNames[state.extraAreaPosition]}: ${state.extraAreaSize}px`;

            if (state.extraAreaPosition === 'top' || state.extraAreaPosition === 'bottom') {
                canvasHeight += state.extraAreaSize;
            } else {
                canvasWidth += state.extraAreaSize;
            }
        }

        document.getElementById('summary-extra-area').textContent = extraAreaText;
        document.getElementById('summary-canvas-size').textContent = `${canvasWidth} x ${canvasHeight} px`;

        // Grid size
        const gridNames = { small: '小 (10px)', medium: '中 (30px)', large: '大 (50px)' };
        document.getElementById('summary-grid-size').textContent = gridNames[state.gridSize];
    }

    /**
     * Show new project wizard
     * @param {Object} [options]
     * @param {boolean} [options.canCancel=false] - True if a project is already loaded (enables cancel buttons)
     */
    showWizard({ canCancel = false } = {}) {
        // Reset existing state object instead of replacing it
        // (to preserve closure references in event handlers)
        Object.assign(this.wizardState, this._createInitialState());
        this._resetWizardUI();

        // Enable/disable cancel buttons based on whether a project is loaded
        ['btn-wizard-cancel-1', 'btn-wizard-cancel-2', 'btn-wizard-cancel-3'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = !canCancel;
        });

        document.getElementById('new-project-wizard')?.classList.remove('hidden');
        this._goToStep(1);
    }

    /**
     * Reset wizard UI to initial state
     * @private
     */
    _resetWizardUI() {
        // Step 1 - Reset tabs to image mode
        document.querySelectorAll('#wizard-base-tabs .wizard-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('#wizard-base-tabs .wizard-tab[data-tab="image"]')?.classList.add('active');
        document.getElementById('wizard-tab-image')?.classList.remove('hidden');
        document.getElementById('wizard-tab-solid')?.classList.add('hidden');

        // Reset image drop zone
        const dropZone = document.getElementById('wizard-drop-zone');
        dropZone?.classList.remove('hidden');

        document.getElementById('wizard-image-preview')?.classList.add('hidden');

        // Reset size inputs
        document.getElementById('wizard-width').value = 1280;
        document.getElementById('wizard-height').value = 720;

        // Reset color presets
        document.querySelectorAll('.bg-color-preset').forEach(b => b.classList.remove('selected'));
        document.querySelector('.bg-color-preset[data-color="#808080"]')?.classList.add('selected');

        // Step 2
        document.querySelectorAll('.extra-area-card').forEach(c => c.classList.remove('selected'));
        document.querySelector('.extra-area-card[data-mode="none"]')?.classList.add('selected');
        document.getElementById('wizard-extra-area-settings')?.classList.add('hidden');
        document.getElementById('wizard-extra-position').value = 'bottom';
        document.getElementById('wizard-extra-size').value = 100;

        document.querySelectorAll('.paddle-preset-card').forEach(c => c.classList.remove('selected'));
        document.querySelector('.paddle-preset-card[data-preset="auto"]')?.classList.add('selected');

        document.querySelectorAll('.missline-preset-card').forEach(c => c.classList.remove('selected'));
        document.querySelector('.missline-preset-card[data-preset="auto"]')?.classList.add('selected');

        // Step 3
        document.querySelectorAll('.grid-size-card').forEach(c => c.classList.remove('selected'));
        document.querySelector('.grid-size-card[data-size="medium"]')?.classList.add('selected');

        // Disable next button
        const btnNext = document.getElementById('btn-wizard-step1-next');
        if (btnNext) btnNext.disabled = true;
    }

    /**
     * Create project from wizard settings
     * @private
     */
    _createProjectFromWizard() {
        const state = this.wizardState;

        let baseWidth, baseHeight;
        if (state.solidColorMode) {
            baseWidth = state.manualWidth;
            baseHeight = state.manualHeight;
        } else {
            baseWidth = state.imageWidth;
            baseHeight = state.imageHeight;
        }

        // Calculate canvas size with extra area
        let canvasWidth = baseWidth;
        let canvasHeight = baseHeight;
        let gameAreaOffset = { x: 0, y: 0 };

        if (state.extraAreaMode === 'external') {
            const size = state.extraAreaSize;
            switch (state.extraAreaPosition) {
                case 'top':
                    canvasHeight += size;
                    gameAreaOffset.y = size;
                    break;
                case 'bottom':
                    canvasHeight += size;
                    break;
                case 'left':
                    canvasWidth += size;
                    gameAreaOffset.x = size;
                    break;
                case 'right':
                    canvasWidth += size;
                    break;
            }
        }

        // Create project configuration
        const config = {
            canvasWidth,
            canvasHeight,
            gameAreaWidth: baseWidth,
            gameAreaHeight: baseHeight,
            gameAreaOffset,
            gridSize: state.gridSize,
            extraArea: state.extraAreaMode === 'external' ? {
                position: state.extraAreaPosition,
                size: state.extraAreaSize
            } : null,
            presets: {
                paddleAxis: state.paddleAxisPreset,
                missLine: state.missLinePreset
            },
            baseLayer: {
                width: baseWidth,
                height: baseHeight,
                backgroundColor: state.solidColorMode ? state.backgroundColor : null,
                imageData: state.imageData,
                image: null  // Will be set by editor
            }
        };

        // Close wizard
        document.getElementById('new-project-wizard')?.classList.add('hidden');

        // Create project
        this.editor.createNewProject(config);
    }

    /**
     * Restore project from saved data
     * @private
     * @param {Object} data
     */
    async _restoreProject(data) {
        await this.editor.projectFileSystem.loadProjectFromData(data);
    }
}

export default StartupManager;
