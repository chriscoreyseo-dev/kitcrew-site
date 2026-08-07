"""
build_guitar_bed.py - synthesise an ORIGINAL hard-rock riff played on a physically
modelled ELECTRIC GUITAR. Pure Python stdlib.

S280, third attempt. History of the two failures, because they were different mistakes:

  v1 (build_metal_bed.py)  - constant palm-muted eighths, no rests, no melody.
                             Chris: "more of a beat, that wasn't rock."
  v2 (build_riff_bed.py)   - fixed the ARRANGEMENT (space, syncopation, question and
                             answer bars) but kept sawtooth oscillators through a tanh
                             clipper. That is a synth patch with distortion on it.
                             Chris: "let's do electric guitar."

The arrangement in v2 was right. What was wrong was the SOUND SOURCE. Two things make
a tone read as electric guitar and v2 had neither:

  1. A PLUCKED STRING, not an oscillator. Karplus-Strong: excite a delay line with a
     noise burst, feed it back through a damping filter. The delay length sets the pitch,
     the damping sets how the harmonics die away. High harmonics decay faster than the
     fundamental, exactly like a real string. An oscillator's harmonics never decay, which
     is why they sound synthetic no matter how they are filtered.

  2. A SPEAKER CABINET. A guitar cab is not full-range - it rolls off steeply above about
     5 kHz, has a presence peak around 2.5 kHz and a mud notch near 400 Hz. Distortion
     generates harmonics all the way up; without a cab those stay in the signal and read
     as fizz. Cabinet simulation is most of what makes distortion sound like an amp
     rather than a broken speaker.

Signal chain per note:  pick noise -> KS string -> asymmetric soft clip (valve-ish,
adds even harmonics) -> cabinet -> mix.

Original composition in A, standard hard-rock voicings. Deliberately not a transcription
of any existing song.

Usage:
    python marketing/kitcrew/build_guitar_bed.py <out.wav> [seconds] [bpm]
"""
import math
import struct
import sys
import wave

SR = 48000

N = {
    'E2': 82.41, 'G2': 98.00, 'A2': 110.00, 'B2': 123.47, 'C3': 130.81,
    'D3': 146.83, 'E3': 164.81, 'G3': 196.00, 'A3': 220.00, 'D4': 293.66, 'E4': 329.63,
}

# (beat_offset, [note names played together], ring_seconds, velocity)
BAR_A = [
    (0.00, ['A2', 'E3', 'A3'], 0.34, 1.00),
    (0.75, ['A2', 'E3', 'A3'], 0.24, 0.82),
    (1.50, ['A2', 'E3', 'A3'], 0.34, 0.95),
    (2.50, ['G2', 'D3', 'G3'], 0.30, 0.90),
    (3.00, ['D3', 'A3', 'D4'], 1.20, 1.00),
]
BAR_B = [
    (0.00, ['A2', 'E3', 'A3'], 0.34, 1.00),
    (0.75, ['A2', 'E3', 'A3'], 0.24, 0.82),
    (1.50, ['C3', 'G3'],       0.32, 0.92),
    (2.00, ['G2', 'D3', 'G3'], 0.32, 0.92),
    (2.75, ['A2', 'E3', 'A3'], 1.45, 1.00),
]


def ks_string(freq, dur, velocity, seed, damping=0.492, bright=0.55):
    """Karplus-Strong plucked string. Returns a list of samples.

    damping near 0.5 = long sustain; lower = faster decay of highs.
    bright controls how much high frequency is in the initial pluck.
    """
    n_out = int(dur * SR)
    delay = max(2, int(SR / freq))
    rng = seed & 0x7FFFFFFF

    def rnd():
        nonlocal rng
        rng = (1103515245 * rng + 12345) & 0x7FFFFFFF
        return (rng / 0x3FFFFFFF) - 1.0

    # excitation: noise burst shaped by 'bright' (a pick is bright and short)
    buf = []
    prev = 0.0
    for i in range(delay):
        x = rnd()
        prev = prev * (1.0 - bright) + x * bright
        buf.append(prev * velocity)

    out = []
    idx = 0
    last = 0.0
    for i in range(n_out):
        cur = buf[idx]
        # damping filter: average with previous sample = lowpass in the feedback path,
        # which is what makes high harmonics die first
        nxt = (cur + last) * damping
        last = cur
        buf[idx] = nxt
        idx = (idx + 1) % delay
        out.append(cur)
    return out


def asym_clip(x, drive):
    """Asymmetric soft clip - valve-ish. Even harmonics on one half, odd on the other."""
    y = x * drive
    if y >= 0:
        return math.tanh(y)
    return math.tanh(y * 0.82) * 0.92


class Cabinet:
    """Guitar speaker cabinet: steep HF rolloff, presence peak, mud notch, LF cut.

    Implemented as a small cascade of one-pole filters plus a resonant peak, which is
    enough to get the characteristic shape without needing an impulse response file.
    """

    def __init__(self):
        self.lp1 = self.lp2 = self.lp3 = 0.0
        self.hp = 0.0
        self.hp_prev = 0.0
        self.pk1 = self.pk2 = 0.0

    def process(self, x):
        # three-pole lowpass around 5 kHz -> kills the fizz
        a = 0.45
        self.lp1 += a * (x - self.lp1)
        self.lp2 += a * (self.lp1 - self.lp2)
        self.lp3 += a * (self.lp2 - self.lp3)
        y = self.lp3
        # highpass around 90 Hz -> a 4x12 has no sub
        hp_a = 0.988
        self.hp = hp_a * (self.hp + y - self.hp_prev)
        self.hp_prev = y
        y = self.hp
        # resonant presence peak near 2.5 kHz
        f = 2500.0 / SR
        r = 0.90
        peak = 2.0 * r * math.cos(2 * math.pi * f) * self.pk1 - r * r * self.pk2 + y
        self.pk2 = self.pk1
        self.pk1 = peak
        y = y + peak * 0.16
        return y


def build(seconds, bpm):
    n = int(SR * seconds)
    spb = 60.0 / bpm
    bar = spb * 4.0
    gtr = [0.0] * n
    rest = [0.0] * n
    seed = 7

    # ---- two guitar tracks, slightly detuned and offset = double-tracked rhythm ----
    for track, (detune, delay_ms, pan_amp) in enumerate([(0.9985, 0.0, 1.0), (1.0015, 11.0, 0.92)]):
        bar_index = 0
        t_bar = 0.0
        while t_bar < seconds:
            pattern = BAR_A if (bar_index % 2 == 0) else BAR_B
            for beat_off, notes, ring, vel in pattern:
                t0 = t_bar + beat_off * spb + delay_ms / 1000.0
                if t0 >= seconds:
                    continue
                start = int(t0 * SR)
                for note in notes:
                    seed += 1
                    f = N[note] * detune
                    samples = ks_string(f, ring, vel, seed,
                                        damping=0.4955 if ring > 0.6 else 0.489,
                                        bright=0.62)
                    for i, v in enumerate(samples):
                        s = start + i
                        if s >= n:
                            break
                        gtr[s] += v * 0.30 * pan_amp
            bar_index += 1
            t_bar += bar

    # ---- amp: drive then cabinet ----
    cab = Cabinet()
    for s in range(n):
        gtr[s] = cab.process(asym_clip(gtr[s], 5.2)) * 0.85

    # ---- bass guitar: also KS, but darker and longer ----
    seed = 90001
    bar_index = 0
    t_bar = 0.0
    while t_bar < seconds:
        pattern = BAR_A if (bar_index % 2 == 0) else BAR_B
        for beat_off, notes, ring, vel in pattern:
            t0 = t_bar + beat_off * spb
            if t0 >= seconds:
                continue
            seed += 1
            f = N[notes[0]] / 2.0
            samples = ks_string(f, max(ring, 0.5), vel, seed, damping=0.4985, bright=0.30)
            start = int(t0 * SR)
            for i, v in enumerate(samples):
                s = start + i
                if s >= n:
                    break
                rest[s] += v * 0.40
        bar_index += 1
        t_bar += bar

    # ---- drums ----
    rng = 24680

    def noise():
        nonlocal rng
        rng = (1103515245 * rng + 12345) & 0x7FFFFFFF
        return (rng / 0x3FFFFFFF) - 1.0

    for b in range(int(seconds / spb) + 1):
        t0 = b * spb
        in_bar = b % 4
        kicks = [0.0] if in_bar in (0, 2) else ([0.5] if in_bar == 1 else [])
        for k in kicks:
            start = int((t0 + k * spb) * SR)
            for s in range(start, min(n, start + int(0.18 * SR))):
                t = (s - start) / SR
                f = 118.0 * math.exp(-t * 30.0) + 45.0
                rest[s] += math.sin(2 * math.pi * f * t) * math.exp(-t / 0.058) * 0.60
        if in_bar in (1, 3):
            start = int(t0 * SR)
            lp = 0.0
            for s in range(start, min(n, start + int(0.24 * SR))):
                t = (s - start) / SR
                e = math.exp(-t / 0.082)
                nz = noise()
                lp = lp * 0.50 + nz * 0.50
                body = math.sin(2 * math.pi * 200.0 * t) * 0.40 * math.exp(-t / 0.045)
                rest[s] += ((nz - lp) * 1.05 + body) * e * 0.44
        for h in (0.0, 0.5):
            start = int((t0 + h * spb) * SR)
            for s in range(start, min(n, start + int(0.030 * SR))):
                t = (s - start) / SR
                rest[s] += noise() * math.exp(-t / 0.009) * 0.075
        if b == 0:
            start = int(t0 * SR)
            for s in range(start, min(n, start + int(1.8 * SR))):
                t = (s - start) / SR
                rest[s] += noise() * math.exp(-t / 0.60) * 0.15

    # ---- mix and master ----
    # Chris, S280: "most rock is iconic, not for the drums... it's really all about the
    # electric guitar." The guitar is the lead voice and everything else supports it.
    # Earlier passes had the kit sitting on top of the guitar, which is backwards.
    GUITAR = 1.00
    RHYTHM_SECTION = 0.46
    out = [gtr[s] * GUITAR + rest[s] * RHYTHM_SECTION for s in range(n)]
    peak = max(abs(v) for v in out) or 1.0
    norm = 0.88 / peak
    fade_in = int(0.02 * SR)
    fo = n - int(0.5 * SR)
    frames = bytearray()
    for s in range(n):
        v = out[s] * norm
        v = math.tanh(v * 1.08) * 0.95
        if s < fade_in:
            v *= s / fade_in
        if s > fo:
            v *= max(0.0, (n - s) / (n - fo))
        iv = int(max(-1.0, min(1.0, v)) * 32767)
        frames += struct.pack('<hh', iv, iv)
    return bytes(frames)


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else 'guitar_bed.wav'
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 14.7
    bpm = float(sys.argv[3]) if len(sys.argv) > 3 else 132.0
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(build(seconds, bpm))
    print(f"wrote {out_path}  {seconds}s @ {bpm}bpm")


if __name__ == '__main__':
    main()
