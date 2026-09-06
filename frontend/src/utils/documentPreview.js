import mammoth from "mammoth";
import JSZip from "jszip";
import { renderAsync as renderDocxAsync } from "docx-preview";
import { init as initPptxPreview } from "pptx-preview";
import ExcelJS from "exceljs";
import { getValidAccessToken } from "./tokenManager";

async function fetchSourceArrayBuffer(sourceUrl) {
  const isBlobUrl = sourceUrl.startsWith("blob:");
  if (isBlobUrl) {
    const response = await fetch(sourceUrl);
    return response.arrayBuffer();
  }

  const token = await getValidAccessToken();
  const response = await fetch(sourceUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.arrayBuffer();
}

/**
 * Convert Word document (dataUrl) to HTML
 */
export async function docxToHtml(dataUrl) {
  try {
    const arrayBuffer = await fetchSourceArrayBuffer(dataUrl);
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error("Error converting DOCX:", error);
    throw error;
  }
}

/**
 * Convert Excel file (dataUrl) to HTML table
 */
export async function xlsxToHtml(dataUrl) {
  try {
    const sheets = await xlsxToSheetHtml(dataUrl);

    return `<div style="display: flex; flex-direction: column; gap: 20px;">${sheets
      .map(
        (sheet) =>
          `<section><div style="margin-bottom: 12px;"><strong style="color: #1f2937;">${escapeHtml(
            sheet.name,
          )}</strong></div>${sheet.html}</section>`,
      )
      .join("")}</div>`;
  } catch (error) {
    console.error("Error converting XLSX:", error);
    throw error;
  }
}

/**
 * Convert Excel file (dataUrl) to separate sheet HTML blocks
 */
export async function xlsxToSheetHtml(dataUrl) {
  try {
    const arrayBuffer = await fetchSourceArrayBuffer(dataUrl);
    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(arrayBuffer);

    return workbook.worksheets.map((worksheet) => {
      const rowCount = worksheet.rowCount;
      let html =
        '<div style="font-family: monospace; font-size: 12px; color: #111827; overflow: auto; width: max-content; min-width: 100%;">';
      html +=
        '<table style="border-collapse: collapse; margin-bottom: 20px; background: #ffffff; box-shadow: 0 8px 24px rgba(15,23,42,0.08);">';

      for (let rowNumber = 1; rowNumber <= rowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        const cellCount = Math.max(row.cellCount, row.actualCellCount);

        if (cellCount === 0) {
          continue;
        }

        html += `<tr>`;
        for (let cellNumber = 1; cellNumber <= cellCount; cellNumber += 1) {
          const isFirstRow = rowNumber === 1;
          const value = formatExcelCellValue(row.getCell(cellNumber).value);
          html += `<td style="border: 1px solid #d7deea; min-width: 120px; padding: 10px 14px; text-align: left; background: ${
            isFirstRow ? "#f8fbff" : "#ffffff"
          }; color: #111827;">${escapeHtml(value)}</td>`;
        }
        html += `</tr>`;
      }

      html += "</table>";
      html += "</div>";
      return { name: worksheet.name, html };
    });
  } catch (error) {
    console.error("Error converting XLSX:", error);
    throw error;
  }
}

/**
 * Convert PowerPoint document (dataUrl/objectUrl) to lightweight HTML
 */
export async function pptxToHtml(sourceUrl) {
  try {
    const arrayBuffer = await fetchSourceArrayBuffer(sourceUrl);
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slidePaths = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((left, right) => {
        const leftIndex = Number.parseInt(
          left.match(/slide(\d+)\.xml$/)?.[1] ?? "0",
          10,
        );
        const rightIndex = Number.parseInt(
          right.match(/slide(\d+)\.xml$/)?.[1] ?? "0",
          10,
        );
        return leftIndex - rightIndex;
      });

    let html =
      '<div style="font-family: monospace; font-size: 12px; line-height: 1.7; color: rgba(255,255,255,0.82);">';

    for (let index = 0; index < slidePaths.length; index++) {
      const xml = await zip.files[slidePaths[index]].async("text");
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "application/xml");
      const texts = [...doc.getElementsByTagName("a:t")]
        .map((node) => node.textContent?.trim() ?? "")
        .filter(Boolean);

      html += `<section style="padding: 16px 0;${index > 0 ? " border-top: 1px solid rgba(255,255,255,0.08);" : ""}">`;
      html += `<div style="font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 10px;">Slide ${index + 1}</div>`;

      if (texts.length === 0) {
        html +=
          '<div style="color: rgba(255,255,255,0.38);">No extractable text on this slide.</div>';
      } else {
        html +=
          '<div style="display: flex; flex-direction: column; gap: 6px;">';
        texts.forEach((text, textIndex) => {
          html += `<div style="padding-left: ${textIndex === 0 ? "0" : "10px"}; color: ${textIndex === 0 ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.74)"};">${escapeHtml(text)}</div>`;
        });
        html += "</div>";
      }

      html += "</section>";
    }

    html += "</div>";
    return html;
  } catch (error) {
    console.error("Error converting PPTX:", error);
    throw error;
  }
}

/**
 * Render DOCX into an element while preserving layout and embedded images
 */
export async function renderDocxPreview(sourceUrl, container, options = {}) {
  const arrayBuffer = await fetchSourceArrayBuffer(sourceUrl);
  container.innerHTML = "";

  await renderDocxAsync(arrayBuffer, container, container, {
    className: "preview-docx",
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    useBase64URL: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
    ...options,
  });
}

/**
 * Render PPTX into an element while preserving slide layout
 */
export async function renderPptxPreview(sourceUrl, container, options = {}) {
  const {
    width = 960,
    height = 540,
    mode = "list",
    firstSlideOnly = false,
  } = options;
  const arrayBuffer = await fetchSourceArrayBuffer(sourceUrl);

  container.innerHTML = "";

  const previewer = initPptxPreview(container, {
    width,
    height,
    mode: firstSlideOnly ? "slide" : mode,
  });

  if (firstSlideOnly) {
    await previewer.load(arrayBuffer);
    previewer.renderSingleSlide(0);
  } else {
    await previewer.preview(arrayBuffer);
  }

  return previewer;
}

function formatExcelCellValue(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("");
    }

    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("result" in value) {
      return formatExcelCellValue(value.result);
    }

    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.text ?? value.hyperlink;
    }

    if ("formula" in value && typeof value.formula === "string") {
      return value.formula;
    }

    if ("error" in value) {
      return value.error;
    }
  }

  return String(value);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
