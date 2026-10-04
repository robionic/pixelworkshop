# Web Application

## 🏭 Overview

The Django web app is the browser-based version of PixelWorkshop. It exposes the same image-processing workflow through a web interface so users can upload images, inspect a selected region, and review color or grayscale histograms without a desktop app.

## 🚀 Key Features

- **Browser-Based Workflow**: Run the app inside a standard web browser.
- **Shared Sample Image**: Load the bundled image from `shared/images`.
- **Local Image Upload**: Add a custom image for inspection.
- **Selection Box**: Drag a region of interest on the page.
- **Histogram Analysis**: View RGB, CMYK, and grayscale distributions.
- **Zoom and Inspection Controls**: Adjust the view and inspect the selected box closely.

## 🛠️ Technology Stack

- **Django**
- **Python**
- **HTML/CSS/JavaScript**
- **Image analysis workflow shared with the desktop version**

## 📋 Installation & Setup

### Prerequisites
- Python 3.10+
- Dependencies installed from the repository root

### Run the Web App

From the `PixelWorkshop/` directory:

```powershell
.venv\Scripts\python.exe apps\web\manage.py runserver
```

Then open:
```text
http://127.0.0.1:8000/
```

## 🎯 Usage Guide

1. Open the app in the browser.
2. Upload or select a sample image.
3. Drag a region of interest across the image.
4. Review the histogram for the selected box.
5. Switch between RGB, CMYK, and grayscale analysis modes as needed.

The web app shares the same core inspection model as the desktop version, while adding a browser-friendly interface for broader accessibility.

## 📁 Project Structure

```text
apps/web/
├── README.md
├── manage.py
├── ...
```

## 🔎 Typical Use Cases

- Browser-based image inspection
- Classroom and demo workflows
- Shared image review without local desktop tools
- Quick visual analysis with histogram feedback
