/**
 * PowerGem.js - Power Gem Entity
 * Based on game_specification.md Section 4.4
 */

export class PowerGem {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.vy = 2.0; // Fall speed
        this.alive = true;
        this.color = '#FFD700'; // Gold

        // Wobble effect
        this.wobbleTime = 0;
        this.initialX = x;
    }

    /**
     * Update gem position
     * @param {number} dt - Delta time
     */
    update(dt) {
        this.y += this.vy * (dt * 60); // Frame-based speed adjustment

        // Wobble
        this.wobbleTime += dt * 5;
        this.x = this.initialX + Math.sin(this.wobbleTime) * 3;
    }

    /**
     * Check collision with paddle
     * @param {Object} paddle
     * @returns {boolean}
     */
    checkCollection(paddle) {
        // Paddle bounds (centered)
        const pLeft = paddle.x - paddle.width / 2;
        const pRight = paddle.x + paddle.width / 2;
        const pTop = paddle.y - paddle.height / 2;
        const pBottom = paddle.y + paddle.height / 2;

        // Find closest point on paddle rect to gem center
        const closeX = Math.max(pLeft, Math.min(this.x, pRight));
        const closeY = Math.max(pTop, Math.min(this.y, pBottom));

        // Distance from closest point to gem center
        const dx = this.x - closeX;
        const dy = this.y - closeY;

        return (dx * dx + dy * dy) < (this.radius * this.radius);
    }

    /**
     * Check if off screen
     * @param {number} height
     * @returns {boolean}
     */
    isOffScreen(height) {
        return this.y > height + this.radius;
    }

    /**
     * Render gem
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        gradient.addColorStop(0, '#FFF59D');
        gradient.addColorStop(0.5, '#FBC02D');
        gradient.addColorStop(1, 'rgba(251, 192, 45, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Crystal shape (diamond)
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 0);
        ctx.lineTo(0, 6);
        ctx.lineTo(-4, 0);
        ctx.fill();

        ctx.restore();
    }
}
