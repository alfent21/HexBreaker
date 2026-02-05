/**
 * InputManager.js - Input Handling
 * Based on game_specification.md Section 2.3
 */

export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;
        this.rightMouseDown = false;
        this.keys = {};

        // Callback functions
        this.onLaunch = null;
        this.onWeapon = null;
        this.onTap = null;

        this._bindEvents();
    }

    _bindEvents() {
        // Mouse move
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.mouseX = (e.clientX - rect.left) * scaleX;
            this.mouseY = (e.clientY - rect.top) * scaleY;
        });

        // Mouse down
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.mouseDown = true;
                if (this.onTap) this.onTap(this.mouseX, this.mouseY);
                if (this.onLaunch) this.onLaunch();
            } else if (e.button === 2) {
                this.rightMouseDown = true;
            }
        });

        // Mouse up (window level to catch release outside canvas)
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.mouseDown = false;
            } else if (e.button === 2) {
                this.rightMouseDown = false;
            }
        });

        // Reset flags when mouse leaves window or context menu opens
        window.addEventListener('blur', () => {
            this.mouseDown = false;
            this.rightMouseDown = false;
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.mouseDown = false;
                this.rightMouseDown = false;
            }
        });

        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            // Weapon shortcuts (1-7)
            if (e.key >= '1' && e.key <= '7') {
                if (this.onWeapon) {
                    const weapons = ['slow', 'wide', 'double', 'laser', 'shield', 'magnet', 'ghost'];
                    this.onWeapon(weapons[parseInt(e.key) - 1]);
                }
            }

            // Space to launch
            if (e.code === 'Space') {
                if (this.onLaunch) this.onLaunch();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    /**
     * Get speed multiplier for fast-forward
     * @returns {number} 1.0 normal, 2.0-3.0 when right-click held
     */
    getSpeedMultiplier() {
        return this.rightMouseDown ? 2.5 : 1.0;
    }

    /**
     * Check if key is pressed
     * @param {string} code - Key code
     * @returns {boolean}
     */
    isKeyDown(code) {
        return this.keys[code] === true;
    }
}
