/**
 * Ball.js - Ball Entity
 * Based on game_specification.md Section 4.1
 */

export class Ball {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.baseSpeed = 6.0;
        this.speed = 0;
        this.speedMultiplier = 1.0; // For SLOW weapon
        this.dx = 0;
        this.dy = 0;
        this.attached = true; // Attached to paddle initially
        this.color = '#FFFFFF';
        this.trail = []; // For visual trail effect
        this.active = true; // Ball is active

        // Collision tracking to prevent repeated collisions
        this.lastLineHitId = null;
        this.lastLineHitTime = 0;

        // Tap mode: true if already hit while in tap area (reset when leaving area)
        this.wasHitInTapArea = false;

        // Flash effect for tap hit feedback
        this.flashTime = 0;
    }

    /**
     * Launch the ball
     * @param {number} angle - Launch angle in radians
     */
    launch(angle = -Math.PI / 2) {
        if (!this.attached) return;

        this.attached = false;

        // Weapon states reset on launch
        this.isGhost = false;
        this.attachOffset = null;

        this.dx = Math.cos(angle);
        this.dy = Math.sin(angle);
        this.speed = this.baseSpeed;
    }

    /**
     * Update ball position
     * @param {number} dt - Delta time in seconds
     * @param {number} inputSpeedMultiplier - Global speed multiplier from input
     */
    update(dt, inputSpeedMultiplier = 1.0) {
        if (!this.active) return;

        // Note: wasHitInTapArea is reset by TapSystem when ball leaves tap area

        // Decrease flash time
        if (this.flashTime > 0) {
            this.flashTime -= dt;
        }

        // Apply speed multiplier (Base * Weapon * Input)
        const currentSpeed = this.speed * this.speedMultiplier * inputSpeedMultiplier;

        // Store trail position
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 5) {
            this.trail.shift();
        }

        // Move
        this.x += this.dx * currentSpeed * (dt * 60);
        this.y += this.dy * currentSpeed * (dt * 60);
    }

    /**
     * Reflect off a surface
     * @param {number} nx - Normal X
     * @param {number} ny - Normal Y
     */
    reflect(nx, ny) {
        // v' = v - 2(v·n)n
        const dot = this.dx * nx + this.dy * ny;
        this.dx -= 2 * dot * nx;
        this.dy -= 2 * dot * ny;
    }

    /**
     * Reflect off paddle with angle variation
     * @param {number} offsetRatio - Position on paddle (-1 to 1, center = 0)
     */
    reflectFromPaddle(offsetRatio) {
        // Angle based on hit position: ±60 degrees from vertical
        const maxAngle = Math.PI / 3; // 60 degrees
        const angle = -Math.PI / 2 + offsetRatio * maxAngle;

        this.dx = Math.cos(angle);
        this.dy = Math.sin(angle);

        // Ensure ball goes up
        if (this.dy > 0) {
            this.dy = -this.dy;
        }
    }

    /**
     * Apply random scatter to prevent infinite loops
     */
    applyRandomScatter() {
        const scatterAngle = (Math.random() - 0.5) * Math.PI / 6; // ±15 degrees
        const cos = Math.cos(scatterAngle);
        const sin = Math.sin(scatterAngle);
        const newDx = this.dx * cos - this.dy * sin;
        const newDy = this.dx * sin + this.dy * cos;
        this.dx = newDx;
        this.dy = newDy;
    }

    /**
     * Render ball
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        if (!this.active) return;

        ctx.save();

        // Ghost effect
        if (this.isGhost) {
            ctx.globalAlpha = 0.5;
        }

        // Trail render
        ctx.lineCap = 'round';
        for (let i = 0; i < this.trail.length - 1; i++) {
            const point = this.trail[i];
            const next = this.trail[i + 1];
            const alpha = (i / this.trail.length) * 0.5;

            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(next.x, next.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = this.radius * 0.8; // Slightly thinner than ball
            ctx.stroke();
        }

        // Ball render
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        // Flash effect when hit by tap
        const isFlashing = this.flashTime > 0;
        const ballColor = isFlashing ? '#FFFF00' : '#fff';
        const glowColor = isFlashing ? '#FFFF00' : '#fff';

        ctx.fillStyle = ballColor;
        ctx.fill();

        // Glow effect
        ctx.shadowBlur = isFlashing ? 20 : 10;
        ctx.shadowColor = glowColor;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    /**
     * Set speed multiplier
     * @param {number} multiplier 
     */
    setSpeedMultiplier(multiplier) {
        this.speedMultiplier = multiplier;
    }
}
