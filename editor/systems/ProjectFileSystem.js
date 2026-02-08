/**
 * ProjectFileSystem - プロジェクトファイル管理
 *
 * FileManager, SerializationService, DialogService を組み合わせて
 * プロジェクトの保存・読み込み・エクスポートを提供する高レベルAPI
 */
import { fileManager } from './FileManager.js';
import { serializationService } from './SerializationService.js';
import { dialogService } from '../ui/DialogService.js';
import { previewStorage } from '../../shared/PreviewStorage.js';
import { indexedDBStorage } from './IndexedDBStorage.js';

/** @type {string} IndexedDBキー（プロジェクト保存用） */
const STORAGE_KEY_PROJECT = 'last_project';

export class ProjectFileSystem {
    /**
     * @param {Object} editor - Editorインスタンス
     */
    constructor(editor) {
        /** @type {Object} Editorインスタンス */
        this.editor = editor;

        /** @type {string} 現在のプロジェクト名 */
        this.currentProjectName = 'Untitled Project';

        /** @type {boolean} 未保存の変更があるか */
        this.hasUnsavedChanges = false;

        // 依存サービス
        this.fileManager = fileManager;
        this.serialization = serializationService;
        this.dialogs = dialogService;
    }

    // =========================================================================
    // プロジェクト保存
    // =========================================================================

    /**
     * プロジェクトを上書き保存
     * ファイルハンドルがない場合は「別名で保存」にリダイレクト
     * @returns {Promise<boolean>}
     */
    async saveProject() {
        // ファイルハンドルがない場合は別名で保存
        if (!this.fileManager.canSave()) {
            return this.saveProjectAs();
        }

        const closeLoading = this.dialogs.showLoading('プロジェクトを保存中...');

        try {
            const json = this._prepareProjectJson();

            await this.fileManager.save(json, 'application/json');

            this.hasUnsavedChanges = false;
            this.dialogs.toast('プロジェクトを保存しました', 'success');
            return true;

        } catch (error) {
            console.error('プロジェクト保存エラー:', error);
            this.dialogs.toast(`保存に失敗しました: ${error.message}`, 'error');
            return false;

        } finally {
            closeLoading();
        }
    }

    /**
     * プロジェクトを別名で保存
     * @returns {Promise<boolean>}
     */
    async saveProjectAs() {
        const closeLoading = this.dialogs.showLoading('プロジェクトを保存中...');

        try {
            const json = this._prepareProjectJson();

            const saved = await this.fileManager.saveAs(
                json,
                `${this.currentProjectName}.hbp`,
                'application/json'
            );

            if (saved) {
                this.hasUnsavedChanges = false;
                this.dialogs.toast('プロジェクトを保存しました', 'success');
            }
            return saved;

        } catch (error) {
            console.error('プロジェクト保存エラー:', error);
            this.dialogs.toast(`保存に失敗しました: ${error.message}`, 'error');
            return false;

        } finally {
            closeLoading();
        }
    }

    /**
     * プロジェクトのJSON文字列を準備
     * @private
     * @returns {string}
     */
    _prepareProjectJson() {
        // 現在の状態を同期
        this.editor._syncLayersToStage();
        this.editor._syncLinesToStage();

        // ブロック描画設定を取得
        const blockRenderSettings = this.editor.uiController?.getBlockRenderSettings() || null;

        // デバッグ: 保存時の設定値を確認
        if (blockRenderSettings) {
            const borderW = Math.round((blockRenderSettings.border?.widthRatio || 0) * 100);
            const embossW = Math.round((blockRenderSettings.emboss?.lineWidthRatio || 0) * 100);
            this.dialogs.toast(`保存: 境界線${borderW}%, エンボス${embossW}%`, 'info');
        }

        // シリアライズ
        const data = this.serialization.serializeProject({
            stages: this.editor.stageManager.stages,
            projectName: this.currentProjectName,
            blockRenderSettings
        });

        // JSON化
        const json = JSON.stringify(data, null, 2);

        // サイズ検証（50MB制限 - Base64画像を含むため大きくなりやすい）
        const sizeCheck = this.fileManager.validateJsonSize(json, 50);
        if (!sizeCheck.valid) {
            throw new Error(sizeCheck.message);
        }

        return json;
    }

    /**
     * @deprecated 内部メソッドは廃止。saveProject() または saveProjectAs() を使用。
     */
    async _saveProjectInternal(forceNewFile) {
        console.warn('[ProjectFileSystem] _saveProjectInternal() is deprecated.');
        return forceNewFile ? this.saveProjectAs() : this.saveProject();
    }

    /**
     * プロジェクトを取得（UIController用の互換メソッド）
     * @returns {Object|null}
     */
    getProjectData() {
        if (!this.editor.stageManager || this.editor.stageManager.stages.length === 0) {
            return null;
        }

        this.editor._syncLayersToStage();
        this.editor._syncLinesToStage();

        // ブロック描画設定を取得
        const blockRenderSettings = this.editor.uiController?.getBlockRenderSettings() || null;

        return this.serialization.serializeProject({
            stages: this.editor.stageManager.stages,
            projectName: this.currentProjectName,
            blockRenderSettings
        });
    }

    // =========================================================================
    // プロジェクト読み込み
    // =========================================================================

    /**
     * ファイル選択ダイアログを開いてプロジェクトを読み込み
     * @returns {Promise<boolean>} 成功したかどうか
     */
    async openProject() {
        const file = await this.fileManager.openFilePicker({
            accept: '.hbp,.json',
            storeHandle: true  // 上書き保存用にハンドルを保存
        });

        if (!file) return false;

        return this.loadProjectFromFile(file);
    }

    /**
     * 新規プロジェクト作成時にファイルハンドルをクリア
     */
    clearFileHandle() {
        this.fileManager.clearFileHandle();
    }

    /**
     * ファイルからプロジェクトを読み込み
     * @param {File} file
     * @returns {Promise<boolean>}
     */
    async loadProjectFromFile(file) {
        const closeLoading = this.dialogs.showLoading('プロジェクトを読み込み中...');

        try {
            // ファイル読み込み
            const json = await this.fileManager.readAsText(file);
            const rawData = JSON.parse(json);

            // デシリアライズ
            const data = await this.serialization.deserializeProject(rawData);

            // エディターに適用
            await this._applyProjectData(data);

            this.currentProjectName = data.projectName;
            this.hasUnsavedChanges = false;

            // 次回起動時に自動復元するためlocalStorageに保存
            this.saveToLocalStorage();

            this.dialogs.toast('プロジェクトを読み込みました', 'success');
            return true;

        } catch (error) {
            console.error('プロジェクト読み込みエラー:', error);
            this.dialogs.toast(`読み込みに失敗しました: ${error.message}`, 'error');
            return false;

        } finally {
            closeLoading();
        }
    }

    /**
     * データからプロジェクトを読み込み
     * @param {Object} data - シリアライズされたプロジェクトデータ
     * @returns {Promise<boolean>}
     */
    async loadProjectFromData(data) {
        const closeLoading = this.dialogs.showLoading('プロジェクトを読み込み中...');

        try {
            // デシリアライズ（まだされていない場合）
            const deserializedData = data.version
                ? await this.serialization.deserializeProject(data)
                : data;

            // エディターに適用
            await this._applyProjectData(deserializedData);

            this.currentProjectName = deserializedData.projectName;
            this.hasUnsavedChanges = false;

            return true;

        } catch (error) {
            console.error('プロジェクト読み込みエラー:', error);
            this.dialogs.toast(`読み込みに失敗しました: ${error.message}`, 'error');
            return false;

        } finally {
            closeLoading();
        }
    }

    /**
     * プロジェクトデータをエディターに適用
     * @private
     */
    async _applyProjectData(data) {
        // 現在の状態をクリア
        this.editor.stageManager.clear();
        this.editor.layerManager.clear();
        this.editor.lineManager.clear();

        // ステージを復元
        if (data.stages && data.stages.length > 0) {
            // StageManagerに直接ステージを設定
            for (const stage of data.stages) {
                this.editor.stageManager.stages.push(stage);
            }

            // 最初のステージを選択
            this.editor.stageManager.setCurrentStage(data.stages[0].id);
        }

        // ブロック描画設定を復元
        if (data.blockRenderSettings) {
            if (this.editor.uiController) {
                // UIController存在時は即座に適用
                this.editor.uiController.applyBlockRenderSettings(data.blockRenderSettings);
            } else {
                // UIController未初期化時は一時保存（UIController.init()で適用される）
                this.editor.pendingBlockRenderSettings = data.blockRenderSettings;
            }
        }

        this.editor.projectName = data.projectName;
        this.editor.isDirty = false;
        this.editor.render();

        this.editor.emit('projectChanged', data.projectName);
    }

    // =========================================================================
    // ステージエクスポート
    // =========================================================================

    /**
     * 現在のステージをエクスポート
     * @returns {Promise<boolean>}
     */
    async exportCurrentStage() {
        const closeLoading = this.dialogs.showLoading('ステージをエクスポート中...');

        try {
            const stage = this.editor.getCurrentStage();
            if (!stage) {
                throw new Error('ステージが選択されていません');
            }

            // 現在の状態を同期
            this.editor._syncLayersToStage();
            this.editor._syncLinesToStage();

            // ブロック描画設定を取得
            const blockRenderSettings = this.editor.uiController?.getBlockRenderSettings() || null;

            // ゲーム用形式でシリアライズ
            const data = this.serialization.serializeStageForGame(stage, blockRenderSettings);

            // JSON化
            const json = JSON.stringify(data, null, 2);

            // ファイル保存（エクスポートは常に新規保存）
            await this.fileManager.saveAs(
                json,
                `${stage.name || 'stage'}.json`,
                'application/json'
            );

            this.dialogs.toast('ステージをエクスポートしました', 'success');
            return true;

        } catch (error) {
            console.error('ステージエクスポートエラー:', error);
            this.dialogs.toast(`エクスポートに失敗しました: ${error.message}`, 'error');
            return false;

        } finally {
            closeLoading();
        }
    }

    /**
     * ステージデータを取得（UIController用の互換メソッド）
     * @returns {Object|null}
     */
    getStageDataForExport() {
        const stage = this.editor.getCurrentStage();
        if (!stage) return null;

        this.editor._syncLayersToStage();
        this.editor._syncLinesToStage();

        // ブロック描画設定を取得
        const blockRenderSettings = this.editor.uiController?.getBlockRenderSettings() || null;

        return this.serialization.serializeStageForGame(stage, blockRenderSettings);
    }

    // =========================================================================
    // プレビュー
    // =========================================================================

    /**
     * プレビュー用にステージをIndexedDBに保存してゲームを開く
     * @returns {Promise<boolean>}
     */
    async saveForPreview() {
        try {
            const stage = this.editor.getCurrentStage();
            if (!stage) {
                throw new Error('ステージが選択されていません');
            }

            // 現在の状態を同期
            this.editor._syncLayersToStage();
            this.editor._syncLinesToStage();

            // ブロック描画設定を取得
            const blockRenderSettings = this.editor.uiController?.getBlockRenderSettings() || null;

            // デバッグ: 設定値を確認
            if (blockRenderSettings) {
                const borderW = Math.round((blockRenderSettings.border?.widthRatio || 0) * 100);
                const embossW = Math.round((blockRenderSettings.emboss?.lineWidthRatio || 0) * 100);
                this.dialogs.toast(`プレビュー: 境界線${borderW}%, エンボス${embossW}%`, 'info');
            } else {
                this.dialogs.toast('プレビュー: 描画設定なし', 'warning');
            }

            // ゲーム用形式でシリアライズ
            const data = this.serialization.serializeStageForGame(stage, blockRenderSettings);

            // ブロック数チェック
            if (!data.blocks || data.blocks.length === 0) {
                this.dialogs.toast('ブロックがありません。ブロックレイヤーが表示されているか確認してください。', 'warning');
            }

            // IndexedDBに保存（サイズ制限なし）
            await previewStorage.save(data);

            // ゲームを開く
            window.open('game_index.html', '_blank');

            return true;

        } catch (error) {
            console.error('プレビューエラー:', error);
            this.dialogs.toast(`プレビューに失敗しました: ${error.message}`, 'error');
            return false;
        }
    }

    // =========================================================================
    // localStorage（自動保存/復元）
    // =========================================================================

    /**
     * プロジェクトをIndexedDBに保存
     * @returns {Promise<boolean>} 成功したかどうか
     */
    async saveToLocalStorage() {
        try {
            // ステージ確認
            if (!this.editor.stageManager.stages || this.editor.stageManager.stages.length === 0) {
                this.dialogs.toast('自動保存スキップ: ステージなし', 'warning');
                return false;
            }

            // 現在の状態を同期
            this.editor._syncLayersToStage();
            this.editor._syncLinesToStage();

            // ブロック描画設定を取得
            const blockRenderSettings = this.editor.uiController?.getBlockRenderSettings() || null;

            // シリアライズ
            const data = this.serialization.serializeProject({
                stages: this.editor.stageManager.stages,
                projectName: this.currentProjectName,
                blockRenderSettings
            });

            // IndexedDBに保存（容量制限なし）
            await indexedDBStorage.save(STORAGE_KEY_PROJECT, data);
            this.dialogs.toast('自動保存しました', 'info', 1500);
            return true;

        } catch (error) {
            this.dialogs.toast(`自動保存失敗: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * IndexedDBからプロジェクトを復元
     * @returns {Promise<boolean>} 成功したかどうか
     */
    async restoreFromLocalStorage() {
        try {
            const data = await indexedDBStorage.load(STORAGE_KEY_PROJECT);
            if (!data) return false;

            const success = await this.loadProjectFromData(data);

            if (success) {
                this.dialogs.toast('前回のプロジェクトを復元しました', 'info');
            }

            return success;

        } catch (error) {
            console.error('IndexedDB復元エラー:', error);
            await this.clearLocalStorage();
            return false;
        }
    }

    /**
     * IndexedDBをクリア
     */
    async clearLocalStorage() {
        await indexedDBStorage.delete(STORAGE_KEY_PROJECT);
    }

    /**
     * 未保存の変更があるかチェック
     * @returns {boolean}
     */
    hasChanges() {
        return this.hasUnsavedChanges || this.editor.isDirty;
    }

    /**
     * 変更フラグを設定
     * @param {boolean} dirty
     */
    setDirty(dirty = true) {
        this.hasUnsavedChanges = dirty;
        this.editor.isDirty = dirty;
    }

    // =========================================================================
    // 画像読み込み
    // =========================================================================

    /**
     * 画像ファイルを読み込み
     * @param {File} file
     * @returns {Promise<{image: HTMLImageElement, dataURL: string, width: number, height: number}>}
     */
    async loadImageFile(file) {
        return this.fileManager.loadImageFile(file);
    }
}

// ファクトリ関数
export function createProjectFileSystem(editor) {
    return new ProjectFileSystem(editor);
}
