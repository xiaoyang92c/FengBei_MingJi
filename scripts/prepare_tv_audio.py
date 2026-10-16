"""Derive TV cues and a seamless PCM bed; preserve the user recordings."""
from pathlib import Path
import json
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'public/assets/audio'


def decode(name, rate):
    raw = subprocess.run([
        'ffmpeg', '-v', 'error', '-i', str(AUDIO / name),
        '-f', 'f32le', '-ac', '2', '-ar', str(rate), '-',
    ], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype='<f4').reshape(-1, 2).copy()


def write(name, samples, rate):
    assert np.max(np.abs(samples)) < 1, 'Clipping'
    pcm = np.rint(samples * 32767).astype('<i2')
    with wave.open(str(AUDIO / name), 'wb') as file:
        file.setnchannels(2)
        file.setsampwidth(2)
        file.setframerate(rate)
        file.writeframes(pcm.tobytes())
    return {
        'duration': round(len(samples) / rate, 4),
        'peak': round(float(np.max(np.abs(samples))), 6),
        'rms': round(float(np.sqrt(np.mean(samples ** 2))), 6),
    }


power = decode('tvon-off.mp3', 24000)
report = {}
for name, start, end, fade in [
    ('tv-power-on.wav', .42, 1.98, .18),
    ('tv-power-off.wav', .52, 1.52, .26),
]:
    cue = power[round(start * 24000):round(end * 24000)].copy()
    attack = round(.012 * 24000)
    release = round(fade * 24000)
    cue[:attack] *= np.linspace(0, 1, attack)[:, None]
    cue[-release:] *= np.linspace(1, 0, release)[:, None]
    assert np.all(cue[0] == 0) and np.all(cue[-1] == 0)
    report[name] = write(name, cue, 24000)
    report[name].update(source_range=[start, end], fade_out=fade)

buzz = decode('tv-low-buzzing.mp3', 48000)
# Discard the isolated transient around 13.15s and the less stable lead-in.
steady = buzz[round(.35 * 48000):round(12.1 * 48000)].copy()
steady -= steady.mean(axis=0)
overlap = round(1.2 * 48000)
phase = np.linspace(0, np.pi / 2, overlap)[:, None]
join = steady[-overlap:] * np.cos(phase) + steady[:overlap] * np.sin(phase)
# The output boundary falls between adjacent samples from the original head.
# The actual tail/head transition is baked into the middle of the loop.
loop = np.concatenate([steady[overlap:-overlap], join])
delta = float(np.max(np.abs(loop[0] - loop[-1])))
ordinary_delta = float(np.percentile(np.abs(np.diff(loop, axis=0)), 99.9))
assert delta <= ordinary_delta, 'Loop boundary exceeds normal waveform slope'
assert np.max(np.abs(loop)) < .1, 'Unexpected loud transient in ambience'
report['tv-buzz-loop.wav'] = write('tv-buzz-loop.wav', loop, 48000)
report['tv-buzz-loop.wav'].update(
    source_range=[.35, 12.1], overlap=1.2,
    boundary_delta=round(delta, 6), ordinary_delta_999=round(ordinary_delta, 6),
    original_peak=round(float(np.max(np.abs(buzz))), 6),
)
print(json.dumps(report, ensure_ascii=False, indent=2))
