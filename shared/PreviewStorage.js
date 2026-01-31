/**
 * PreviewStorage - プレビュー用データストレージ
 *
 * IndexedDBを使用して大きなプレビューデータを保存
 * localStorageの5MB制限を回避
 */

const DB_NAME = 'hexbreaker_preview';
const DB_VERSION = 1;
const STORE_NAME = 'stages';
const PREVIEW_KEY = 'current_preview';

class PreviewStorage {
    constructor() {
        this._db = null;
    }

    /**
     * データベースを開く
     * @returns {Promise<IDBDatabase>}
     */
    async _openDB() {
        if (this._db) return this._db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this._db = request.result;
                resolve(this._db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    /**
     * プレビューデータを保存
     * @param {Object} data - ステージデータ
     * @returns {Promise<void>}
     */
    async save(data) {
        const db = await this._openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.put(data, PREVIEW_KEY);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * プレビューデータを読み込み
     * @returns {Promise<Object|null>}
     */
    async load() {
        const db = await this._openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(PREVIEW_KEY);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * プレビューデータを削除
     * @returns {Promise<void>}
     */
    async clear() {
        const db = await this._openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(PREVIEW_KEY);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

export const previewStorage = new PreviewStorage();
