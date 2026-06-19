// src/cutter.js
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { paths, colors } = require("./config");

async function cutVideo(durationSeconds) {
  const outputDir = path.join(paths.tempDir, "video_chunks");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log(
    colors.cyan +
      `\n✂️ Đang cắt video thành các đoạn ${durationSeconds} giây...` +
      colors.reset,
  );

  // Lệnh ffmpeg để cắt segment
  const ffmpegCmd = `"${paths.ffmpeg}" -i "${paths.inputVideo}" -c copy -map 0 -f segment -segment_time ${durationSeconds} -reset_timestamps 1 "${path.join(outputDir, "chunk_%03d.mp4")}"`;

  try {
    execSync(ffmpegCmd, { stdio: "inherit" });
    console.log(
      colors.green +
        `✅ Cắt thành công! Các file nằm trong: ${outputDir}` +
        colors.reset,
    );
  } catch (err) {
    console.log(colors.red + "❌ Lỗi cắt video: " + err.message + colors.reset);
  }
}

module.exports = { cutVideo };
