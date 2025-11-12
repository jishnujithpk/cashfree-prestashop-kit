const form = document.getElementById('codeForm');
const contentInput = document.getElementById('content');
const barcodeOutput = document.getElementById('barcodeOutput');
const qrOutput = document.getElementById('qrOutput');
const feedback = document.getElementById('feedback');
const downloadPngBtn = document.getElementById('downloadPng');
const downloadSvgBtn = document.getElementById('downloadSvg');
const copyBtn = document.getElementById('copyData');
const resetBtn = document.getElementById('resetBtn');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistory');
const scrollButtons = document.querySelectorAll('[data-scroll-target]');

const historyKey = 'codeStudioHistory';

const getFormValues = () => ({
  type: form.codeType.value,
  content: contentInput.value.trim(),
  barcodeFormat: document.getElementById('barcodeFormat').value,
  qrErrorLevel: document.getElementById('qrErrorLevel').value,
  lineColor: document.getElementById('lineColor').value,
  backgroundColor: document.getElementById('backgroundColor').value,
  codeWidth: parseInt(document.getElementById('codeWidth').value, 10) || 2,
  codeHeight: parseInt(document.getElementById('codeHeight').value, 10) || 120,
  showValue: document.getElementById('showValue').checked,
});

const setFeedback = (message, type = 'info') => {
  feedback.textContent = message;
  feedback.dataset.type = type;
};

const dataUrlFromSvg = (svg) => {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
};

const downloadDataUrl = (dataUrl, filename) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadCanvas = (canvas, filename) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      setFeedback('Unable to export image. Please try again.', 'error');
      return;
    }
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, filename);
    URL.revokeObjectURL(url);
  });
};

const renderBarcode = (options) => {
  try {
    JsBarcode(barcodeOutput, options.content, {
      format: options.barcodeFormat,
      lineColor: options.lineColor,
      background: options.backgroundColor,
      width: options.codeWidth,
      height: options.codeHeight,
      displayValue: options.showValue,
      font: 'Inter',
      fontOptions: '600',
      textMargin: 8,
      margin: 20,
    });
    barcodeOutput.style.display = 'block';
    qrOutput.style.display = 'none';
    qrOutput.innerHTML = '';
    return true;
  } catch (error) {
    console.error(error);
    setFeedback('This data cannot be encoded with the selected barcode format.', 'error');
    return false;
  }
};

const renderQrCode = (options) => {
  qrOutput.innerHTML = '';
  const qr = new QRCode(qrOutput, {
    text: options.content,
    width: 280,
    height: 280,
    colorDark: options.lineColor,
    colorLight: options.backgroundColor,
    correctLevel: QRCode.CorrectLevel[options.qrErrorLevel] || QRCode.CorrectLevel.M,
  });
  barcodeOutput.style.display = 'none';
  qrOutput.style.display = 'grid';
  return qr;
};

const saveHistoryItem = (item) => {
  const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
  history.unshift(item);
  const trimmed = history.slice(0, 10);
  localStorage.setItem(historyKey, JSON.stringify(trimmed));
  renderHistory(trimmed);
};

const renderHistory = (items) => {
  historyList.innerHTML = '';
  if (!items.length) {
    historyList.innerHTML = '<p class="hint">Generate a code to see it saved here.</p>';
    return;
  }

  items.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'history-card';

    const preview = document.createElement('div');
    preview.className = 'history-card__preview';
    if (item.type === 'barcode') {
      preview.innerHTML = item.svg;
    } else {
      const img = document.createElement('img');
      img.src = item.png;
      img.alt = 'QR code preview';
      preview.appendChild(img);
    }

    const meta = document.createElement('div');
    meta.className = 'history-card__meta';
    meta.innerHTML = `
      <strong>${item.type === 'barcode' ? 'Barcode' : 'QR Code'}</strong>
      <span>Data: ${item.content.slice(0, 60)}${item.content.length > 60 ? '…' : ''}</span>
      <span>${new Date(item.created).toLocaleString()}</span>
      <div class="history-card__actions">
        <button class="btn btn--ghost" data-history-download="${index}" data-type="${item.type}" data-format="png">PNG</button>
        <button class="btn btn--ghost" data-history-download="${index}" data-type="${item.type}" data-format="svg">SVG</button>
        <button class="btn btn--ghost" data-history-copy="${index}">Copy data</button>
      </div>
    `;

    card.append(preview, meta);
    historyList.appendChild(card);
  });
};

const loadHistory = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(historyKey) || '[]');
    renderHistory(stored);
  } catch (error) {
    console.error('Failed to load history', error);
  }
};

const addHistoryFromCurrent = async (options) => {
  const item = {
    type: options.type,
    content: options.content,
    created: Date.now(),
  };

  if (options.type === 'barcode') {
    item.svg = barcodeOutput.outerHTML;
    item.png = dataUrlFromSvg(barcodeOutput);
  } else {
    const canvas = qrOutput.querySelector('canvas');
    if (canvas) {
      item.png = canvas.toDataURL('image/png');
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      tempSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      tempSvg.setAttribute('width', canvas.width);
      tempSvg.setAttribute('height', canvas.height);
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', item.png);
      image.setAttribute('width', '100%');
      image.setAttribute('height', '100%');
      tempSvg.appendChild(image);
      item.svg = tempSvg.outerHTML;
    }
  }

  saveHistoryItem(item);
};

const generate = (event) => {
  event?.preventDefault();
  const options = getFormValues();

  if (!options.content) {
    setFeedback('Please enter the data you want to encode.', 'error');
    return;
  }

  if (options.type === 'barcode') {
    const ok = renderBarcode(options);
    if (!ok) return;
  } else {
    renderQrCode(options);
  }

  setFeedback('Code generated successfully. Use the buttons below to export or copy your data.', 'success');
  addHistoryFromCurrent(options);
};

form.addEventListener('submit', generate);

resetBtn.addEventListener('click', () => {
  form.reset();
  contentInput.value = '';
  barcodeOutput.innerHTML = '';
  qrOutput.innerHTML = '';
  barcodeOutput.style.display = 'none';
  qrOutput.style.display = 'none';
  setFeedback('Form cleared. Enter new data to generate a code.');
});

copyBtn.addEventListener('click', async () => {
  const { content } = getFormValues();
  if (!content) {
    setFeedback('Nothing to copy yet!', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(content);
    setFeedback('Original data copied to clipboard.', 'success');
  } catch (error) {
    console.error(error);
    setFeedback('Clipboard permissions denied. Copy manually instead.', 'error');
  }
});

const ensureCodeGenerated = () => {
  const { content } = getFormValues();
  if (!content) {
    setFeedback('Generate a code before downloading.', 'error');
    return false;
  }
  return true;
};

downloadPngBtn.addEventListener('click', () => {
  if (!ensureCodeGenerated()) return;
  const options = getFormValues();

  if (options.type === 'barcode') {
    const dataUrl = dataUrlFromSvg(barcodeOutput);
    downloadDataUrl(dataUrl, 'barcode.png');
  } else {
    const canvas = qrOutput.querySelector('canvas');
    if (!canvas) {
      setFeedback('Generate a QR code first.', 'error');
      return;
    }
    downloadCanvas(canvas, 'qrcode.png');
  }
  setFeedback('Download started.');
});

downloadSvgBtn.addEventListener('click', () => {
  if (!ensureCodeGenerated()) return;
  const options = getFormValues();

  if (options.type === 'barcode') {
    const dataUrl = dataUrlFromSvg(barcodeOutput);
    downloadDataUrl(dataUrl, 'barcode.svg');
  } else {
    const canvas = qrOutput.querySelector('canvas');
    if (!canvas) {
      setFeedback('Generate a QR code first.', 'error');
      return;
    }
    const pngDataUrl = canvas.toDataURL('image/png');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><image href="${pngDataUrl}" width="100%" height="100%"/></svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, 'qrcode.svg');
    URL.revokeObjectURL(url);
  }
  setFeedback('Download started.');
});

clearHistoryBtn.addEventListener('click', () => {
  localStorage.removeItem(historyKey);
  renderHistory([]);
  setFeedback('History cleared.');
});

historyList.addEventListener('click', (event) => {
  const downloadBtn = event.target.closest('[data-history-download]');
  const copyBtn = event.target.closest('[data-history-copy]');
  const history = JSON.parse(localStorage.getItem(historyKey) || '[]');

  if (downloadBtn) {
    const index = Number(downloadBtn.dataset.historyDownload);
    const item = history[index];
    if (!item) return;
    if (downloadBtn.dataset.type === 'barcode') {
      const dataUrl = downloadBtn.dataset.format === 'png' ? item.png : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.svg)}`;
      downloadDataUrl(dataUrl, `${downloadBtn.dataset.type}-${index}.${downloadBtn.dataset.format}`);
    } else {
      if (downloadBtn.dataset.format === 'png') {
        downloadDataUrl(item.png, `${downloadBtn.dataset.type}-${index}.png`);
      } else {
        const blob = new Blob([item.svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        downloadDataUrl(url, `${downloadBtn.dataset.type}-${index}.svg`);
        URL.revokeObjectURL(url);
      }
    }
  }

  if (copyBtn) {
    const index = Number(copyBtn.dataset.historyCopy);
    const item = history[index];
    if (!item) return;
    navigator.clipboard
      .writeText(item.content)
      .then(() => setFeedback('Code data copied from history.', 'success'))
      .catch(() => setFeedback('Clipboard permissions denied.', 'error'));
  }
});

scrollButtons.forEach((button) => {
  const target = document.querySelector(button.dataset.scrollTarget);
  if (!target) return;
  button.addEventListener('click', () => {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

loadHistory();

setFeedback('Customize your settings and generate your first code!');
