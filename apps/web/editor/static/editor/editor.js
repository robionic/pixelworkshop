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
    const visualizerCanvas = document.getElementById('visualizer-canvas');
    const visualizerContext = visualizerCanvas.getContext('2d');
    const visualizerTitle = document.getElementById('visualizer-title');
    const visualizerSummary = document.getElementById('visualizer-summary');
    const visualizerImageType = document.getElementById('visualizer-image-type');
    const visualizerButtons = [...document.querySelectorAll('[data-visualization]')];
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
    let imageIsGrayscale = false;
    let selectedVisualization = 'rgb-histogram';

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

    function render(updateAnalysis = true) {
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
        if (updateAnalysis) drawVisualization(pixels);
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

    const visualizationNames = {
        'rgb-histogram': 'RGB histogram',
        'gray-histogram': 'Grey level histogram',
        scatter: 'RGB 3D scatter plot',
        'red-16': '16 bin histogram of red channel',
        'green-16': '16 bin histogram of green channel',
        'blue-16': '16 bin histogram of blue channel',
        'luminance-16': '16 bin histogram of luminance',
        'gray-16': '16 bin histogram of grey scale image',
        harris: 'Harris-Förstner Corners',
        sift: 'SIFT features',
        surf: 'SURF features'
    };

    function setVisualizerImageType() {
        visualizerImageType.textContent = imageIsGrayscale ? 'Grayscale image' : 'RGB image';
        visualizerButtons.forEach((button) => {
            const colorOnly = ['rgb-histogram', 'scatter', 'red-16', 'green-16', 'blue-16'].includes(button.dataset.visualization);
            const grayOnly = ['gray-histogram', 'gray-16'].includes(button.dataset.visualization);
            button.disabled = (imageIsGrayscale && colorOnly) || (!imageIsGrayscale && grayOnly);
            button.title = button.disabled
                ? `Unavailable for ${imageIsGrayscale ? 'grayscale' : 'RGB'} images`
                : '';
        });
        selectedVisualization = imageIsGrayscale ? 'gray-histogram' : 'rgb-histogram';
        visualizerButtons.forEach((button) => {
            button.setAttribute('aria-pressed', 'false');
        });
    }

    function prepareChart(title) {
        const chart = visualizerContext;
        chart.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        chart.fillStyle = '#17201d';
        chart.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
        chart.font = '12px DM Mono, monospace';
        chart.fillStyle = '#c0cbc4';
        chart.fillText(title, 24, 25);
        chart.strokeStyle = '#39443e';
        chart.lineWidth = 1;
        for (let i = 0; i < 5; i += 1) {
            const y = 58 + i * 62;
            chart.beginPath();
            chart.moveTo(48, y);
            chart.lineTo(748, y);
            chart.stroke();
        }
        return { chart, left: 48, top: 58, width: 700, height: 248, bottom: 306 };
    }

    function pixelLuminance(pixels, index) {
        return Math.round(0.299 * pixels.data[index] + 0.587 * pixels.data[index + 1] + 0.114 * pixels.data[index + 2]);
    }

    function drawHistogramVisualization(pixels, mode) {
        const title = visualizationNames[mode];
        const plot = prepareChart(title);
        const channels = mode === 'rgb-histogram' ? [
            { name: 'Red', color: '#ee744d', channel: 0 },
            { name: 'Green', color: '#80cfa4', channel: 1 },
            { name: 'Blue', color: '#8bb9e8', channel: 2 }
        ] : [{ name: 'Grey level', color: '#f4f1e9', channel: -1 }];
        const histograms = channels.map(() => new Uint32Array(256));
        for (let i = 0; i < pixels.data.length; i += 4) {
            channels.forEach((channel, index) => {
                histograms[index][channel.channel < 0 ? pixelLuminance(pixels, i) : pixels.data[i + channel.channel]] += 1;
            });
        }
        const max = Math.max(1, ...histograms.map((line) => Math.max(...line)));
        channels.forEach((channel, index) => {
            plot.chart.strokeStyle = channel.color;
            plot.chart.lineWidth = 1.5;
            plot.chart.beginPath();
            histograms[index].forEach((count, value) => {
                const x = plot.left + (value / 255) * plot.width;
                const y = plot.bottom - (count / max) * plot.height;
                if (value === 0) plot.chart.moveTo(x, y);
                else plot.chart.lineTo(x, y);
            });
            plot.chart.stroke();
            plot.chart.fillStyle = channel.color;
            plot.chart.fillText(channel.name, 52 + index * 78, 340);
        });
        plot.chart.fillStyle = '#c0cbc4';
        plot.chart.fillText('0', plot.left, 326);
        plot.chart.fillText('255', plot.left + plot.width - 22, 326);
        visualizerSummary.textContent = `${channels.map((channel) => channel.name).join(' / ')} pixel distribution | ${canvas.width} x ${canvas.height} px`;
    }

    function drawSixteenBinHistogram(pixels, mode) {
        const plot = prepareChart(visualizationNames[mode]);
        const histogram = new Uint32Array(16);
        const channel = { 'red-16': 0, 'green-16': 1, 'blue-16': 2 }[mode];
        for (let i = 0; i < pixels.data.length; i += 4) {
            const value = channel === undefined ? pixelLuminance(pixels, i) : pixels.data[i + channel];
            histogram[Math.min(15, Math.floor(value / 16))] += 1;
        }
        const max = Math.max(1, ...histogram);
        const colors = { 'red-16': '#ee744d', 'green-16': '#80cfa4', 'blue-16': '#8bb9e8' };
        const color = colors[mode] || '#f4f1e9';
        histogram.forEach((count, bin) => {
            const barWidth = plot.width / 16 - 7;
            const x = plot.left + bin * (plot.width / 16) + 3;
            const height = (count / max) * plot.height;
            plot.chart.fillStyle = color;
            plot.chart.fillRect(x, plot.bottom - height, barWidth, height);
            plot.chart.fillStyle = '#c0cbc4';
            plot.chart.fillText(String(bin), x + 2, 326);
        });
        visualizerSummary.textContent = `${pixels.width * pixels.height} pixels | 16 intensity ranges from 0-15 to 240-255`;
    }

    function drawRgbScatter(pixels) {
        const plot = prepareChart(visualizationNames.scatter);
        const chart = plot.chart;
        const originX = 282;
        const originY = 280;
        const scale = 220;
        chart.lineWidth = 1.5;
        [
            { label: 'R', dx: scale * 0.8, dy: -scale * 0.35, color: '#ee744d' },
            { label: 'G', dx: scale * 0.35, dy: -scale * 0.75, color: '#80cfa4' },
            { label: 'B', dx: -scale * 0.8, dy: -scale * 0.35, color: '#8bb9e8' }
        ].forEach(({ dx, dy, label, color }) => {
            chart.strokeStyle = color;
            chart.beginPath();
            chart.moveTo(originX, originY);
            chart.lineTo(originX + dx, originY + dy);
            chart.stroke();
            chart.fillStyle = color;
            chart.fillText(label, originX + dx, originY + dy - 5);
        });
        const totalPixels = pixels.width * pixels.height;
        const stride = Math.max(1, Math.ceil(totalPixels / 6000));
        for (let pixel = 0, index = 0; pixel < totalPixels; pixel += stride, index = pixel * 4) {
            const r = pixels.data[index] / 255;
            const g = pixels.data[index + 1] / 255;
            const b = pixels.data[index + 2] / 255;
            const x = originX + r * scale * 0.8 + g * scale * 0.35 - b * scale * 0.8;
            const y = originY - r * scale * 0.35 - g * scale * 0.75 - b * scale * 0.35;
            chart.fillStyle = `rgba(${pixels.data[index]},${pixels.data[index + 1]},${pixels.data[index + 2]},.55)`;
            chart.fillRect(x, y, 2, 2);
        }
        visualizerSummary.textContent = `RGB values projected into 3D color space | showing up to 6,000 of ${totalPixels} pixels`;
    }

    function makeGrayImage(pixels, maxSide = 256) {
        const scale = Math.min(1, maxSide / Math.max(pixels.width, pixels.height));
        const width = Math.max(1, Math.round(pixels.width * scale));
        const height = Math.max(1, Math.round(pixels.height * scale));
        const gray = new Float32Array(width * height);
        for (let y = 0; y < height; y += 1) {
            const sourceY = Math.min(pixels.height - 1, Math.floor(y / scale));
            for (let x = 0; x < width; x += 1) {
                const sourceX = Math.min(pixels.width - 1, Math.floor(x / scale));
                const sourceIndex = (sourceY * pixels.width + sourceX) * 4;
                gray[y * width + x] = pixelLuminance(pixels, sourceIndex);
            }
        }
        return { data: gray, width, height, scale };
    }

    function drawFeaturePoints(pixels, mode) {
        const image = makeGrayImage(pixels, 192);
        const { data, width, height } = image;
        const points = mode === 'harris' ? findHarrisPoints(data, width, height)
            : mode === 'sift' ? findSiftPoints(data, width, height)
                : findSurfPoints(data, width, height);
        const chart = prepareChart(visualizationNames[mode]).chart;
        const margin = 24;
        const fit = Math.min((visualizerCanvas.width - margin * 2) / pixels.width, (visualizerCanvas.height - 76) / pixels.height);
        const drawWidth = pixels.width * fit;
        const drawHeight = pixels.height * fit;
        const x = (visualizerCanvas.width - drawWidth) / 2;
        const y = 42 + (visualizerCanvas.height - 58 - drawHeight) / 2;
        const thumbnail = document.createElement('canvas');
        thumbnail.width = pixels.width;
        thumbnail.height = pixels.height;
        thumbnail.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
        chart.drawImage(thumbnail, x, y, drawWidth, drawHeight);
        chart.strokeStyle = '#ee744d';
        chart.fillStyle = 'rgba(238,116,77,.2)';
        points.forEach((point) => {
            const px = x + point.x * image.scale * fit;
            const py = y + point.y * image.scale * fit;
            const radius = Math.max(2, point.size * image.scale * fit);
            chart.beginPath();
            chart.arc(px, py, radius, 0, Math.PI * 2);
            chart.fill();
            chart.stroke();
        });
        visualizerSummary.textContent = `Showing ${points.length} ${mode.toUpperCase()} keypoints (maximum 300) | analysis resized to ${width} x ${height} px`;
    }

    function findHarrisPoints(gray, width, height) {
        const response = new Float32Array(width * height);
        let maximum = 0;
        for (let y = 2; y < height - 2; y += 1) {
            for (let x = 2; x < width - 2; x += 1) {
                let xx = 0;
                let yy = 0;
                let xy = 0;
                for (let oy = -1; oy <= 1; oy += 1) {
                    for (let ox = -1; ox <= 1; ox += 1) {
                        const i = (y + oy) * width + x + ox;
                        const gx = gray[i + 1] - gray[i - 1];
                        const gy = gray[i + width] - gray[i - width];
                        xx += gx * gx;
                        yy += gy * gy;
                        xy += gx * gy;
                    }
                }
                const trace = xx + yy;
                const value = xx * yy - xy * xy - 0.04 * trace * trace;
                response[y * width + x] = value;
                maximum = Math.max(maximum, value);
            }
        }
        const threshold = maximum * 0.01;
        const points = [];
        for (let y = 3; y < height - 3; y += 1) {
            for (let x = 3; x < width - 3; x += 1) {
                const value = response[y * width + x];
                if (value <= threshold) continue;
                let peak = true;
                for (let oy = -2; oy <= 2 && peak; oy += 1) {
                    for (let ox = -2; ox <= 2; ox += 1) {
                        if ((ox || oy) && response[(y + oy) * width + x + ox] > value) {
                            peak = false;
                            break;
                        }
                    }
                }
                if (peak) points.push({ x, y, size: 3 });
            }
        }
        return points.sort((a, b) => response[b.y * width + b.x] - response[a.y * width + a.x]).slice(0, 300);
    }

    function gaussianBlur(gray, width, height) {
        const kernel = [1, 4, 6, 4, 1];
        const temporary = new Float32Array(gray.length);
        const blurred = new Float32Array(gray.length);
        for (let y = 0; y < height; y += 1) {
            for (let x = 2; x < width - 2; x += 1) {
                let sum = 0;
                for (let k = -2; k <= 2; k += 1) sum += gray[y * width + x + k] * kernel[k + 2];
                temporary[y * width + x] = sum / 16;
            }
        }
        for (let y = 2; y < height - 2; y += 1) {
            for (let x = 2; x < width - 2; x += 1) {
                let sum = 0;
                for (let k = -2; k <= 2; k += 1) sum += temporary[(y + k) * width + x] * kernel[k + 2];
                blurred[y * width + x] = sum / 16;
            }
        }
        return blurred;
    }

    function findSiftPoints(gray, width, height) {
        const scales = [gray];
        for (let i = 1; i < 6; i += 1) scales.push(gaussianBlur(scales[i - 1], width, height));
        const differences = scales.slice(1).map((scale, index) => {
            const difference = new Float32Array(scale.length);
            for (let i = 0; i < scale.length; i += 1) difference[i] = scale[i] - scales[index][i];
            return difference;
        });
        const points = [];
        for (let layer = 1; layer < differences.length - 1; layer += 1) {
            const current = differences[layer];
            for (let y = 2; y < height - 2; y += 1) {
                for (let x = 2; x < width - 2; x += 1) {
                    const index = y * width + x;
                    const value = current[index];
                    const magnitude = Math.abs(value);
                    if (magnitude < 3) continue;
                    let extremum = true;
                    for (let dy = -1; dy <= 1 && extremum; dy += 1) {
                        for (let dx = -1; dx <= 1; dx += 1) {
                            if ((dx || dy) && Math.abs(current[index + dy * width + dx]) >= magnitude) {
                                extremum = false;
                                break;
                            }
                        }
                    }
                    if (extremum) points.push({ x, y, size: 2 + layer * 1.5, strength: magnitude });
                }
            }
        }
        return points.sort((a, b) => b.strength - a.strength).slice(0, 300);
    }

    function findSurfPoints(gray, width, height) {
        const integral = new Float64Array((width + 1) * (height + 1));
        for (let y = 0; y < height; y += 1) {
            let rowSum = 0;
            for (let x = 0; x < width; x += 1) {
                rowSum += gray[y * width + x];
                integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + rowSum;
            }
        }
        const area = (x1, y1, x2, y2) => {
            x1 = Math.max(0, Math.min(width, x1));
            x2 = Math.max(0, Math.min(width, x2));
            y1 = Math.max(0, Math.min(height, y1));
            y2 = Math.max(0, Math.min(height, y2));
            return integral[y2 * (width + 1) + x2] - integral[y1 * (width + 1) + x2]
                - integral[y2 * (width + 1) + x1] + integral[y1 * (width + 1) + x1];
        };
        const response = new Float32Array(width * height);
        let maximum = 0;
        for (const size of [2, 3, 4, 5]) {
            for (let y = size * 2; y < height - size * 2; y += 1) {
                for (let x = size * 2; x < width - size * 2; x += 1) {
                    const dxx = area(x - size, y - size, x, y + size + 1)
                        + area(x + 1, y - size, x + size + 1, y + size + 1)
                        - 2 * area(x - Math.floor(size / 2), y - size, x + Math.ceil(size / 2), y + size + 1);
                    const dyy = area(x - size, y - size, x + size + 1, y)
                        + area(x - size, y + 1, x + size + 1, y + size + 1)
                        - 2 * area(x - size, y - Math.floor(size / 2), x + size + 1, y + Math.ceil(size / 2));
                    const dxy = area(x - size, y - size, x, y)
                        + area(x + 1, y + 1, x + size + 1, y + size + 1)
                        - area(x + 1, y - size, x + size + 1, y)
                        - area(x - size, y + 1, x, y + size + 1);
                    const value = dxx * dyy - 0.81 * dxy * dxy;
                    const index = y * width + x;
                    if (value > response[index]) response[index] = value;
                    maximum = Math.max(maximum, value);
                }
            }
        }
        const threshold = maximum * 0.0005;
        const points = [];
        for (let y = 3; y < height - 3; y += 1) {
            for (let x = 3; x < width - 3; x += 1) {
                const value = response[y * width + x];
                if (value <= threshold) continue;
                let peak = true;
                for (let oy = -2; oy <= 2 && peak; oy += 1) {
                    for (let ox = -2; ox <= 2; ox += 1) {
                        if ((ox || oy) && response[(y + oy) * width + x + ox] > value) {
                            peak = false;
                            break;
                        }
                    }
                }
                if (peak) points.push({ x, y, size: 3 });
            }
        }
        return points.sort((a, b) => response[b.y * width + b.x] - response[a.y * width + a.x]).slice(0, 300);
    }

    function drawVisualization(pixels) {
        visualizerButtons.forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.visualization === selectedVisualization));
        });
        visualizerTitle.textContent = visualizationNames[selectedVisualization];
        if (selectedVisualization === 'rgb-histogram' || selectedVisualization === 'gray-histogram') {
            drawHistogramVisualization(pixels, selectedVisualization);
        } else if (selectedVisualization.endsWith('-16')) {
            drawSixteenBinHistogram(pixels, selectedVisualization);
        } else if (selectedVisualization === 'scatter') {
            drawRgbScatter(pixels);
        } else {
            drawFeaturePoints(pixels, selectedVisualization);
        }
    }

    function detectGrayscale() {
        const probe = document.createElement('canvas');
        probe.width = image.naturalWidth;
        probe.height = image.naturalHeight;
        const probeContext = probe.getContext('2d', { willReadFrequently: true });
        probeContext.drawImage(image, 0, 0);
        const data = probeContext.getImageData(0, 0, probe.width, probe.height).data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] !== data[i + 1] || data[i + 1] !== data[i + 2]) return false;
        }
        return true;
    }

    function updateCursor(event) {
        const bounds = canvas.getBoundingClientRect();
        const x = Math.floor((event.clientX - bounds.left) * canvas.width / bounds.width);
        const y = Math.floor((event.clientY - bounds.top) * canvas.height / bounds.height);
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
        cursor = { x, y };
        render(false);
    }

    image.addEventListener('load', () => {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        placeholder.hidden = true;
        imageIsGrayscale = detectGrayscale();
        setVisualizerImageType();
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
        render(false);
    });
    canvas.addEventListener('pointerup', () => { dragState = null; });
    canvas.addEventListener('pointerleave', () => { cursor = null; render(false); });
    document.getElementById('reset').addEventListener('click', () => {
        resetAdjustments();
        render();
    });
    zoomControl.addEventListener('change', () => { canvas.style.width = `${canvas.width * Number(zoomControl.value)}px`; });
    visualizerButtons.forEach((button) => button.addEventListener('click', () => {
        if (button.disabled) return;
        selectedVisualization = button.dataset.visualization;
        render();
    }));
    document.getElementById('histogram-button').addEventListener('click', () => { drawHistogram(); histogramDialog.showModal(); });
    document.getElementById('close-histogram').addEventListener('click', () => histogramDialog.close());
    histogramMode.addEventListener('change', drawHistogram);
    histogramZoom.addEventListener('change', () => { histogramCanvas.style.width = `${768 * Number(histogramZoom.value)}px`; drawHistogram(); });
})();
