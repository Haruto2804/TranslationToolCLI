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

  // 1. ĐỊNH NGHĨA CÁC ĐƯỜNG DẪN FILE (SỬ DỤNG HỆ THỐNG TARGET_X)
  const t1 = path.join(paths.tempDir, "target_1.srt");
  const t2 = path.join(paths.tempDir, "target_2.srt");
  const t3 = path.join(paths.tempDir, "target_3.srt");
  const audioSub = path.join(paths.tempDir, "audio.srt");

  let subs = [];

  // 2. GỘP FILE THÔNG MINH (TỰ ĐỘNG NHẬN DIỆN SỐ NGÔN NGỮ)
  if (fs.existsSync(t1) && fs.existsSync(t2) && fs.existsSync(t3)) {
    console.log(
      colors.green + "✅ Gộp 3 ngôn ngữ (Trung - Anh - Việt)" + colors.reset,
    );
    const s1 = parser.fromSrt(fs.readFileSync(t1, "utf8"));
    const s2 = parser.fromSrt(fs.readFileSync(t2, "utf8"));
    const s3 = parser.fromSrt(fs.readFileSync(t3, "utf8"));
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
    if (!fs.existsSync(source))
      return console.log(
        colors.red + "❌ Không tìm thấy file phụ đề!" + colors.reset,
      );
    subs = parser.fromSrt(fs.readFileSync(source, "utf8"));
  }

  // 3. TÍNH TOÁN CẤU HÌNH RENDER
  let videoWidth = 1920,
    videoHeight = 1080;
  try {
    const metadata = await ffprobeAsync(paths.inputVideo);
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
    marginV: Math.floor(videoHeight * (isVertical ? 0.15 : 0.08)),
    marginLR: Math.floor(videoWidth * 0.08),
    fontSize: Math.floor(videoHeight * (isVertical ? 0.045 : 0.05)),
    outline: Math.max(2, Math.floor(videoHeight * 0.004)),
    shadow: Math.max(1, Math.floor(videoHeight * 0.002)),
  };

  // 4. XÂY DỰNG FILE ASS
  const assPath = path.join(paths.tempDir, "auto_style.ass");
  let assContent = `[Script Info]\nPlayResX: ${styleConfig.playResX}\nPlayResY: ${styleConfig.playResY}\nScaledBorderAndShadow: yes\n\n`;
  assContent += `[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`;
  assContent += `Style: Default,Arial,${styleConfig.fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,${styleConfig.outline},${styleConfig.shadow},2,${styleConfig.marginLR},${styleConfig.marginLR},${styleConfig.marginV},1\n\n`;
  assContent += `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

  for (let sub of subs) {
    const lines = sub.text.trim().split(/\r?\n/);
    let textAss = "";
    if (lines.length >= 3) {
      // 3 Tầng: Trung (Vàng), Anh (Xanh), Việt (Trắng)
      textAss = `{\\fs${Math.floor(styleConfig.fontSize * 0.9)}\\1c&H00FFFF&\\b1}${lines[0]}\\N{\\fs${Math.floor(styleConfig.fontSize * 0.8)}\\1c&HFFFF00&\\b1}${lines[1]}\\N{\\fs${styleConfig.fontSize}\\1c&HFFFFFF&\\b1}${lines[2]}`;
    } else if (lines.length === 2) {
      // 2 Tầng: Anh (Vàng), Việt (Trắng)
      textAss = `{\\fs${Math.floor(styleConfig.fontSize * 0.9)}\\1c&HFFFF00&\\b1}${lines[0]}\\N{\\fs${styleConfig.fontSize}\\1c&HFFFFFF&\\b1}${lines[1]}`;
    } else {
      textAss = sub.text.replace(/\r?\n/g, "\\N");
    }
    assContent += `Dialogue: 0,${sub.startTime.replace(",", ".").slice(1, -1)},${sub.endTime.replace(",", ".").slice(1, -1)},Default,,0,0,0,,${textAss}\n`;
  }
  fs.writeFileSync(assPath, assContent, "utf8");

  // 5. RENDER BẰNG FFMPEG
  if (fs.existsSync(paths.finalVideo))
    try {
      fs.unlinkSync(paths.finalVideo);
    } catch (e) {
      return console.log(
        colors.red + "❌ File output đang bị khóa!" + colors.reset,
      );
    }

  console.log(colors.yellow + "🎬 Đang encode video..." + colors.reset);
  ffmpeg(paths.inputVideo)
    .videoFilters(`ass='${assPath.replace(/\\/g, "/").replace(":", "\\:")}'`)
    .outputOptions([
      "-c:v libx264",
      "-preset fast",
      "-crf 23",
      "-pix_fmt yuv420p",
      "-c:a copy",
    ])
    .on(
      "progress",
      (p) =>
        p.percent &&
        process.stdout.write(
          `\r${colors.cyan}🔄 Render: ${p.percent.toFixed(1)}% `,
        ),
    )
    .on("end", () =>
      console.log(
        colors.green +
          "\n🎉 Hoàn tất! Video tại: " +
          paths.finalVideo +
          colors.reset,
      ),
    )
    .on("error", (e) =>
      console.log(colors.red + "\n❌ Lỗi: " + e.message + colors.reset),
    )
    .save(paths.finalVideo);
}

module.exports = { renderVideo };
