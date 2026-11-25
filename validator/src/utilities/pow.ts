/**
 * Deterministic Math.pow for consensus code.
 *
 * Port of V8 base::ieee754::pow (fdlibm e_pow.c), the implementation behind Math.pow and `**` in
 * Node <= 23 on x64. Native Math.pow is not portable: Node 24+ defaults to the platform std::pow,
 * and arm64 builds of the V8 implementation differ from x64 in the last bit for some inputs.
 * This port uses only IEEE 754 double operations (which JavaScript defines exactly) and 32-bit
 * integer operations, so it returns the same result on every engine, version and CPU.
 *
 * Use it instead of Math.pow or `**` wherever the result affects consensus state.
 */
const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
const LITTLE = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const LO = LITTLE ? 0 : 1;
const HI = LITTLE ? 1 : 0;

const hiWord = (d: number): number => {
    f64[0] = d;
    return u32[HI] | 0;
};
const loWord = (d: number): number => {
    f64[0] = d;
    return u32[LO] >>> 0;
};
const setLo = (d: number, lo: number): number => {
    f64[0] = d;
    u32[LO] = lo;
    return f64[0];
};
const setHi = (d: number, hi: number): number => {
    f64[0] = d;
    u32[HI] = hi;
    return f64[0];
};

const two54 = 1.8014398509481984e16;
const twom54 = 5.55111512312578270212e-17;
const hugeS = 1.0e300;
const tinyS = 1.0e-300;

// fdlibm s_scalbn.c
function scalbn(x: number, n: number): number {
    let hx = hiWord(x);
    const lx = loWord(x);
    let k = (hx & 0x7ff00000) >> 20;
    if (k === 0) {
        if ((lx | (hx & 0x7fffffff)) === 0) return x;
        x *= two54;
        hx = hiWord(x);
        k = ((hx & 0x7ff00000) >> 20) - 54;
        if (n < -50000) return tinyS * x;
    }
    if (k === 0x7ff) return x + x;
    k = k + n;
    if (k > 0x7fe) return hugeS * (x < 0 ? -hugeS : hugeS);
    if (k > 0) return setHi(x, (hx & 0x800fffff) | (k << 20));
    if (k <= -54) {
        if (n > 50000) return hugeS * (x < 0 ? -hugeS : hugeS);
        return tinyS * (x < 0 ? -tinyS : tinyS);
    }
    k += 54;
    x = setHi(x, (hx & 0x800fffff) | (k << 20));
    return x * twom54;
}

const bp = [1.0, 1.5];
const dp_h = [0.0, 5.84962487220764160156e-1];
const dp_l = [0.0, 1.35003920212974897128e-8];
const zero = 0.0;
const one = 1.0;
const two = 2.0;
const two53 = 9007199254740992.0;
const huge = 1.0e300;
const tiny = 1.0e-300;
const L1 = 5.99999999999994648725e-1;
const L2 = 4.28571428578550184252e-1;
const L3 = 3.33333329818377432918e-1;
const L4 = 2.72728123808534006489e-1;
const L5 = 2.30660745775561754067e-1;
const L6 = 2.06975017800338417784e-1;
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.6533902205465251539e-6;
const P5 = 4.13813679705723846039e-8;
const lg2 = 6.93147180559945286227e-1;
const lg2_h = 6.93147182464599609375e-1;
const lg2_l = -1.90465429995776804525e-9;
const ovt = 8.008566259537294e-17;
const cp = 9.61796693925975554329e-1;
const cp_h = 9.61796700954437255859e-1;
const cp_l = -7.02846165095275826516e-9;
const ivln2 = 1.442695040888963387;
const ivln2_h = 1.44269502162933349609;
const ivln2_l = 1.92596299112661746887e-8;

export function deterministicPow(x: number, y: number): number {
    let z: number, ax: number, z_h: number, z_l: number, p_h: number, p_l: number, t1: number, t2: number;
    let r: number, s: number, t: number, u: number, v: number, w: number;
    let i: number,
        j = 0,
        k = 0,
        n: number;

    const hx = hiWord(x);
    const lx = loWord(x);
    const hy = hiWord(y);
    const ly = loWord(y);
    let ix = hx & 0x7fffffff;
    const iy = hy & 0x7fffffff;

    if ((iy | ly) === 0) return one;

    if (ix > 0x7ff00000 || (ix === 0x7ff00000 && lx !== 0) || iy > 0x7ff00000 || (iy === 0x7ff00000 && ly !== 0)) {
        return x + y;
    }

    let yisint = 0;
    if (hx < 0) {
        if (iy >= 0x43400000) {
            yisint = 2;
        } else if (iy >= 0x3ff00000) {
            k = (iy >> 20) - 0x3ff;
            if (k > 20) {
                j = ly >>> (52 - k);
                if (((j << (52 - k)) | 0) === (ly | 0)) yisint = 2 - (j & 1);
            } else if (ly === 0) {
                j = iy >> (20 - k);
                if (j << (20 - k) === iy) yisint = 2 - (j & 1);
            }
        }
    }

    if (ly === 0) {
        if (iy === 0x7ff00000) {
            if (((ix - 0x3ff00000) | lx) === 0) {
                return y - y;
            } else if (ix >= 0x3ff00000) {
                return hy >= 0 ? y : zero;
            } else {
                return hy < 0 ? -y : zero;
            }
        }
        if (iy === 0x3ff00000) {
            return hy < 0 ? one / x : x;
        }
        if (hy === 0x40000000) return x * x;
        if (hy === 0x3fe00000) {
            if (hx >= 0) return Math.sqrt(x);
        }
    }

    ax = Math.abs(x);
    if (lx === 0) {
        if (ix === 0x7ff00000 || ix === 0 || ix === 0x3ff00000) {
            z = ax;
            if (hy < 0) z = one / z;
            if (hx < 0) {
                if (((ix - 0x3ff00000) | yisint) === 0) {
                    z = NaN;
                } else if (yisint === 1) {
                    z = -z;
                }
            }
            return z;
        }
    }

    n = (hx >> 31) + 1;

    if ((n | yisint) === 0) return NaN;

    s = one;
    if ((n | (yisint - 1)) === 0) s = -one;

    if (iy > 0x41e00000) {
        if (iy > 0x43f00000) {
            if (ix <= 0x3fefffff) return hy < 0 ? huge * huge : tiny * tiny;
            if (ix >= 0x3ff00000) return hy > 0 ? huge * huge : tiny * tiny;
        }
        if (ix < 0x3fefffff) return hy < 0 ? s * huge * huge : s * tiny * tiny;
        if (ix > 0x3ff00000) return hy > 0 ? s * huge * huge : s * tiny * tiny;
        t = ax - one;
        w = t * t * (0.5 - t * (0.3333333333333333 - t * 0.25));
        u = ivln2_h * t;
        v = t * ivln2_l - w * ivln2;
        t1 = u + v;
        t1 = setLo(t1, 0);
        t2 = v - (t1 - u);
    } else {
        let s2: number, t_h: number;
        n = 0;
        if (ix < 0x00100000) {
            ax *= two53;
            n -= 53;
            ix = hiWord(ax);
        }
        n += (ix >> 20) - 0x3ff;
        j = ix & 0x000fffff;
        ix = j | 0x3ff00000;
        if (j <= 0x3988e) {
            k = 0;
        } else if (j < 0xbb67a) {
            k = 1;
        } else {
            k = 0;
            n += 1;
            ix -= 0x00100000;
        }
        ax = setHi(ax, ix);

        u = ax - bp[k];
        v = one / (ax + bp[k]);
        const ss = u * v;
        const s_h = setLo(ss, 0);
        t_h = setHi(zero, ((ix >> 1) | 0x20000000) + 0x00080000 + (k << 18));
        let t_l = ax - (t_h - bp[k]);
        const s_l = v * (u - s_h * t_h - s_h * t_l);
        s2 = ss * ss;
        r = s2 * s2 * (L1 + s2 * (L2 + s2 * (L3 + s2 * (L4 + s2 * (L5 + s2 * L6)))));
        r += s_l * (s_h + ss);
        s2 = s_h * s_h;
        t_h = setLo(3.0 + s2 + r, 0);
        t_l = r - (t_h - 3.0 - s2);
        u = s_h * t_h;
        v = s_l * t_h + t_l * ss;
        p_h = setLo(u + v, 0);
        p_l = v - (p_h - u);
        z_h = cp_h * p_h;
        z_l = cp_l * p_h + p_l * cp + dp_l[k];
        t = n;
        t1 = setLo(z_h + z_l + dp_h[k] + t, 0);
        t2 = z_l - (t1 - t - dp_h[k] - z_h);
    }

    const y1 = setLo(y, 0);
    p_l = (y - y1) * t1 + y * t2;
    p_h = y1 * t1;
    z = p_l + p_h;
    j = hiWord(z);
    i = loWord(z);
    if (j >= 0x40900000) {
        if (((j - 0x40900000) | i) !== 0) {
            return s * huge * huge;
        } else if (p_l + ovt > z - p_h) {
            return s * huge * huge;
        }
    } else if ((j & 0x7fffffff) >= 0x4090cc00) {
        if (((j - 0xc090cc00) | i) !== 0) {
            return s * tiny * tiny;
        } else if (p_l <= z - p_h) {
            return s * tiny * tiny;
        }
    }

    i = j & 0x7fffffff;
    k = (i >> 20) - 0x3ff;
    n = 0;
    if (i > 0x3fe00000) {
        n = (j + (0x00100000 >> (k + 1))) | 0;
        k = ((n & 0x7fffffff) >> 20) - 0x3ff;
        t = setHi(zero, n & ~(0x000fffff >> k));
        n = ((n & 0x000fffff) | 0x00100000) >> (20 - k);
        if (j < 0) n = -n;
        p_h -= t;
    }
    t = setLo(p_l + p_h, 0);
    u = t * lg2_h;
    v = (p_l - (t - p_h)) * lg2 + t * lg2_l;
    z = u + v;
    w = v - (z - u);
    t = z * z;
    t1 = z - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
    r = (z * t1) / (t1 - two - (w + z * w));
    z = one - (r - z);
    j = hiWord(z);
    j = (j + ((n << 20) | 0)) | 0;
    if (j >> 20 <= 0) {
        z = scalbn(z, n);
    } else {
        z = setHi(z, (hiWord(z) + (n << 20)) | 0);
    }
    return s * z;
}
