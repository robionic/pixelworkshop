# PixelWorkshop

## 🏭 Overview

PixelWorkshop is a lightweight image-processing and inspection workspace that provides the same core image-analysis workflow in both a desktop and a browser-based app. It is designed for users who want to upload an image, isolate a region of interest, inspect brightness and color distributions, and compare analysis across desktop and web interfaces.

## 🚀 Key Features

### Image Processing Workflow
- **Image Upload**: Load a local image or use the bundled sample image.
- **Selection Box**: Drag a region on the image to define the area of interest.
- **Zoom Controls**: Inspect the image and selected area more closely.
- **Histogram Analysis**: View histogram data for the selected region in RGB, CMYK, or grayscale modes.
- **Web Image Visualizer**: Explore channel histograms, RGB scatter, and corner/keypoint overlays alongside the image.

### Cross-Platform Experience
- **Desktop App**: OpenCV-based window application for fast interactive processing.
- **Web App**: Django-powered browser version for easier remote or classroom usage.
- **Shared Resources**: Both applications use the same sample image assets under `shared/images`.

## 🛠️ Technology Stack

### Desktop App
- **Python**
- **OpenCV**
- **NumPy**

### Web App
- **Django**
- **Python**
- **HTML/CSS/JavaScript**

### Shared Assets
- **Sample images** stored in `shared/images`

## 📋 Installation & Setup

### Prerequisites
- Python 3.10+
- pip
- A virtual environment tool such as `venv`

### Installation Steps

1. Create a virtual environment:
   ```powershell
   python -m venv .venv
   ```

2. Install dependencies:
   ```powershell
   .venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

## 🎯 Usage Guide

### Run the Desktop Application

```powershell
.venv\Scripts\python.exe apps\desktop\app.py
```

Controls:
- `u`: upload an image
- `l`: edit operator limits
- `h`: show histogram for the selected box
- `m`: cycle RGB, CMYK, and grayscale modes
- `+` / `-`: adjust histogram zoom
- `Esc`: exit

### Run the Django Web Application

```powershell
.venv\Scripts\python.exe apps\web\manage.py runserver
```

Open:
```text
http://127.0.0.1:8000/
```

The web app serves the shared sample image and supports local uploads, history-style selection, zooming, and RGB/CMYK/gray histogram inspection.

## 📁 Project Structure

```text
PixelWorkshop/
├── README.md
├── requirements.txt
├── apps/
│   ├── desktop/
│   └── web/
├── shared/
│   └── images/
└── ...
```

## 🔎 Typical Use Cases

- Image quality review
- Region-of-interest inspection
- Histogram-based feature analysis
- Cross-platform classroom or demo workflows
