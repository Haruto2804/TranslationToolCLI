// src/transcribe.js
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { paths, colors } = require("./config");

function processFullAudio(audioPath, threads) {
  return new Promise((resolve, reject) => {
    const args = [
      "-m",
      paths.whisperModel,
      "-f",
      audioPath,
      "-l",
      "zh",
      "--output-srt",
      "-t",
      threads.toString(),

      // Cấu hình đã được fix chuẩn để AI không bị đứng hình ở các khoảng lặng/nhạc
      "-mc",
      "32",
      "-ml",
      "64",
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
      " 🎙️  MODULE BÓC BĂNG WHISPER (ONE-SHOT NGUYÊN KHỐI - KHỚP 100%)" +
      colors.reset,
  );
  console.log(
    colors.magenta +
      "==================================================================\n" +
      colors.reset,
  );

  const inputAudioPath = path.join(paths.tempDir, "audio.wav");
  const finalSrtPath = path.join(paths.tempDir, "audio.srt");
  const rawSrtPath = inputAudioPath + ".srt"; // File do whisper mặc định sinh ra

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
        "❌ Không tìm thấy file chạy Whisper hoặc Model trong bin/" +
        colors.reset,
    );
    return;
  }

  const cpuCores = os.cpus().length;
  const recommendedThreads = Math.max(1, cpuCores - 2);

  console.log(
    colors.yellow +
      `📦 Đang nạp nguyên khối toàn bộ file audio. Không cắt xén để bảo toàn mốc thời gian...` +
      colors.reset,
  );

  // Xóa file SRT cũ nếu có để tránh ghi đè sai
  if (fs.existsSync(finalSrtPath)) fs.unlinkSync(finalSrtPath);
  if (fs.existsSync(rawSrtPath)) fs.unlinkSync(rawSrtPath);

  try {
    await processFullAudio(inputAudioPath, recommendedThreads);
  } catch (err) {
    console.log(
      colors.red + `⚠️ Tiến trình gặp lỗi: ${err.message}` + colors.reset,
    );
    return;
  }

  // Whisper-cli tự động tạo ra file audio.wav.srt. Mình đổi tên lại cho chuẩn.
  if (fs.existsSync(rawSrtPath)) {
    fs.renameSync(rawSrtPath, finalSrtPath);
    console.log(
      colors.green +
        `\n🎉 [HOÀN THÀNH] Phụ đề đã được trích xuất NGUYÊN BẢN, đảm bảo dính chặt từng mili-giây!` +
        colors.reset,
    );
    console.log(
      colors.cyan +
        `📂 File phụ đề tổng lưu tại: ${finalSrtPath}` +
        colors.reset,
    );
  } else {
    console.log(
      colors.red +
        "❌ Không tìm thấy file phụ đề đầu ra! Whisper có thể đã sập giữa chừng." +
        colors.reset,
    );
  }
}

module.exports = { runTranscription };
