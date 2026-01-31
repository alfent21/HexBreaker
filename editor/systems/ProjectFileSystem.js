/**
 * ProjectFileSystem - プロジェクトファイル管理
 *
 * FileManager, SerializationService, DialogService を組み合わせて
 * プロジェクトの保存・読み込み・エクスポートを提供する高レベルAPI
 */
import { fileManager } from './FileManager.js';
import { serializationService } from './SerializationService.js';
import { dialogService } from '../ui/DialogService.js';

/** @type {string} LocalStorageキー（プロジェクト保存用） */
const STORAGE_KEY_PROJECT = 'hexbreaker_last_project';
/** @type {string} LocalStorageキー（プレビュー用） */
const STORAGE_KEY_PREVIEW = 'hexbreaker_preview_stage';
/** @type {number} LocalStorageの最大サイズ（MB） */
const LOCAL_STORAGE_MAX_MB = 4;

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
     * プロジェクトを保存（ファイルダウンロード）
     * @returns {Promise<boolean>} 成功したかどうか
     */
    async saveProject() {
        const closeLoading = this.dialogs.showLoading('プロジェクトを保存中...');

        try {
            // 現在の状態を同期
            this.editor._syncLayersToStage();
            this.editor._syncLinesToStage();

            // シリアライズ
            const data = this.serialization.serializeProject({
                stages: this.editor.stageManager.stages,
                projectName: this.currentProjectName
            });

            // JSON化
            const json = JSON.stringify(data, null, 2);

            // サイズ検証
            const sizeCheck = this.fileManager.validateJsonSize(json, 10);
            if (!sizeCheck.valid) {
                throw new Error(sizeCheck.message);
            }

            // ファイル保存
            await this.fileManager.saveFile(
                json,
                `${this.currentProjectName}.hbp`,
                'application/json'
            );

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
     * プロジェクトを取得（UIController用の互換メソッド）
     * @returns {Object|null}
     */
    getProjectData() {
        if (!this.editor.stageManager || this.editor.stageManager.stages.length === 0) {
            return null;
        }

        this.editor._syncLayersToStage();
        this.editor._syncLinesToStage();

        return this.serialization.serializeProject({
            stages: this.editor.stageManager.stages,
            projectName: this.currentProjectName
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
            accept: '.hbp,.json'
        });

        if (!file) return false;

        return this.loadProjectFromFile(file);
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

            // ゲーム用形式でシリアライズ
            const data = this.serialization.serializeStageForGame(stage);

            // JSON化
            const json = JSON.stringify(data, null, 2);

            // ファイル保存
            await this.fileManager.saveFile(
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

        return this.serialization.serializeStageForGame(stage);
    }

    // =========================================================================
    // プレビュー
    // =========================================================================

    /**
     * プレビュー用にステージをlocalStorageに保存してゲームを開く
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

            // ゲーム用形式でシリアライズ
            const data = this.serialization.serializeStageForGame(stage);
            const json = JSON.stringify(data);

            // サイズ検証
            const sizeCheck = this.fileManager.validateJsonSize(json, LOCAL_STORAGE_MAX_MB);
            if (!sizeCheck.valid) {
                throw new Error(`データが大きすぎます (${sizeCheck.sizeMB.toFixed(2)}MB > ${LOCAL_STORAGE_MAX_MB}MB)`);
            }

            // localStorageに保存
            localStorage.setItem(STORAGE_KEY_PREVIEW, json);

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
     * プロジェクトをlocalStorageに保存
     * @returns {boolean} 成功したかどうか
     */
    saveToLocalStorage() {
        try {
            // 現在の状態を同期
            this.editor._syncLayersToStage();
            this.editor._syncLinesToStage();

            // シリアライズ
            const data = this.serialization.serializeProject({
                stages: this.editor.stageManager.stages,
                projectName: this.currentProjectName
            });

            const json = JSON.stringify(data);

            // サイズ検証
            const sizeCheck = this.fileManager.validateJsonSize(json, LOCAL_STORAGE_MAX_MB);
            if (!sizeCheck.valid) {
                console.warn('プロジェクトが大きすぎてlocalStorageに保存できません:', sizeCheck.message);
                return false;
            }

            localStorage.setItem(STORAGE_KEY_PROJECT, json);
            return true;

        } catch (error) {
            console.error('localStorage保存エラー:', error);
            return false;
        }
    }

    /**
     * localStorageからプロジェクトを復元
     * @returns {Promise<boolean>} 成功したかどうか
     */
    async restoreFromLocalStorage() {
        try {
            const json = localStorage.getItem(STORAGE_KEY_PROJECT);
            if (!json) return false;

            const data = JSON.parse(json);
            const success = await this.loadProjectFromData(data);

            if (success) {
                this.dialogs.toast('前回のプロジェクトを復元しました', 'info');
            }

            return success;

        } catch (error) {
            console.error('localStorage復元エラー:', error);
            this.clearLocalStorage();
            return false;
        }
    }

    /**
     * localStorageをクリア
     */
    clearLocalStorage() {
        localStorage.removeItem(STORAGE_KEY_PROJECT);
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
