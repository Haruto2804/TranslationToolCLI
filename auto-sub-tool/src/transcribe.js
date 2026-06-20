// src/transcribe.js
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { paths, colors } = require("./config");

const audioBlockDir = path.join(paths.tempDir, "audio_block");
const CHUNK_DURATION_SEC = 1200; // 20 phút mỗi block

function srtTimeToMs(timeStr) {
  const [hhmmss, mmm] = timeStr.split(",");
  const [hh, mm, ss] = hhmmss.split(":").map(Number);
  return (hh * 3600 + mm * 60 + ss) * 1000 + Number(mmm);
}

function msToSrtTime(ms) {
  const mmm = String(Math.floor(ms % 1000)).padStart(3, "0");
  let secs = Math.floor(ms / 1000);
  const hh = String(Math.floor(secs / 3600)).padStart(2, "0");
  secs %= 3600;
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss},${mmm}`;
}

function processWhisperChunk(chunkPath, threads) {
  return new Promise((resolve, reject) => {
    const args = [
      "-m",
      paths.whisperModel,
      "-f",
      chunkPath,
      "-l",
      "zh",
      "--output-srt",
      "-t",
      threads.toString(),

      // --- CÁC THAM SỐ ĐÃ ĐƯỢC TỐI ƯU ĐỂ CHỐNG LẶP ---

      // 1. Giới hạn Context: Không cho AI nhìn lại câu cũ để tránh bị cuốn vào vòng lặp
      "-mc",
      "0", // (hoặc --max-context 0)

      // 2. Tự động phát hiện ảo giác (Entropy & Logprob thresholds)
      // Nếu AI bắt đầu lặp, điểm Entropy sẽ tăng cao. Các chỉ số này giúp AI reset lại thay vì lặp tiếp.
      "-et",
      "2.4",
      "-lpt",
      "-1.0",

      // *LƯU Ý QUAN TRỌNG:
      // ĐÃ XÓA --temperature 0.2, --beam-size 1, --best-of 1
      // Hãy để Whisper tự động nâng nhiệt độ (fallback) khi phát hiện lỗi lặp.

      "--max-len",
      "128",
      "--no-prints",
    ];
    const whisperProcess = spawn(paths.whisperExe, args);

    whisperProcess.stdout.on("data", (data) => {
      const output = data.toString().trim();
      if (!output) return;
      const lines = output.split("\n");
      lines.forEach((line) => {
        const match = line.match(
          /^(\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\])(.*)/,
        );
        if (match) {
          console.log(
            `${colors.yellow}⏳ ${match[1]}${colors.reset} ${colors.cyan}💬 ${match[2].trim()}${colors.reset}`,
          );
        } else {
          console.log(colors.cyan + `💬 ${line.trim()}` + colors.reset);
        }
      });
    });

    whisperProcess.stderr.on("data", (data) => {
      const log = data.toString().trim();
      if (log && (log.includes("processing") || log.includes("%"))) {
        process.stdout.write(
          `\r${colors.dim}⚙️  [Tiến trình]: ${log}${colors.reset}`,
        );
      }
    });

    whisperProcess.on("close", (code) => {
      console.log("");
      if (code === 0) resolve();
      else reject(new Error(`Whisper lỗi với mã: ${code}`));
    });
  });
}

async function runTranscription() {
  console.log(
    colors.magenta +
      "\n==================================================================" +
      colors.reset,
  );
  console.log(
    colors.bright +
      " 🎙️  MODULE BÓC BĂNG WHISPER (TỐI ƯU HÓA ĐA LUỒNG)" +
      colors.reset,
  );
  console.log(
    colors.magenta +
      "==================================================================\n" +
      colors.reset,
  );

  const inputAudioPath = path.join(paths.tempDir, "audio.wav");
  const finalSrtPath = path.join(paths.tempDir, "audio.srt");

  if (!fs.existsSync(inputAudioPath)) {
    console.log(
      colors.red +
        "❌ Không tìm thấy file audio.wav! Vui lòng chạy Module 1 trước." +
        colors.reset,
    );
    return;
  }
  if (!fs.existsSync(paths.whisperExe) || !fs.existsSync(paths.whisperModel)) {
    console.log(
      colors.red +
        "❌ Không tìm thấy file chạy Whisper hoặc Model trong thư mục bin/" +
        colors.reset,
    );
    return;
  }

  if (!fs.existsSync(audioBlockDir))
    fs.mkdirSync(audioBlockDir, { recursive: true });

  const cpuCores = os.cpus().length;
  const recommendedThreads = Math.max(1, cpuCores - 2);

  console.log(
    colors.yellow +
      `📦 1. Đang cắt audio thành các đoạn nhỏ (để chống tràn RAM)...` +
      colors.reset,
  );

  // Dọn dẹp chunk cũ
  fs.readdirSync(audioBlockDir).forEach((f) =>
    fs.unlinkSync(path.join(audioBlockDir, f)),
  );

  // Cắt Audio
  const ffmpegCmd = `"${paths.ffmpeg}" -i "${inputAudioPath}" -f segment -segment_time ${CHUNK_DURATION_SEC} -c copy "${path.join(audioBlockDir, "chunk_%03d.wav")}" -y`;
  execSync(ffmpegCmd, { stdio: "ignore" });

  const chunks = fs
    .readdirSync(audioBlockDir)
    .filter((f) => f.startsWith("chunk_") && f.endsWith(".wav"))
    .sort();
  console.log(
    colors.green +
      `✅ Đã chia thành ${chunks.length} block audio.` +
      colors.reset,
  );

  let globalSrtContent = "";
  let globalSubIndex = 1;

  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(audioBlockDir, chunks[i]);
    const expectedSrtPath = chunkPath + ".srt";

    console.log(
      colors.bright +
        `\n▶️  [${i + 1}/${chunks.length}] ĐANG BÓC BĂNG: ${chunks[i]}` +
        colors.reset,
    );

    await processWhisperChunk(chunkPath, recommendedThreads);

    if (fs.existsSync(expectedSrtPath)) {
      const srtContent = fs.readFileSync(expectedSrtPath, "utf8");
      const offsetMs = i * CHUNK_DURATION_SEC * 1000;
      const blocks = srtContent.trim().split(/\n\s*\n/);

      for (const block of blocks) {
        const lines = block
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length >= 3) {
          const match = lines[1].match(
            /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/,
          );
          if (match) {
            const newStart = msToSrtTime(srtTimeToMs(match[1]) + offsetMs);
            const newEnd = msToSrtTime(srtTimeToMs(match[2]) + offsetMs);
            globalSrtContent += `${globalSubIndex}\n${newStart} --> ${newEnd}\n${lines.slice(2).join("\n")}\n\n`;
            globalSubIndex++;
          }
        }
      }
      fs.unlinkSync(expectedSrtPath);
    }
  }

  fs.writeFileSync(finalSrtPath, globalSrtContent.trim() + "\n", "utf8");
  console.log(
    colors.green +
      `\n🎉 [HOÀN THÀNH] Đã trích xuất và đồng bộ mốc thời gian thành công!` +
      colors.reset,
  );
  console.log(
    colors.cyan + `📂 File phụ đề tổng lưu tại: ${finalSrtPath}` + colors.reset,
  );
}

module.exports = { runTranscription };
