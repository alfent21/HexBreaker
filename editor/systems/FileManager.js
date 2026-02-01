/**
 * FileManager - ファイル操作の一元管理
 *
 * 責務:
 * - ファイル読み込み（FileReader ラッパー）
 * - ファイルダウンロード（Blob + ダウンロードリンク）
 * - File System Access API 対応（モダンブラウザ）
 * - Base64変換ユーティリティ
 * - ファイルサイズ検証
 */
export class FileManager {
    constructor() {
        /** @type {boolean} File System Access API のサポート状況 */
        this.supportsFSA = 'showSaveFilePicker' in window;

        /** @type {FileSystemFileHandle|null} 現在開いているプロジェクトファイルのハンドル */
        this.currentFileHandle = null;
    }

    /**
     * 現在のファイルハンドルをクリア（新規プロジェクト時に使用）
     */
    clearFileHandle() {
        this.currentFileHandle = null;
    }

    /**
     * ファイルハンドルがあるかどうか
     * @returns {boolean}
     */
    hasFileHandle() {
        return this.currentFileHandle !== null;
    }

    // =========================================================================
    // ファイル読み込み
    // =========================================================================

    /**
     * ファイルをテキストとして読み込み
     * @param {File} file - 読み込むファイル
     * @returns {Promise<string>} ファイルの内容
     */
    async readAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error(`ファイルの読み込みに失敗しました: ${file.name}`));
            reader.readAsText(file);
        });
    }

    /**
     * ファイルをDataURL（Base64）として読み込み
     * @param {File} file - 読み込むファイル
     * @returns {Promise<string>} DataURL形式の文字列
     */
    async readAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error(`ファイルの読み込みに失敗しました: ${file.name}`));
            reader.readAsDataURL(file);
        });
    }

    /**
     * 画像ファイルを読み込んでImageElementとDataURLを返す
     * @param {File} file - 画像ファイル
     * @returns {Promise<{image: HTMLImageElement, dataURL: string, width: number, height: number}>}
     */
    async loadImageFile(file) {
        // まずDataURLとして読み込み
        const dataURL = await this.readAsDataURL(file);

        // Imageオブジェクトを作成して読み込み
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    image: img,
                    dataURL: dataURL,
                    width: img.width,
                    height: img.height
                });
            };
            img.onerror = () => reject(new Error(`画像の読み込みに失敗しました: ${file.name}`));
            img.src = dataURL;
        });
    }

    /**
     * DataURLから画像を読み込み
     * @param {string} dataURL - DataURL形式の画像データ
     * @returns {Promise<HTMLImageElement>}
     */
    async loadImageFromDataURL(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
            img.src = dataURL;
        });
    }

    // =========================================================================
    // ファイル保存
    // =========================================================================

    /**
     * 上書き保存が可能かどうか
     * @returns {boolean}
     */
    canSave() {
        return this.supportsFSA && this.currentFileHandle !== null;
    }

    /**
     * データをファイルとして上書き保存
     * ハンドルがない場合はエラーをthrow
     * @param {string|Blob} data - 保存するデータ
     * @param {string} mimeType - MIMEタイプ
     * @returns {Promise<boolean>} 保存成功したか
     * @throws {Error} ハンドルがない場合、またはFile System Access API非対応の場合
     */
    async save(data, mimeType = 'application/json') {
        if (!this.supportsFSA) {
            throw new Error('このブラウザはFile System Access APIに対応していません');
        }

        if (!this.currentFileHandle) {
            throw new Error('保存先のファイルが指定されていません。「別名で保存」を使用してください。');
        }

        const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
        await this._writeToHandle(this.currentFileHandle, blob);
        return true;
    }

    /**
     * データを新規ファイルとして保存（別名で保存）
     * 常にダイアログを表示
     * @param {string|Blob} data - 保存するデータ
     * @param {string} filename - 推奨ファイル名
     * @param {string} mimeType - MIMEタイプ
     * @returns {Promise<boolean>} 保存成功したか（キャンセル時はfalse）
     * @throws {Error} File System Access API非対応の場合
     */
    async saveAs(data, filename, mimeType = 'application/json') {
        if (!this.supportsFSA) {
            throw new Error('このブラウザはFile System Access APIに対応していません');
        }

        const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });

        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: this._getFileTypes(filename)
            });
            await this._writeToHandle(handle, blob);
            this.currentFileHandle = handle; // ハンドルを保存
            return true;
        } catch (e) {
            if (e.name === 'AbortError') {
                return false; // ユーザーキャンセル
            }
            throw e; // その他のエラーは伝播
        }
    }

    /**
     * @deprecated saveFile は廃止。save() または saveAs() を使用してください。
     */
    async saveFile(data, filename, mimeType = 'application/json', forceNewFile = false) {
        console.warn('[FileManager] saveFile() is deprecated. Use save() or saveAs() instead.');

        // 互換性のため一時的に残す
        if (forceNewFile || !this.currentFileHandle) {
            return this.saveAs(data, filename, mimeType);
        }
        return this.save(data, mimeType);
    }

    /**
     * ファイルハンドルに書き込み
     * @private
     * @param {FileSystemFileHandle} handle
     * @param {Blob} blob
     */
    async _writeToHandle(handle, blob) {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
    }

    /**
     * ファイルピッカーでファイルを選択（File System Access API使用）
     * @param {Object} options - ファイルピッカーのオプション
     * @param {boolean} options.storeHandle - ファイルハンドルを保存するか（プロジェクトファイル用）
     * @returns {Promise<File|null>} 選択されたファイル、キャンセル時はnull
     * @throws {Error} File System Access API非対応の場合
     */
    async openFilePicker(options = {}) {
        if (!this.supportsFSA) {
            throw new Error('このブラウザはFile System Access APIに対応していません');
        }

        if (options.multiple) {
            throw new Error('複数ファイル選択は現在サポートされていません');
        }

        try {
            const pickerOptions = {
                types: this._getFileTypesForOpen(options.accept)
            };
            const [handle] = await window.showOpenFilePicker(pickerOptions);

            // プロジェクトファイルの場合はハンドルを保存
            if (options.storeHandle) {
                this.currentFileHandle = handle;
                console.log('[FileManager] File handle stored for:', handle.name);
            }

            return await handle.getFile();
        } catch (e) {
            if (e.name === 'AbortError') {
                return null; // ユーザーキャンセル
            }
            throw e; // その他のエラーは伝播
        }
    }

    /**
     * accept文字列からファイルタイプオプションを生成（開く用）
     * @private
     */
    _getFileTypesForOpen(accept) {
        if (!accept) return undefined;

        // ".hbp,.json" → types配列に変換
        const extensions = accept.split(',').map(s => s.trim());
        return [{
            description: 'プロジェクトファイル',
            accept: {
                'application/json': extensions
            }
        }];
    }

    // =========================================================================
    // ユーティリティ
    // =========================================================================

    /**
     * DataURLからBlobを生成
     * @param {string} dataURL - DataURL形式の文字列
     * @returns {Blob}
     */
    dataURLToBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    /**
     * ファイルサイズを検証
     * @param {number} size - バイト数
     * @param {number} maxMB - 最大サイズ（MB）
     * @returns {{valid: boolean, message: string, sizeMB: number}}
     */
    validateFileSize(size, maxMB = 5) {
        const sizeMB = size / (1024 * 1024);
        const valid = sizeMB <= maxMB;
        return {
            valid,
            message: valid ? '' : `ファイルサイズが大きすぎます (${sizeMB.toFixed(2)}MB > ${maxMB}MB)`,
            sizeMB
        };
    }

    /**
     * JSON文字列のサイズを検証（localStorage用）
     * @param {string} json - JSON文字列
     * @param {number} maxMB - 最大サイズ（MB）
     * @returns {{valid: boolean, message: string, sizeMB: number}}
     */
    validateJsonSize(json, maxMB = 4) {
        const size = new Blob([json]).size;
        return this.validateFileSize(size, maxMB);
    }

    /**
     * ファイル拡張子からMIMEタイプを取得
     * @param {string} filename - ファイル名
     * @returns {string}
     */
    getMimeType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            'json': 'application/json',
            'hbp': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'txt': 'text/plain'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    // =========================================================================
    // プライベートメソッド
    // =========================================================================

    /**
     * リンクを使ってダウンロード
     * @private
     */
    _downloadViaLink(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * ファイル名からファイルタイプオプションを生成
     * @private
     */
    _getFileTypes(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const typeMap = {
            'json': {
                description: 'JSONファイル',
                accept: { 'application/json': ['.json'] }
            },
            'hbp': {
                description: 'HexBreakerプロジェクト',
                accept: { 'application/json': ['.hbp'] }
            },
            'png': {
                description: 'PNG画像',
                accept: { 'image/png': ['.png'] }
            }
        };
        return typeMap[ext] ? [typeMap[ext]] : undefined;
    }
}

// シングルトンインスタンス
export const fileManager = new FileManager();
