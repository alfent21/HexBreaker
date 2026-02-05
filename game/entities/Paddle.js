/**
 * Paddle.js - Paddle Entity
 * Based on game_specification.md Section 4.2
 */

export class Paddle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.baseWidth = 100;
        this.width = this.baseWidth;
        this.height = 16;
        this.color = '#4FC3F7';

        this.widthMultiplier = 1.0;
        this.targetWidth = this.baseWidth;
        this.expandLevel = 0; // 0-3
        this.expandLevels = [1.0, 1.25, 1.5, 1.75];

        // Movement bounds
        this.minX = 0;
        this.maxX = 1280;

        // Visibility (false in tap mode)
        this.visible = true;
    }

    /**
     * Set movement bounds
     * @param {number} minX
     * @param {number} maxX
     */
    setBounds(minX, maxX) {
        this.minX = minX;
        this.maxX = maxX;
    }

    /**
     * Update paddle position based on mouse
     * @param {object} inputManager - Input manager instance
     * @param {number} canvasWidth - Width of the canvas
     */
    update(inputManager, canvasWidth) {
        // Width lerping
        if (this.width !== this.targetWidth) {
            this.width += (this.targetWidth - this.width) * 0.1;
            if (Math.abs(this.targetWidth - this.width) < 0.1) {
                this.width = this.targetWidth;
            }
        }

        // Mouse follow handling
        const mouseX = inputManager.mouseX;
        const halfWidth = this.width / 2;
        this.x = Math.max(this.minX + halfWidth, Math.min(this.maxX - halfWidth, mouseX));
    }

    /**
     * Expand paddle width
     */
    expand() {
        if (this.expandLevel < 3) {
            this.expandLevel++;
            this.width = this.baseWidth * this.expandLevels[this.expandLevel];
        }
    }

    /**
     * Reset paddle width
     */
    resetWidth() {
        this.expandLevel = 0;
        this.width = this.baseWidth;
    }

    /**
     * Check collision with ball
     * @param {import('./Ball.js').Ball} ball
     * @returns {{hit: boolean, offsetRatio: number}} Collision result
     */
    checkCollision(ball) {
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;

        // AABB collision with ball
        const closestX = Math.max(this.x - halfWidth, Math.min(ball.x, this.x + halfWidth));
        const closestY = Math.max(this.y - halfHeight, Math.min(ball.y, this.y + halfHeight));

        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < ball.radius && ball.dy > 0) {
            // Calculate offset ratio (-1 to 1)
            const offsetRatio = (ball.x - this.x) / halfWidth;

            // Push ball above paddle
            ball.y = this.y - halfHeight - ball.radius;

            return { hit: true, offsetRatio: Math.max(-1, Math.min(1, offsetRatio)) };
        }

        return { hit: false, offsetRatio: 0 };
    }

    /**
     * Get ball attach position
     * @returns {{x: number, y: number}}
     */
    getBallAttachPosition() {
        return {
            x: this.x,
            y: this.y - this.height / 2 - 10 // Ball radius + small gap
        };
    }

    /**
     * Enable shooting for the paddle
     */
    enableShooting() {
        this.canShoot = true;
    }

    /**
     * Disable shooting for the paddle
     */
    disableShooting() {
        this.canShoot = false;
    }

    /**
     * Check if the paddle can shoot
     * @returns {boolean}
     */
    canFire() {
        return this.canShoot && (performance.now() - this.lastShotTime > this.shotCooldown);
    }

    /**
     * Record a shot fired
     */
    recordShot() {
        this.lastShotTime = performance.now();
    }

    /**
     * Get the position for a new projectile
     * @returns {{x: number, y: number}}
     */
    getProjectilePosition() {
        return {
            x: this.x,
            y: this.y - this.height / 2
        };
    }

    /**
     * Render paddle
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        if (!this.visible) return;

        // Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        ctx.fillStyle = this.color;

        // Rounded rectangle paddle
        ctx.beginPath();
        // Draw centered vertically to match collision bounds
        ctx.roundRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height, 8);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Detail line
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.roundRect(this.x - this.width / 2 + 4, this.y - this.height / 2 + 4, this.width - 8, this.height / 2, 4);
        ctx.fill();

        // Border
        ctx.strokeStyle = '#B3E5FC';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
    }

    /**
     * Set width multiplier
     * @param {number} multiplier 
     */
    setWidthMultiplier(multiplier) {
        this.widthMultiplier = multiplier;
        this.targetWidth = this.baseWidth * multiplier;
    }
}
