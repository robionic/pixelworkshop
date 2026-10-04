(() => {
    const image = new Image();
    image.src = '/static/Lena.png';

    const canvas = document.getElementById('image-canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const placeholder = document.getElementById('canvas-placeholder');
    const imageName = document.getElementById('image-name');
    const propertiesText = document.getElementById('properties-text');
    const uploadInput = document.getElementById('image-upload');
    const zoomControl = document.getElementById('zoom');
    const parameterFields = document.getElementById('parameter-fields');
    const histogramDialog = document.getElementById('histogram-dialog');
    const histogramCanvas = document.getElementById('histogram-canvas');
    const histogramMode = document.getElementById('histogram-mode');
    const histogramZoom = document.getElementById('histogram-zoom');
    const histogramSummary = document.getElementById('histogram-summary');
    const controls = {
        brightness: document.getElementById('brightness'),
        contrast: document.getElementById('contrast'),
        rotation: document.getElementById('rotation'),
        translate: document.getElementById('translate'),
        shear: document.getElementById('shear'),
        filter: document.getElementById('filter')
    };
    const outputs = {
        brightness: document.getElementById('brightness-value'),
        contrast: document.getElementById('contrast-value'),
        rotation: document.getElementById('rotation-value'),
        translate: document.getElementById('translate-value'),
        shear: document.getElementById('shear-value')
    };
    let cursor = null;
    let uploadedImageUrl = null;
    let selection = { x: 32, y: 32, width: 160, height: 160 };
    let dragState = null;

    const parameterDefinitions = {
        gaussian: [['radius', 'Radius', 1, 1, 5, 1]],
        box: [['radius', 'Radius', 1, 1, 5, 1]],
        median: [['radius', 'Radius', 1, 1, 5, 1]],
        bilateral: [['diameter', 'Diameter', 9, 1, 25, 1], ['sigmaColor', 'Color sigma', 75, 1, 200, 1], ['sigmaSpace', 'Space sigma', 75, 1, 200, 1]],
        sharpen: [['amount', 'Amount', 1, 0, 5, 0.1]],
        equalize: [['clip', 'Clip limit', 1, 0, 10, 0.1]],
        invert: [['strength', 'Strength', 1, 0, 1, 0.1]],
        'sobel-x': [['kernel', 'Kernel size', 3, 1, 7, 2]],
        'sobel-y': [['kernel', 'Kernel size', 3, 1, 7, 2]],
        laplacian: [['kernel', 'Kernel size', 3, 1, 7, 2]],
        threshold: [['level', 'Threshold', 127, 0, 255, 1]],
        canny: [['low', 'Low threshold', 100, 0, 255, 1], ['high', 'High threshold', 200, 0, 255, 1]],
        erode: [['size', 'Kernel size', 3, 1, 15, 2]],
        dilate: [['size', 'Kernel size', 3, 1, 15, 2]],
        open: [['size', 'Kernel size', 3, 1, 15, 2]],
        close: [['size', 'Kernel size', 3, 1, 15, 2]]
    };

    function clamp(value) {
        return Math.max(0, Math.min(255, value));
    }

    function updateOutputs() {
        outputs.brightness.value = controls.brightness.value;
        outputs.contrast.value = controls.contrast.value;
        outputs.rotation.value = `${controls.rotation.value}°`;
        outputs.translate.value = `${controls.translate.value} px`;
        outputs.shear.value = `${controls.shear.value}%`;
    }

    function resetAdjustments() {
        controls.brightness.value = 100;
        controls.contrast.value = 100;
        controls.rotation.value = 0;
        controls.translate.value = 0;
        controls.shear.value = 0;
        controls.filter.value = 'none';
        renderParameterFields();
    }

    function parameterValues() {
        const values = {};
        (parameterDefinitions[controls.filter.value] || []).forEach(([name]) => {
            values[name] = Number(document.getElementById(`parameter-${name}`).value);
        });
        return values;
    }

    function renderParameterFields() {
        parameterFields.innerHTML = '';
        (parameterDefinitions[controls.filter.value] || []).forEach(([name, label, value, min, max, step]) => {
            const field = document.createElement('label');
            field.className = 'parameter-field';
            field.innerHTML = `<span>${label} (${min}-${max})</span><input id="parameter-${name}" type="number" min="${min}" max="${max}" step="${step}" value="${value}">`;
            parameterFields.appendChild(field);
            field.querySelector('input').addEventListener('input', render);
        });
    }

    function updateImageProperties(file = null) {
        const name = file ? file.name : imageName.textContent;
        const type = file ? (file.type || 'Unknown format') : 'PNG';
        const size = file ? ` | ${(file.size / 1024).toFixed(1)} KB` : '';
        propertiesText.textContent = `${name} | ${image.naturalWidth} x ${image.naturalHeight} px | ${type}${size} | 3 channels`;
    }

    function updateControlBounds(controlName) {
        const control = controls[controlName];
        const start = document.getElementById(`${controlName}-start`);
        const end = document.getElementById(`${controlName}-end`);
        const minimum = Number(start.value);
        const maximum = Number(end.value);
        if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) return;
        control.min = minimum;
        control.max = maximum;
        control.value = Math.max(minimum, Math.min(maximum, Number(control.value)));
        render();
    }

    function applyMedian(data, width, height) {
        const source = new Uint8ClampedArray(data.data);
        const values = [];
        for (let y = 1; y < height - 1; y += 1) {
            for (let x = 1; x < width - 1; x += 1) {
                const index = (y * width + x) * 4;
                for (let channel = 0; channel < 3; channel += 1) {
                    values.length = 0;
                    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                            values.push(source[((y + offsetY) * width + x + offsetX) * 4 + channel]);
                        }
                    }
                    values.sort((a, b) => a - b);
                    data.data[index + channel] = values[4];
                }
            }
        }
    }

    function applyGaussian(data, width, height) {
        const source = new Uint8ClampedArray(data.data);
        const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
        for (let y = 1; y < height - 1; y += 1) {
            for (let x = 1; x < width - 1; x += 1) {
                const index = (y * width + x) * 4;
                for (let channel = 0; channel < 3; channel += 1) {
                    let total = 0;
                    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                            const weight = kernel[(offsetY + 1) * 3 + offsetX + 1];
                            total += source[((y + offsetY) * width + x + offsetX) * 4 + channel] * weight;
                        }
                    }
                    data.data[index + channel] = total / 16;
                }
            }
        }
    }

    function applyBilateral(data, width, height) {
        const source = new Uint8ClampedArray(data.data);
        for (let y = 1; y < height - 1; y += 1) {
            for (let x = 1; x < width - 1; x += 1) {
                const index = (y * width + x) * 4;
                for (let channel = 0; channel < 3; channel += 1) {
                    let total = 0;
                    let weightTotal = 0;
                    const center = source[index + channel];
                    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                            const neighbor = source[((y + offsetY) * width + x + offsetX) * 4 + channel];
                            const weight = Math.exp(-((neighbor - center) ** 2) / 1800);
                            total += neighbor * weight;
                            weightTotal += weight;
                        }
                    }
                    data.data[index + channel] = total / weightTotal;
                }
            }
        }
    }

    function grayscale(data) {
        for (let index = 0; index < data.data.length; index += 4) {
            const value = 0.299 * data.data[index] + 0.587 * data.data[index + 1] + 0.114 * data.data[index + 2];
            data.data[index] = value;
            data.data[index + 1] = value;
            data.data[index + 2] = value;
        }
    }

    function applyKernel(data, width, height, kernel, divisor = 1) {
        const source = new Uint8ClampedArray(data.data);
        for (let y = 1; y < height - 1; y += 1) {
            for (let x = 1; x < width - 1; x += 1) {
                const index = (y * width + x) * 4;
                for (let channel = 0; channel < 3; channel += 1) {
                    let total = 0;
                    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                            total += source[((y + offsetY) * width + x + offsetX) * 4 + channel]
                                * kernel[(offsetY + 1) * 3 + offsetX + 1];
                        }
                    }
                    data.data[index + channel] = clamp(total / divisor);
                }
            }
        }
    }

    function applyEqualize(data) {
        grayscale(data);
        const histogram = new Array(256).fill(0);
        for (let index = 0; index < data.data.length; index += 4) histogram[data.data[index]] += 1;
        const total = data.data.length / 4;
        let cumulative = 0;
        const lookup = histogram.map((count) => {
            cumulative += count;
            return Math.round((cumulative / total) * 255);
        });
        for (let index = 0; index < data.data.length; index += 4) {
            const value = lookup[data.data[index]];
            data.data[index] = value;
            data.data[index + 1] = value;
            data.data[index + 2] = value;
        }
    }

    function applyMorphology(data, width, height, operation) {
        grayscale(data);
        const source = new Uint8ClampedArray(data.data);
        for (let y = 1; y < height - 1; y += 1) {
            for (let x = 1; x < width - 1; x += 1) {
                const values = [];
                for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                        values.push(source[((y + offsetY) * width + x + offsetX) * 4]);
                    }
                }
                const minimum = Math.min(...values);
                const maximum = Math.max(...values);
                const value = operation === 'erode' ? minimum : maximum;
                const index = (y * width + x) * 4;
                data.data[index] = value;
                data.data[index + 1] = value;
                data.data[index + 2] = value;
            }
        }
    }

    function applyOperator(data, width, height, operator, parameters) {
        if (operator === 'gaussian') applyGaussian(data, width, height);
        if (operator === 'box') applyKernel(data, width, height, [1, 1, 1, 1, 1, 1, 1, 1, 1], 9);
        if (operator === 'median') applyMedian(data, width, height);
        if (operator === 'bilateral') applyBilateral(data, width, height);
        if (operator === 'sharpen') applyKernel(data, width, height, [0, -1, 0, -1, 5 + parameters.amount, -1, 0, -1, 0]);
        if (operator === 'equalize') applyEqualize(data);
        if (operator === 'invert') {
            for (let index = 0; index < data.data.length; index += 4) {
                data.data[index] = 255 - data.data[index];
                data.data[index + 1] = 255 - data.data[index + 1];
                data.data[index + 2] = 255 - data.data[index + 2];
            }
        }
        if (operator === 'threshold') {
            grayscale(data);
            for (let index = 0; index < data.data.length; index += 4) {
                const value = data.data[index] >= parameters.level ? 255 : 0;
                data.data[index] = value;
                data.data[index + 1] = value;
                data.data[index + 2] = value;
            }
        }
        if (operator === 'erode' || operator === 'dilate') applyMorphology(data, width, height, operator);
        if (operator === 'open') {
            applyMorphology(data, width, height, 'erode');
            applyMorphology(data, width, height, 'dilate');
        }
        if (operator === 'close') {
            applyMorphology(data, width, height, 'dilate');
            applyMorphology(data, width, height, 'erode');
        }
        if (operator === 'sobel-x' || operator === 'sobel-y' || operator === 'laplacian' || operator === 'canny') {
            grayscale(data);
            const kernel = operator === 'sobel-x' ? [-1, 0, 1, -2, 0, 2, -1, 0, 1]
                : operator === 'sobel-y' ? [-1, -2, -1, 0, 0, 0, 1, 2, 1]
                    : [0, 1, 0, 1, -4, 1, 0, 1, 0];
            applyKernel(data, width, height, kernel);
            if (operator === 'canny') applyKernel(data, width, height, [-1, -1, -1, -1, 8, -1, -1, -1, -1]);
        }
    }

    function drawBase() {
        const rotation = Number(controls.rotation.value) * Math.PI / 180;
        const shift = Number(controls.translate.value);
        const shear = Number(controls.shear.value) / 100;
        context.save();
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#111815';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.translate(canvas.width / 2 + shift, canvas.height / 2);
        context.rotate(rotation);
        context.transform(1, 0, shear, 1, 0, 0);
        context.drawImage(image, -image.width / 2, -image.height / 2);
        context.restore();
    }

    function render() {
        if (!image.complete || !image.naturalWidth) return;
        drawBase();
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const brightness = Number(controls.brightness.value) - 100;
        const contrast = Number(controls.contrast.value) / 100;
        for (let index = 0; index < pixels.data.length; index += 4) {
            pixels.data[index] = clamp((pixels.data[index] - 128) * contrast + 128 + brightness);
            pixels.data[index + 1] = clamp((pixels.data[index + 1] - 128) * contrast + 128 + brightness);
            pixels.data[index + 2] = clamp((pixels.data[index + 2] - 128) * contrast + 128 + brightness);
        }
        applyOperator(pixels, canvas.width, canvas.height, controls.filter.value, parameterValues());
        context.putImageData(pixels, 0, 0);
        drawOverlay();
        updateOutputs();
    }

    function drawOverlay() {
        context.strokeStyle = '#ee744d';
        context.lineWidth = 2;
        context.strokeRect(selection.x, selection.y, selection.width, selection.height);
        if (!cursor) return;
        const pixel = context.getImageData(cursor.x, cursor.y, 1, 1).data;
        const red = pixel[0];
        const green = pixel[1];
        const blue = pixel[2];
        const readout = `(${cursor.x}, ${cursor.y})  R=${red} G=${green} B=${blue}`;
        const labelX = Math.min(cursor.x + 12, canvas.width - 224);
        const labelY = Math.max(cursor.y - 12, 28);
        context.font = '12px DM Mono, monospace';
        context.fillStyle = 'rgba(16, 24, 20, .92)';
        context.fillRect(labelX, labelY - 26, 218, 30);
        context.fillStyle = '#fff';
        context.fillText(readout, labelX + 7, labelY - 7);
        context.strokeStyle = '#f4cf57';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(cursor.x, cursor.y, 5, 0, Math.PI * 2);
        context.stroke();
        const boxY = canvas.height - 38;
        context.fillStyle = 'rgba(16, 24, 20, .92)';
        context.fillRect(8, boxY, canvas.width - 16, 30);
        context.fillStyle = '#fff';
        context.fillText(`Cursor: (${cursor.x}, ${cursor.y})   RGB: (${red}, ${green}, ${blue})`, 16, boxY + 20);
    }

    function drawHistogram() {
        const width = selection.width;
        const height = selection.height;
        const pixels = context.getImageData(selection.x, selection.y, width, height).data;
        const mode = histogramMode.value;
        const channels = mode === 'gray' ? ['Gray'] : mode === 'cmyk' ? ['C', 'M', 'Y', 'K'] : ['R', 'G', 'B'];
        const histogram = channels.map(() => new Array(256).fill(0));
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i] / 255;
            const g = pixels[i + 1] / 255;
            const b = pixels[i + 2] / 255;
            const values = mode === 'gray' ? [Math.round((0.299 * r + 0.587 * g + 0.114 * b) * 255)]
                : mode === 'cmyk' ? [Math.round((1 - r) * 255), Math.round((1 - g) * 255), Math.round((1 - b) * 255), Math.round((1 - Math.max(r, g, b)) * 255)]
                    : [pixels[i], pixels[i + 1], pixels[i + 2]];
            values.forEach((value, index) => { histogram[index][value] += 1; });
        }
        const chart = histogramCanvas.getContext('2d');
        chart.clearRect(0, 0, histogramCanvas.width, histogramCanvas.height);
        chart.fillStyle = '#17201d';
        chart.fillRect(0, 0, histogramCanvas.width, histogramCanvas.height);
        const colors = mode === 'gray' ? ['#ffffff'] : mode === 'cmyk' ? ['#00ffff', '#ff00ff', '#ffff00', '#ffffff'] : ['#ee744d', '#80cfa4', '#8bb9e8'];
        const max = Math.max(...histogram.flat(), 1);
        histogram.forEach((line, channel) => {
            chart.strokeStyle = colors[channel];
            chart.beginPath();
            line.forEach((count, value) => {
                const x = value * 3;
                const y = 390 - (count / max) * 350;
                if (value === 0) chart.moveTo(x, y); else chart.lineTo(x, y);
            });
            chart.stroke();
        });
        histogramSummary.textContent = `${mode.toUpperCase()} histogram | selection ${width} x ${height} px | ${width * height} pixels`;
    }

    function updateCursor(event) {
        const bounds = canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - bounds.left) * canvas.width / bounds.width);
        const y = Math.floor((event.clientY - bounds.top) * canvas.height / bounds.height);
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
        cursor = { x, y };
        render();
    }

    image.addEventListener('load', () => {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        placeholder.hidden = true;
        updateImageProperties();
        selection.width = Math.min(160, canvas.width - selection.x);
        selection.height = Math.min(160, canvas.height - selection.y);
        renderParameterFields();
        render();
    });
    uploadInput.addEventListener('change', () => {
        const [file] = uploadInput.files;
        if (!file) return;
        if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
        uploadedImageUrl = URL.createObjectURL(file);
        imageName.textContent = file.name;
        updateImageProperties(file);
        cursor = null;
        resetAdjustments();
        image.src = uploadedImageUrl;
    });
    Object.values(controls).forEach((control) => control.addEventListener('input', () => { renderParameterFields(); render(); }));
    ['brightness', 'contrast', 'rotation', 'translate', 'shear'].forEach((controlName) => {
        document.getElementById(`${controlName}-start`).addEventListener('change', () => updateControlBounds(controlName));
        document.getElementById(`${controlName}-end`).addEventListener('change', () => updateControlBounds(controlName));
    });
    canvas.addEventListener('pointerdown', (event) => {
        const bounds = canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - bounds.left) * canvas.width / bounds.width);
        const y = Math.floor((event.clientY - bounds.top) * canvas.height / bounds.height);
        dragState = { x, y, selection: { ...selection } };
        canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
        updateCursor(event);
        if (!dragState) return;
        const bounds = canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - bounds.left) * canvas.width / bounds.width);
        const y = Math.floor((event.clientY - bounds.top) * canvas.height / bounds.height);
        selection = { x: Math.max(0, Math.min(canvas.width - 8, x)), y: Math.max(0, Math.min(canvas.height - 8, y)), width: 8, height: 8 };
        if (dragState.selection) {
            selection.x = Math.min(dragState.selection.x, x);
            selection.y = Math.min(dragState.selection.y, y);
            selection.width = Math.max(8, Math.abs(x - dragState.selection.x));
            selection.height = Math.max(8, Math.abs(y - dragState.selection.y));
        }
        selection.width = Math.min(selection.width, canvas.width - selection.x);
        selection.height = Math.min(selection.height, canvas.height - selection.y);
        render();
    });
    canvas.addEventListener('pointerup', () => { dragState = null; });
    canvas.addEventListener('pointerleave', () => { cursor = null; render(); });
    document.getElementById('reset').addEventListener('click', () => {
        resetAdjustments();
        render();
    });
    zoomControl.addEventListener('change', () => { canvas.style.width = `${canvas.width * Number(zoomControl.value)}px`; });
    document.getElementById('histogram-button').addEventListener('click', () => { drawHistogram(); histogramDialog.showModal(); });
    document.getElementById('close-histogram').addEventListener('click', () => histogramDialog.close());
    histogramMode.addEventListener('change', drawHistogram);
    histogramZoom.addEventListener('change', () => { histogramCanvas.style.width = `${768 * Number(histogramZoom.value)}px`; drawHistogram(); });
})();
