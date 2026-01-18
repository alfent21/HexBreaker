
export class Shield {
    /**
     * @param {number} y - Y position of shield (e.g. canvasHeight - 20)
     */
    constructor(y) {
        this.y = y;
        this.active = false;
        this.strength = 0;
        this.maxStrength = 3;
        this.color = '#00ffff';
    }

    /**
     * Activate or upgrade shield
     */
    activate() {
        if (this.strength < this.maxStrength) {
            this.strength++;
            this.active = true;
            return true;
        }
        return false;
    }

    /**
     * Check and handle collision with ball
     * @param {Ball} ball 
     * @returns {boolean} True if collision handled
     */
    checkCollision(ball) {
        if (!this.active) return false;

        // Check if ball hits the shield line from moving down
        // Allow some tolerance/thickness
        if (ball.dy > 0 &&
            ball.y + ball.radius >= this.y - 5 &&
            ball.y - ball.radius <= this.y + 5) {

            // Reflect ball upward
            ball.dy = -Math.abs(ball.dy);

            // Adjust position to avoid sticking
            ball.y = this.y - ball.radius - 2;

            // Reduce strength
            this.strength--;
            if (this.strength <= 0) {
                this.active = false;
            }
            return true;
        }
        return false;
    }

    /**
     * Render shield
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} width - Canvas width
     */
    render(ctx, width) {
        if (!this.active) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        // Draw separate lines based on strength to visualize durability
        for (let i = 0; i < this.strength; i++) {
            const yOffset = i * 6; // Space between layers
            const alpha = 0.8 - (i * 0.2); // Fade out lower layers

            ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.moveTo(10, this.y + yOffset);
            ctx.lineTo(width - 10, this.y + yOffset);
            ctx.stroke();
        }

        ctx.restore();
    }
}
