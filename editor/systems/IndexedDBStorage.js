/**
 * IndexedDBStorage.js - IndexedDB Wrapper for Large Data Storage
 *
 * localStorageの4MB制限を回避するため、IndexedDBを使用。
 * 画像入りプロジェクトの自動保存に対応。
 */

const DB_NAME = 'hexbreaker';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

class IndexedDBStorage {
    constructor() {
        /** @type {IDBDatabase|null} */
        this.db = null;
    }

    /**
     * データベースを開く
     * @returns {Promise<IDBDatabase>}
     */
    async open() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                reject(new Error('IndexedDB open failed: ' + request.error));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * データを保存
     * @param {string} key
     * @param {any} data
     * @returns {Promise<void>}
     */
    async save(key, data) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const request = store.put({ key, data, savedAt: Date.now() });

            request.onerror = () => {
                reject(new Error('IndexedDB save failed: ' + request.error));
            };

            request.onsuccess = () => {
                resolve();
            };
        });
    }

    /**
     * データを読み込み
     * @param {string} key
     * @returns {Promise<any|null>}
     */
    async load(key) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);

            const request = store.get(key);

            request.onerror = () => {
                reject(new Error('IndexedDB load failed: ' + request.error));
            };

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.data : null);
            };
        });
    }

    /**
     * データを削除
     * @param {string} key
     * @returns {Promise<void>}
     */
    async delete(key) {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const request = store.delete(key);

            request.onerror = () => {
                reject(new Error('IndexedDB delete failed: ' + request.error));
            };

            request.onsuccess = () => {
                resolve();
            };
        });
    }

    /**
     * 全データをクリア
     * @returns {Promise<void>}
     */
    async clear() {
        const db = await this.open();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const request = store.clear();

            request.onerror = () => {
                reject(new Error('IndexedDB clear failed: ' + request.error));
            };

            request.onsuccess = () => {
                resolve();
            };
        });
    }
}

export const indexedDBStorage = new IndexedDBStorage();
