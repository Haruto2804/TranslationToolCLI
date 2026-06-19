const fs = require("fs");
const path = require("path");
const { paths, colors } = require("./config");
const SRTParser = require("srt-parser-2").default;
const parser = new SRTParser();

const inputSrtPath = path.join(paths.tempDir, "audio.srt");

async function exportTemplateForAI(mode) {
  if (!fs.existsSync(inputSrtPath)) {
    console.log(colors.red + "❌ Lỗi: Không tìm thấy audio.srt" + colors.reset);
    return;
  }

  // Dọn dẹp file cũ
  ["target_1.srt", "target_2.srt", "target_3.srt"].forEach((f) => {
    const p = path.join(paths.tempDir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  const srtContent = fs.readFileSync(inputSrtPath, "utf8");
  const subtitles = parser.fromSrt(srtContent);

  // target_1 luôn là file gốc
  fs.writeFileSync(
    path.join(paths.tempDir, "target_1.srt"),
    srtContent,
    "utf8",
  );

  // Tạo các file target tiếp theo dựa trên chế độ
  if (mode >= 2)
    createEmptySrt("target_2.srt", subtitles, "Dịch ngôn ngữ 2 ở đây");
  if (mode === "3")
    createEmptySrt("target_3.srt", subtitles, "Dịch ngôn ngữ 3 ở đây");

  console.log(
    colors.green +
      `✅ Đã tạo ${mode} file template trong thư mục temp/` +
      colors.reset,
  );
}

function createEmptySrt(fileName, subs, placeholder) {
  const emptySubs = subs.map((sub) => ({ ...sub, text: placeholder }));
  fs.writeFileSync(
    path.join(paths.tempDir, fileName),
    parser.toSrt(emptySubs),
    "utf8",
  );
}

function showInstruction(mode) {
  console.log(colors.magenta + `\n📝 HƯỚNG DẪN DỊCH (CHẾ ĐỘ ${mode} NGÔN NGỮ)`);
  const files =
    mode === "3"
      ? "target_1.srt, target_2.srt, target_3.srt"
      : mode === "2"
        ? "target_1.srt, target_2.srt"
        : "target_1.srt";
  console.log(`1. Mở các file: ${files} trong thư mục temp/`);
  console.log("2. Điền bản dịch vào và Lưu lại (Ctrl+S).");
  console.log("3. Chọn [4] để Render ra video.\n" + colors.reset);
}

module.exports = { exportTemplateForAI, showInstruction };
