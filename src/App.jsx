import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Download,
  FileImage,
  FileText,
  Link,
  Palette,
  RefreshCw,
} from "lucide-react";

const errorLevels = ["L", "M", "Q", "H"];
const defaultUrl = "https://example.com";

function normalizeUrl(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    return parsed.toString();
  } catch {
    return "";
  }
}

function buildFilename(value, extension) {
  let base = "qr-code";

  try {
    base = new URL(value).hostname.replace(/^www\./, "") || base;
  } catch {
    // Keep the generic filename when the URL cannot be parsed.
  }

  const safeBase = base.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "");
  return `${safeBase || "qr-code"}-qr.${extension}`;
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function makeQrCanvas(value, options) {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, value, options);
  return canvas;
}

export default function App() {
  const canvasRef = useRef(null);
  const [rawUrl, setRawUrl] = useState(defaultUrl);
  const [foreground, setForeground] = useState("#111827");
  const [background, setBackground] = useState("#ffffff");
  const [size, setSize] = useState(320);
  const [margin, setMargin] = useState(2);
  const [errorLevel, setErrorLevel] = useState("M");
  const [status, setStatus] = useState("");

  const normalizedUrl = useMemo(() => normalizeUrl(rawUrl), [rawUrl]);
  const isValid = Boolean(normalizedUrl);
  const qrOptions = useMemo(
    () => ({
      width: size,
      margin,
      errorCorrectionLevel: errorLevel,
      color: {
        dark: foreground,
        light: background,
      },
    }),
    [background, errorLevel, foreground, margin, size],
  );

  useEffect(() => {
    let cancelled = false;

    async function renderQr() {
      if (!canvasRef.current || !isValid) {
        return;
      }

      try {
        await QRCode.toCanvas(canvasRef.current, normalizedUrl, qrOptions);
        if (!cancelled) {
          setStatus("");
        }
      } catch {
        if (!cancelled) {
          setStatus("Could not generate this QR code.");
        }
      }
    }

    renderQr();
    return () => {
      cancelled = true;
    };
  }, [isValid, normalizedUrl, qrOptions]);

  async function handleDownload(format) {
    if (!isValid) {
      setStatus("Enter a valid URL.");
      return;
    }

    try {
      const canvas = await makeQrCanvas(normalizedUrl, qrOptions);

      if (format === "png") {
        downloadDataUrl(canvas.toDataURL("image/png"), buildFilename(normalizedUrl, "png"));
        setStatus("PNG downloaded.");
        return;
      }

      if (format === "jpg") {
        const jpgCanvas = document.createElement("canvas");
        jpgCanvas.width = canvas.width;
        jpgCanvas.height = canvas.height;
        const context = jpgCanvas.getContext("2d");
        context.fillStyle = background;
        context.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);
        context.drawImage(canvas, 0, 0);
        downloadDataUrl(
          jpgCanvas.toDataURL("image/jpeg", 0.95),
          buildFilename(normalizedUrl, "jpg"),
        );
        setStatus("JPG downloaded.");
        return;
      }

      const png = canvas.toDataURL("image/png");
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imageSize = Math.min(360, pageWidth - 96);
      const x = (pageWidth - imageSize) / 2;
      const y = 96;

      pdf.addImage(png, "PNG", x, y, imageSize, imageSize);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(51, 65, 85);
      pdf.text(normalizedUrl, pageWidth / 2, y + imageSize + 36, {
        align: "center",
        maxWidth: pageWidth - 96,
      });
      pdf.save(buildFilename(normalizedUrl, "pdf"));
      setStatus("PDF downloaded.");
    } catch {
      setStatus("Download failed. Try again.");
    }
  }

  function resetOptions() {
    setForeground("#111827");
    setBackground("#ffffff");
    setSize(320);
    setMargin(2);
    setErrorLevel("M");
    setStatus("");
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="page-title">
        <div className="panel controls-panel">
          <div className="title-row">
            <div>
              <p className="eyebrow">Free React Tool</p>
              <h1 id="page-title">QR Code Generator</h1>
            </div>
            <button className="icon-button" type="button" onClick={resetOptions} title="Reset">
              <RefreshCw size={19} aria-hidden="true" />
              <span className="sr-only">Reset</span>
            </button>
          </div>

          <label className="field">
            <span>
              <Link size={17} aria-hidden="true" />
              URL
            </span>
            <input
              value={rawUrl}
              onChange={(event) => setRawUrl(event.target.value)}
              placeholder="https://example.com"
              spellCheck="false"
              inputMode="url"
              aria-invalid={!isValid}
            />
          </label>

          <div className="control-grid">
            <label className="field">
              <span>
                <Palette size={17} aria-hidden="true" />
                Foreground
              </span>
              <input
                className="color-input"
                type="color"
                value={foreground}
                onChange={(event) => setForeground(event.target.value)}
              />
            </label>

            <label className="field">
              <span>
                <Palette size={17} aria-hidden="true" />
                Background
              </span>
              <input
                className="color-input"
                type="color"
                value={background}
                onChange={(event) => setBackground(event.target.value)}
              />
            </label>
          </div>

          <label className="range-field">
            <span>Size</span>
            <input
              type="range"
              min="180"
              max="640"
              step="20"
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
            <output>{size}px</output>
          </label>

          <label className="range-field">
            <span>Margin</span>
            <input
              type="range"
              min="0"
              max="6"
              step="1"
              value={margin}
              onChange={(event) => setMargin(Number(event.target.value))}
            />
            <output>{margin}</output>
          </label>

          <div className="segmented" aria-label="Error correction">
            {errorLevels.map((level) => (
              <button
                className={errorLevel === level ? "active" : ""}
                key={level}
                type="button"
                onClick={() => setErrorLevel(level)}
              >
                {level}
              </button>
            ))}
          </div>

          <div className="download-row" aria-label="Download QR code">
            <button type="button" onClick={() => handleDownload("png")}>
              <FileImage size={18} aria-hidden="true" />
              PNG
            </button>
            <button type="button" onClick={() => handleDownload("jpg")}>
              <Download size={18} aria-hidden="true" />
              JPG
            </button>
            <button type="button" onClick={() => handleDownload("pdf")}>
              <FileText size={18} aria-hidden="true" />
              PDF
            </button>
          </div>

          <p className={`status ${isValid ? "" : "error"}`} aria-live="polite">
            {status || (!isValid ? "Enter a valid URL." : normalizedUrl)}
          </p>
        </div>

        <div className="preview-panel" aria-label="QR code preview">
          <div className="preview-surface">
            {isValid ? (
              <canvas ref={canvasRef} width={size} height={size} />
            ) : (
              <div className="empty-preview">QR</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
