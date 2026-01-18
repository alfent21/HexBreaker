
export class Laser {
    /**
     * @param {number} x - Starting x position (center of paddle)
     * @param {number} y - Starting y position (top of paddle)
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 6;
        this.height = 24;
        this.speed = 12;
        this.active = true;
        this.color = '#00ffff'; // Cyan laser
        this.damage = 1;
    }

    /**
     * Update laser position
     */
    update() {
        this.y -= this.speed;

        // Deactivate if off screen
        if (this.y + this.height < 0) {
            this.active = false;
        }
    }

    /**
     * Render laser beam
     * @param {CanvasRenderingContext2D} ctx 
     */
    render(ctx) {
        ctx.save();

        // Core
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x - 2, this.y, 4, this.height);

        // Outer glow
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);

        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x - 2, this.y, 4, this.height);

        ctx.restore();
    }

    /**
     * Get collision bounds
     */
    getBounds() {
        return {
            left: this.x - this.width / 2,
            right: this.x + this.width / 2,
            top: this.y,
            bottom: this.y + this.height
        };
    }
}
