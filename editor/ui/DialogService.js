/**
 * DialogService - ダイアログ管理の統一
 *
 * 責務:
 * - 確認ダイアログ（ネイティブconfirm代替）
 * - ローディングダイアログ
 * - プログレス表示
 * - メッセージ通知（Toast）
 */
export class DialogService {
    constructor() {
        this._loadingCount = 0;
        this._initElements();
    }

    /**
     * DOM要素を初期化
     * @private
     */
    _initElements() {
        // 既存の要素があれば使用、なければ作成
        this._createLoadingDialog();
        this._createConfirmDialog();
        this._createToastContainer();
    }

    // =========================================================================
    // 確認ダイアログ
    // =========================================================================

    /**
     * 確認ダイアログを表示
     * @param {string} message - 表示するメッセージ
     * @param {Object} options - オプション
     * @param {string} options.title - タイトル
     * @param {string} options.okText - OKボタンのテキスト
     * @param {string} options.cancelText - キャンセルボタンのテキスト
     * @param {string} options.type - ダイアログのタイプ（'danger' | 'warning' | 'info'）
     * @returns {Promise<boolean>}
     */
    async confirm(message, options = {}) {
        const {
            title = '確認',
            okText = 'OK',
            cancelText = 'キャンセル',
            type = 'info'
        } = options;

        return new Promise((resolve) => {
            const dialog = document.getElementById('dialog-confirm');
            const titleEl = document.getElementById('dialog-confirm-title');
            const messageEl = document.getElementById('dialog-confirm-message');
            const okBtn = document.getElementById('dialog-confirm-ok');
            const cancelBtn = document.getElementById('dialog-confirm-cancel');

            titleEl.textContent = title;
            messageEl.textContent = message;
            okBtn.textContent = okText;
            cancelBtn.textContent = cancelText;

            // タイプに応じたスタイル
            okBtn.className = 'btn';
            if (type === 'danger') {
                okBtn.classList.add('btn--danger');
            } else if (type === 'warning') {
                okBtn.classList.add('btn--warning');
            } else {
                okBtn.classList.add('btn--primary');
            }

            const cleanup = () => {
                dialog.classList.add('hidden');
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
            };

            const handleOk = () => {
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);

            dialog.classList.remove('hidden');
            cancelBtn.focus();
        });
    }

    // =========================================================================
    // ローディング
    // =========================================================================

    /**
     * ローディングダイアログを表示
     * @param {string} message - 表示するメッセージ
     * @returns {Function} 閉じる関数
     */
    showLoading(message = '処理中...') {
        this._loadingCount++;
        const dialog = document.getElementById('dialog-loading');
        const messageEl = document.getElementById('dialog-loading-message');

        messageEl.textContent = message;
        dialog.classList.remove('hidden');

        return () => this.hideLoading();
    }

    /**
     * ローディングを非表示
     */
    hideLoading() {
        this._loadingCount = Math.max(0, this._loadingCount - 1);
        if (this._loadingCount === 0) {
            const dialog = document.getElementById('dialog-loading');
            dialog.classList.add('hidden');
        }
    }

    /**
     * ローディングメッセージを更新
     * @param {string} message
     */
    updateLoadingMessage(message) {
        const messageEl = document.getElementById('dialog-loading-message');
        if (messageEl) {
            messageEl.textContent = message;
        }
    }

    // =========================================================================
    // プログレス
    // =========================================================================

    /**
     * プログレスダイアログを表示
     * @param {string} message - 表示するメッセージ
     * @param {number} total - 全体の数
     * @returns {Object} { update(current, message?), close() }
     */
    showProgress(message, total) {
        const dialog = document.getElementById('dialog-loading');
        const messageEl = document.getElementById('dialog-loading-message');
        const progressEl = document.getElementById('dialog-loading-progress');

        messageEl.textContent = message;
        progressEl.classList.remove('hidden');
        progressEl.max = total;
        progressEl.value = 0;
        dialog.classList.remove('hidden');

        return {
            update: (current, newMessage) => {
                progressEl.value = current;
                if (newMessage) {
                    messageEl.textContent = newMessage;
                }
            },
            close: () => {
                dialog.classList.add('hidden');
                progressEl.classList.add('hidden');
            }
        };
    }

    // =========================================================================
    // Toast通知
    // =========================================================================

    /**
     * Toast通知を表示
     * @param {string} message - 表示するメッセージ
     * @param {'info'|'success'|'warning'|'error'} type - メッセージタイプ
     * @param {number} duration - 表示時間（ミリ秒）
     */
    toast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;

        const icon = this._getToastIcon(type);
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${this._escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        // アニメーション開始
        requestAnimationFrame(() => {
            toast.classList.add('toast--visible');
        });

        // 自動削除
        setTimeout(() => {
            toast.classList.remove('toast--visible');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        }, duration);
    }

    // =========================================================================
    // プライベートメソッド
    // =========================================================================

    /**
     * ローディングダイアログを作成
     * @private
     */
    _createLoadingDialog() {
        if (document.getElementById('dialog-loading')) return;

        const dialog = document.createElement('div');
        dialog.id = 'dialog-loading';
        dialog.className = 'dialog-overlay hidden';
        dialog.innerHTML = `
            <div class="dialog dialog--loading">
                <div class="loading-spinner"></div>
                <p id="dialog-loading-message">処理中...</p>
                <progress id="dialog-loading-progress" class="hidden" max="100" value="0"></progress>
            </div>
        `;
        document.body.appendChild(dialog);
    }

    /**
     * 確認ダイアログを作成
     * @private
     */
    _createConfirmDialog() {
        if (document.getElementById('dialog-confirm')) return;

        const dialog = document.createElement('div');
        dialog.id = 'dialog-confirm';
        dialog.className = 'dialog-overlay hidden';
        dialog.innerHTML = `
            <div class="dialog dialog--confirm">
                <h3 id="dialog-confirm-title">確認</h3>
                <p id="dialog-confirm-message"></p>
                <div class="dialog-buttons">
                    <button id="dialog-confirm-cancel" class="btn">キャンセル</button>
                    <button id="dialog-confirm-ok" class="btn btn--primary">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
    }

    /**
     * Toastコンテナを作成
     * @private
     */
    _createToastContainer() {
        if (document.getElementById('toast-container')) return;

        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    /**
     * Toastアイコンを取得
     * @private
     */
    _getToastIcon(type) {
        const icons = {
            info: 'ℹ️',
            success: '✓',
            warning: '⚠',
            error: '✕'
        };
        return icons[type] || icons.info;
    }

    /**
     * HTMLエスケープ
     * @private
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// シングルトンインスタンス
export const dialogService = new DialogService();
