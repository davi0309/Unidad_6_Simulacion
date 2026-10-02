/**
 * fractureFragments.ts
 * Fragmentos visibles que saltan al producirse una microfractura por estrés.
 *
 * - 20 a 40 por microfractura.
 * - Líneas de 3 a 6 px, color #5a0f17.
 * - Huyen del punto de fractura con fricción 0.92 por frame.
 * - Vida 1.2 s. Sin rastro.
 */

export interface Fragment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number;
  maxLife: number;
}

export class FractureSystem {
  public fragments: Fragment[] = [];

  public spawnFragments(originX: number, originY: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2.0;
      const speed = 1.2 + Math.random() * 4.5;
      const len = 3.0 + Math.random() * 3.0; // 3 a 6 px
      const maxLife = 1.2;

      this.fragments.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len,
        life: maxLife,
        maxLife
      });
    }
  }

  public update(dt: number) {
    const friction = Math.pow(0.92, dt * 60.0);

    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const f = this.fragments[i];
      f.x += f.vx * (dt * 60.0);
      f.y += f.vy * (dt * 60.0);
      f.vx *= friction;
      f.vy *= friction;
      f.life -= dt;

      if (f.life <= 0) {
        this.fragments.splice(i, 1);
      }
    }
  }

  public clear() {
    this.fragments = [];
  }
}
