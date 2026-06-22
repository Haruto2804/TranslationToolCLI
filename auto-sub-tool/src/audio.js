// src/audio.js
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const { paths, colors } = require("./config");

ffmpeg.setFfmpegPath(paths.ffmpeg);

async function extractAudio() {
  console.log(
    colors.cyan +
      "\n🎬 BƯỚC 1: TIỀN XỬ LÝ VIDEO & TÁCH ÂM THANH..." +
      colors.reset,
  );

  if (!fs.existsSync(paths.inputVideo)) {
    console.log(
      colors.red +
        `❌ Không tìm thấy video gốc tại: ${paths.inputVideo}` +
        colors.reset,
    );
    console.log(
      colors.yellow +
        "👉 Vui lòng copy 1 video đặt tên là 'video_goc.mp4' vào thư mục input/" +
        colors.reset,
    );
    return;
  }

  // Khai báo đường dẫn mới
  const cfrVideoPath = path.join(paths.tempDir, "video_cfr.mp4");
  const outputAudioPath = path.join(paths.tempDir, "audio.wav");

  // ==========================================
  // GIAI ĐOẠN 1: CHUẨN HÓA VIDEO (CHỐNG VFR)
  // ==========================================
  console.log(
    colors.yellow +
      "🔄 1/2: Đang ép video về chuẩn CFR (Khung hình cố định) để chống lệch sub..." +
      colors.reset,
  );

  await new Promise((resolve, reject) => {
    ffmpeg(paths.inputVideo)
      .outputOptions([
        "-vsync cfr",
        "-c:v libx264",
        "-crf 22",
        "-preset fast",
        "-c:a copy",
      ])
      .on("progress", (progress) => {
        if (progress.percent) {
          process.stdout.write(
            `\r⚙️  Đang đồng bộ khung hình: ${colors.bright}${Math.round(
              progress.percent,
            )}%${colors.reset}`,
          );
        }
      })
      .on("end", () => {
        console.log(
          colors.green + "\n✅ Đã chuẩn hóa video thành công!" + colors.reset,
        );
        resolve();
      })
      .on("error", (err) => {
        console.log(
          colors.red +
            "\n❌ Lỗi chuẩn hóa video: " +
            err.message +
            colors.reset,
        );
        reject(err);
      })
      .save(cfrVideoPath);
  });

  // ==========================================
  // GIAI ĐOẠN 2: TÁCH & LỌC ÂM THANH TỪ VIDEO CFR
  // ==========================================
  console.log(
    colors.yellow +
      "🔄 2/2: Đang tách và lọc tạp âm (16kHz, Mono) cho Whisper..." +
      colors.reset,
  );

  return new Promise((resolve, reject) => {
    // LƯU Ý: Lấy nguồn từ video ĐÃ CHUẨN HÓA (cfrVideoPath)
    ffmpeg(cfrVideoPath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioChannels(1)
      .audioFrequency(16000)
      // Bộ lọc tăng rõ giọng nói cho Whisper
      .audioFilters("highpass=f=200, lowpass=f=3000, volume=2.0")
      .on("progress", (progress) => {
        if (progress.percent) {
          process.stdout.write(
            `\r🎙️  Đang xử lý âm thanh: ${colors.bright}${Math.round(
              progress.percent,
            )}%${colors.reset}`,
          );
        }
      })
      .on("end", () => {
        console.log(
          colors.green +
            `\n✅ Tách âm thanh hoàn tất! Lưu tại: ${outputAudioPath}` +
            colors.reset,
        );
        resolve(outputAudioPath);
      })
      .on("error", (err) => {
        console.log(
          colors.red + "\n❌ Lỗi tách âm thanh: " + err.message + colors.reset,
        );
        reject(err);
      })
      .save(outputAudioPath);
  });
}

module.exports = { extractAudio };
