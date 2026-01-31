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
     * データをファイルとしてダウンロード
     * @param {string|Blob} data - 保存するデータ
     * @param {string} filename - ファイル名
     * @param {string} mimeType - MIMEタイプ
     */
    async saveFile(data, filename, mimeType = 'application/json') {
        const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });

        // File System Access API が使える場合はそちらを優先
        if (this.supportsFSA) {
            try {
                await this.saveWithPicker(blob, {
                    suggestedName: filename,
                    types: this._getFileTypes(filename)
                });
                return;
            } catch (e) {
                // ユーザーがキャンセルした場合、または API が失敗した場合
                if (e.name === 'AbortError') {
                    return; // ユーザーキャンセル
                }
                // フォールバック
            }
        }

        // 従来のダウンロード方法
        this._downloadViaLink(blob, filename);
    }

    /**
     * File System Access API でファイル保存
     * @param {Blob} blob - 保存するBlob
     * @param {Object} options - ファイルピッカーのオプション
     */
    async saveWithPicker(blob, options) {
        const handle = await window.showSaveFilePicker(options);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
    }

    /**
     * ファイルピッカーでファイルを選択
     * @param {Object} options - ファイルピッカーのオプション
     * @returns {Promise<File|null>}
     */
    async openFilePicker(options = {}) {
        // input要素を使ったファイル選択
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            if (options.accept) {
                input.accept = options.accept;
            }
            if (options.multiple) {
                input.multiple = true;
            }
            input.onchange = (e) => {
                const files = e.target.files;
                resolve(options.multiple ? Array.from(files) : files[0] || null);
            };
            input.click();
        });
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
