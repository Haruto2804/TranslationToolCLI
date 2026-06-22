// src/render.js
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const util = require("util");
const SRTParser = require("srt-parser-2").default;
const { paths, colors } = require("./config");

const ffprobeAsync = util.promisify(ffmpeg.ffprobe);
const parser = new SRTParser();

ffmpeg.setFfmpegPath(paths.ffmpeg);
ffmpeg.setFfprobePath(paths.ffprobe);

// Hàm helper convert SRT time (HH:MM:SS,mmm) sang ASS time (H:MM:SS.cc)
function convertSrtToAssTime(srtTime) {
  // srtTime có dạng "00:05:23,127"
  const [time, ms] = srtTime.replace(",", ".").split(".");
  if (!ms) return srtTime;

  // Làm tròn toán học từ 3 chữ số về 2 chữ số
  const cs = Math.round(parseInt(ms, 10) / 10)
    .toString()
    .padStart(2, "0");

  // Đảm bảo định dạng H:MM:SS (bỏ số 0 thừa ở đầu block giờ nếu có)
  const cleanTime = time.startsWith("0") ? time.slice(1) : time;
  return `${cleanTime}.${cs}`;
}

async function renderVideo() {
  console.log(
    colors.magenta +
      "\n========================================================" +
      colors.reset,
  );
  console.log(
    colors.bright +
      " 🛠️  MODULE RENDER HARDSUB (AUTO-SCALE & MULTI-COLOR)" +
      colors.reset,
  );
  console.log(
    colors.magenta +
      "========================================================\n" +
      colors.reset,
  );

  const t1 = path.join(paths.tempDir, "target_1.srt");
  const t2 = path.join(paths.tempDir, "target_2.srt");
  const t3 = path.join(paths.tempDir, "target_3.srt");
  const audioSub = path.join(paths.tempDir, "audio.srt");

  // BÍ QUYẾT: Ưu tiên dùng video đã được ép khung hình CFR ở Module 1
  const cfrVideoPath = path.join(paths.tempDir, "video_cfr.mp4");
  const targetVideo = fs.existsSync(cfrVideoPath)
    ? cfrVideoPath
    : paths.inputVideo;

  if (targetVideo === cfrVideoPath) {
    console.log(
      colors.green +
        "✅ Đang dùng Video chuẩn CFR để render (Chống lệch sub)" +
        colors.reset,
    );
  } else {
    console.log(
      colors.yellow +
        "⚠️ Cảnh báo: Không tìm thấy Video CFR, đang dùng video gốc!" +
        colors.reset,
    );
  }

  let subs = [];

  // GỘP FILE THÔNG MINH
  if (fs.existsSync(t1) && fs.existsSync(t2) && fs.existsSync(t3)) {
    console.log(
      colors.green + "✅ Gộp 3 ngôn ngữ (Trung - Anh - Việt)" + colors.reset,
    );
    const s1 = parser.fromSrt(fs.readFileSync(t1, "utf8"));
    const s2 = parser.fromSrt(fs.readFileSync(t2, "utf8"));
    const s3 = parser.fromSrt(fs.readFileSync(t3, "utf8"));
    if (s1.length !== s2.length || s1.length !== s3.length) {
      console.log(
        colors.yellow +
          `⚠️ Cảnh báo: Số lượng dòng sub không khớp! (T1: ${s1.length}, T2: ${s2.length}, T3: ${s3.length}). Sub có thể bị lệch index.` +
          colors.reset,
      );
    }
    subs = s1.map((sub, i) => ({
      ...sub,
      text: `${sub.text}\n${s2[i]?.text || ""}\n${s3[i]?.text || ""}`,
    }));
  } else if (fs.existsSync(t1) && fs.existsSync(t2)) {
    console.log(colors.green + "✅ Gộp 2 ngôn ngữ (Anh - Việt)" + colors.reset);
    const s1 = parser.fromSrt(fs.readFileSync(t1, "utf8"));
    const s2 = parser.fromSrt(fs.readFileSync(t2, "utf8"));
    subs = s1.map((sub, i) => ({
      ...sub,
      text: `${sub.text}\n${s2[i]?.text || ""}`,
    }));
  } else {
    const source = fs.existsSync(t1) ? t1 : audioSub;
    if (!fs.existsSync(source)) {
      console.log(colors.red + "❌ Không tìm thấy file phụ đề!" + colors.reset);
      return;
    }
    subs = parser.fromSrt(fs.readFileSync(source, "utf8"));
  }

  // TÍNH TOÁN CẤU HÌNH RENDER TỪ VIDEO MỤC TIÊU
  let videoWidth = 1920,
    videoHeight = 1080;
  try {
    const metadata = await ffprobeAsync(targetVideo);
    const vStream = metadata.streams.find((s) => s.codec_type === "video");
    if (vStream) {
      videoWidth = vStream.width;
      videoHeight = vStream.height;
    }
  } catch (e) {
    console.log(colors.yellow + "⚠️ Dùng 1080p mặc định." + colors.reset);
  }

  const isVertical = videoHeight > videoWidth;

  const styleConfig = {
    playResX: videoWidth,
    playResY: videoHeight,
    marginV: Math.floor(videoHeight * (isVertical ? 0.12 : 0.08)),
    marginLR: Math.floor(videoWidth * 0.05),
    fontSize: Math.floor(videoHeight * (isVertical ? 0.038 : 0.05)),
    outline: Math.max(2.5, Math.floor(videoHeight * 0.005)),
    shadow: Math.max(1.5, Math.floor(videoHeight * 0.003)),
  };

  // XÂY DỰNG FILE ASS
  const assPath = path.join(paths.tempDir, "auto_style.ass");
  let assContent = `[Script Info]\nPlayResX: ${styleConfig.playResX}\nPlayResY: ${styleConfig.playResY}\nScaledBorderAndShadow: yes\n\n`;
  assContent += `[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`;
  assContent += `Style: Default,Be VietNam Pro,${styleConfig.fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${styleConfig.outline},${styleConfig.shadow},2,${styleConfig.marginLR},${styleConfig.marginLR},${styleConfig.marginV},1\n\n`;
  assContent += `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

  for (let sub of subs) {
    const lines = sub.text.trim().split(/\r?\n/);
    let textAss = "";

    if (lines.length >= 3) {
      // 3 Tầng: Dòng 1 (Vàng) - Dòng 2 (Blue) - Dòng 3 (Hồng Bocchi)
      const size1 = Math.floor(styleConfig.fontSize * 0.75);
      const size2 = Math.floor(styleConfig.fontSize * 0.85);
      const size3 = styleConfig.fontSize;

      textAss = [
        `{\\fs${size1}\\1c&H00FFFF&}${lines[0]}`, // Vàng
        `{\\fs${size2}\\1c&HFFFF80&}${lines[1]}`, // Xanh dương nhạt
        `{\\fs${size3}\\1c&HFFC0FF&}${lines[2]}`, // Hồng nhạt
      ].join("\\N");
    } else if (lines.length === 2) {
      textAss = `{\\fs${Math.floor(styleConfig.fontSize * 0.8)}\\1c&H00FFFF&}${lines[0]}\\N{\\fs${styleConfig.fontSize}\\1c&HB4A2F7&}${lines[1]}`;
    } else {
      textAss = `{\\1c&HB4A2F7&}${sub.text.replace(/\r?\n/g, "\\N")}`;
    }

    const startAss = convertSrtToAssTime(sub.startTime);
    const endAss = convertSrtToAssTime(sub.endTime);

    assContent += `Dialogue: 0,${startAss},${endAss},Default,,0,0,0,,${textAss}\n`;
  }
  fs.writeFileSync(assPath, assContent, "utf8");

  // RENDER BẰNG FFMPEG
  if (fs.existsSync(paths.finalVideo)) {
    try {
      fs.unlinkSync(paths.finalVideo);
    } catch (e) {
      console.log(colors.red + "❌ File output đang bị khóa!" + colors.reset);
      return;
    }
  }

  console.log(colors.yellow + "🎬 Đang encode video..." + colors.reset);

  return new Promise((resolve, reject) => {
    // Ép render vào video mục tiêu (video_cfr.mp4)
    ffmpeg(targetVideo)
      .videoFilters(`ass='${assPath.replace(/\\/g, "/").replace(":", "\\:")}'`)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-pix_fmt yuv420p",
        "-c:a copy", // Copy nguyên vẹn âm thanh CFR chuẩn
      ])
      .on("progress", (p) => {
        if (p.percent) {
          process.stdout.write(
            `\r${colors.cyan}🔄 Render: ${p.percent.toFixed(1)}% `,
          );
        }
      })
      .on("end", () => {
        console.log(
          colors.green +
            "\n🎉 Hoàn tất! Video tại: " +
            paths.finalVideo +
            colors.reset,
        );
        resolve();
      })
      .on("error", (e) => {
        console.log(colors.red + "\n❌ Lỗi: " + e.message + colors.reset);
        reject(e);
      })
      .save(paths.finalVideo);
  });
}

module.exports = { renderVideo };
