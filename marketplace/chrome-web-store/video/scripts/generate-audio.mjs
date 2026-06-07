import fs from "node:fs";
import path from "node:path";

const sampleRate = 44100;
const duration = 30;
const channels = 2;
const totalSamples = sampleRate * duration;
const dataSize = totalSamples * channels * 2;
const outDir = path.join(process.cwd(), "public", "audio");
const outFile = path.join(outDir, "ambient.wav");

fs.mkdirSync(outDir, { recursive: true });

const buffer = Buffer.alloc(44 + dataSize);

function writeString(offset, value) {
  buffer.write(value, offset, value.length, "ascii");
}

writeString(0, "RIFF");
buffer.writeUInt32LE(36 + dataSize, 4);
writeString(8, "WAVE");
writeString(12, "fmt ");
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(channels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * channels * 2, 28);
buffer.writeUInt16LE(channels * 2, 32);
buffer.writeUInt16LE(16, 34);
writeString(36, "data");
buffer.writeUInt32LE(dataSize, 40);

const notes = [110, 146.83, 196, 246.94, 293.66];
const hits = [4.8, 9.4, 14.1, 19.1, 24.4, 27.7];

for (let i = 0; i < totalSamples; i += 1) {
  const t = i / sampleRate;
  const fadeIn = Math.min(1, t / 1.4);
  const fadeOut = Math.min(1, (duration - t) / 2);
  const envelope = fadeIn * fadeOut;
  const chord =
    notes.reduce((sum, frequency, index) => {
      const drift = Math.sin(t * 0.17 + index) * 0.4;
      return sum + Math.sin((t * (frequency + drift) * Math.PI * 2) + index) * (0.08 / (index + 1));
    }, 0) * envelope;

  const pulse = hits.reduce((sum, hit) => {
    const delta = t - hit;
    if (delta < 0 || delta > 0.22) return sum;
    return sum + Math.sin(delta * 620 * Math.PI * 2) * Math.exp(-delta * 18) * 0.18;
  }, 0);

  const sample = Math.max(-1, Math.min(1, chord + pulse));
  const value = Math.round(sample * 32767);
  const offset = 44 + i * channels * 2;
  buffer.writeInt16LE(value, offset);
  buffer.writeInt16LE(value, offset + 2);
}

fs.writeFileSync(outFile, buffer);
console.log(`Generated ${outFile}`);
