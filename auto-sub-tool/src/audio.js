// src/audio.js
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const { paths, colors } = require("./config");

ffmpeg.setFfmpegPath(paths.ffmpeg);

async function extractAudio() {
  console.log(
    colors.cyan +
      "\n🎬 Bắt đầu tách âm thanh chuẩn (16kHz, Mono) từ video..." +
      colors.reset,
  );

  const outputAudioPath = path.join(paths.tempDir, "audio.wav");

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

  return new Promise((resolve, reject) => {
    ffmpeg(paths.inputVideo)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioChannels(1)
      .audioFrequency(16000)
      .on("progress", (progress) => {
        if (progress.percent) {
          process.stdout.write(
            `\r🔄 Đang xử lý: ${colors.bright}${Math.round(progress.percent)}%${colors.reset}`,
          );
        }
      })
      .on("end", () => {
        console.log(
          colors.green +
            `\n✅ Tách âm thanh thành công! Lưu tại: ${outputAudioPath}` +
            colors.reset,
        );
        resolve(outputAudioPath);
      })
      .on("error", (err) => {
        console.log(
          colors.red + "\n❌ Lỗi FFmpeg: " + err.message + colors.reset,
        );
        reject(err);
      })
      .save(outputAudioPath);
  });
}

module.exports = { extractAudio };
