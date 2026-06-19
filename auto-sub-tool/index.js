// index.js
const inquirer = require("inquirer");
const { colors } = require("./src/config");

const audioModule = require("./src/audio");
const transcribeModule = require("./src/transcribe");
const translateModule = require("./src/translate");
const renderModule = require("./src/render");
const cutterModule = require("./src/cutter");

async function mainMenu() {
  while (true) {
    console.log(
      colors.cyan + "\n--- HỆ THỐNG LÀM SUB TỰ ĐỘNG ---" + colors.reset,
    );

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Chọn tác vụ:",
        choices: [
          "1. Trích xuất Audio",
          "2. Bóc băng (Whisper)",
          "3. Xuất Template dịch thuật",
          "4. Render Hardsub",
          "5. Cắt video thành đoạn nhỏ",
          "Thoát",
        ],
      },
    ]);

    switch (action) {
      case "1. Trích xuất Audio":
        await audioModule.extractAudio();
        break;

      case "2. Bóc băng (Whisper)":
        await transcribeModule.runTranscription();
        break;

      case "3. Xuất Template dịch thuật": {
        const { langMode } = await inquirer.prompt([
          {
            type: "list",
            name: "langMode",
            message: "Chọn số lượng ngôn ngữ muốn hiển thị:",
            choices: [
              { name: "1 Ngôn ngữ (Gốc)", value: "1" },
              { name: "2 Ngôn ngữ (Gốc + Dịch)", value: "2" },
              { name: "3 Ngôn ngữ (Gốc + Dịch 1 + Dịch 2)", value: "3" },
            ],
          },
        ]);

        await translateModule.exportTemplateForAI(langMode);
        translateModule.showInstruction(langMode);

        await inquirer.prompt([
          {
            type: "input",
            name: "wait",
            message: "Nhấn Enter để về menu chính...",
          },
        ]);
        break;
      }

      case "4. Render Hardsub":
        await renderModule.renderVideo();
        break;

      case "5. Cắt video thành đoạn nhỏ": {
        const { duration } = await inquirer.prompt([
          {
            type: "input",
            name: "duration",
            message: "Nhập số giây mỗi đoạn (ví dụ: 600):",
            default: "600",
          },
        ]);

        await cutterModule.cutVideo(parseInt(duration));
        break;
      }

      default:
        process.exit(0);
    }
  }
}

// start
mainMenu();
