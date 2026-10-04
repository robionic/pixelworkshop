# Desktop Application

## 🏭 Overview

The desktop app is the OpenCV-based version of PixelWorkshop for local image inspection and histogram analysis. It is optimized for quick interactive processing, with a simple keyboard-driven workflow for image upload, region selection, and visual quality review.

## 🚀 Key Features

- **Local Image Upload**: Load a new image directly into the application.
- **Interactive ROI Selection**: Drag on the image to define the analysis region.
- **Histogram Views**: Inspect RGB, CMYK, and grayscale information for the chosen region.
- **Operator Controls**: Adjust processing limits and view histogram details in real time.
- **Fast Desktop Workflow**: Ideal for demos and local image inspection tasks.

## 🛠️ Technology Stack

- **Python**
- **OpenCV**
- **NumPy**
- **Windowed desktop interaction**

## 📋 Installation & Setup

### Prerequisites
- Python 3.10+
- A virtual environment configured from the repository root

### Run the Desktop App

```powershell
.venv\Scripts\python.exe apps\desktop\app.py
```

## 🎯 Usage Guide

### Controls
- `u`: upload an image
- `l`: edit operator limits
- `h`: show the histogram for the selected box
- `m`: cycle RGB, CMYK, and gray histogram modes
- `+` / `-`: zoom the histogram
- `Esc`: exit

Drag on the image to select the histogram region. The sample image is loaded from `shared/images` by default.

## 📁 Project Structure

```text
apps/desktop/
├── README.md
├── app.py
└── ...
```

## 🔎 Typical Use Cases

- Local image quality check
- Manual region-of-interest inspection
- Histogram review for a selected area
- Desktop demonstration of the PixelWorkshop workflow
