// src/config.js
const path = require("path");

module.exports = {
  paths: {
    ffmpeg:
      "C:/Users/chodi/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe",
    ffprobe:
      "C:/Users/chodi/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffprobe.exe",
    whisperExe: path.join(__dirname, "../../bin/whisper-cli.exe"),
    whisperModel: path.join(__dirname, "../../bin/ggml-large-v3.bin"),

    // Thư mục làm việc
    inputDir: path.join(__dirname, "../../input"),
    tempDir: path.join(__dirname, "../../temp"),
    outputDir: path.join(__dirname, "../../output"),

    // File cố định
    inputVideo: path.join(__dirname, "../../input/video_goc.mp4"),
    finalVideo: path.join(__dirname, "../../output/video_final.mp4"),
  },
  colors: {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
    red: "\x1b[31m",
  },
};
