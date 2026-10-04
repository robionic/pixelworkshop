import cv2
import numpy as np
import os
import tkinter as tk
from tkinter import filedialog


# Load an image from your computer
imagePath = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'shared', 'images', 'Lena.png'))
img = cv2.imread(imagePath)

# Check if the image was loaded successfully
if img is None:
    print("Image not found. Check the path.")
else:
    current_image = img.copy()
    cursor_position = None
    current_image_name = imagePath.split('\\')[-1]
    current_image_size = os.path.getsize(imagePath)
    zoom_level = 1.0
    selection_start = None
    selection_box = None
    histogram_mode = 'rgb'
    histogram_zoom = 1.0
    limit_entries = {}
    limits = {
        'Brightness': [0, 200],
        'Contrast': [0, 200],
        'Rotation': [-180, 180],
        'Translate': [0, 100],
        'Shear': [-100, 100],
    }

    def render_image(image):
        global current_image

        current_image = image.copy()
        display_image = current_image.copy()

        height, width = display_image.shape[:2]
        properties = [
            f"{current_image_name}  {width} x {height} px",
            f"Channels: {display_image.shape[2] if len(display_image.shape) > 2 else 1}  Type: {display_image.dtype}  Size: {current_image_size / 1024:.1f} KB",
        ]
        for index, property_text in enumerate(properties):
            cv2.putText(display_image, property_text, (10, 22 + index * 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1,
                        cv2.LINE_AA)

        if cursor_position is not None:
            x, y = cursor_position
            if 0 <= x < display_image.shape[1] and 0 <= y < display_image.shape[0]:
                b, g, r = display_image[y, x]
                readout = f"({x}, {y})  R={r} G={g} B={b}"

                cv2.circle(display_image, (x, y), 4, (0, 255, 255), 1)
                label_x = min(x + 10, display_image.shape[1] - 220)
                label_y = max(y - 10, 25)
                cv2.rectangle(display_image, (label_x, label_y - 22),
                              (label_x + 210, label_y + 5), (0, 0, 0), -1)
                cv2.putText(display_image, readout, (label_x + 4, label_y - 3),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1,
                            cv2.LINE_AA)

                box_y = display_image.shape[0] - 34
                cv2.rectangle(display_image, (6, box_y),
                              (display_image.shape[1] - 6, display_image.shape[0] - 6),
                              (0, 0, 0), -1)
                cv2.putText(display_image, f"Cursor: ({x}, {y})   RGB: ({r}, {g}, {b})",
                            (14, display_image.shape[0] - 14), cv2.FONT_HERSHEY_SIMPLEX,
                            0.55, (255, 255, 255), 1, cv2.LINE_AA)

        if selection_box is not None:
            x1, y1, x2, y2 = selection_box
            cv2.rectangle(display_image, (x1, y1), (x2, y2), (0, 120, 255), 2)
        if zoom_level != 1.0:
            display_image = cv2.resize(display_image, None, fx=zoom_level, fy=zoom_level, interpolation=cv2.INTER_NEAREST)
        cv2.imshow('Val Adjustment', display_image)

    def show_histogram():
        if selection_box is None:
            return
        x1, y1, x2, y2 = selection_box
        region = current_image[min(y1, y2):max(y1, y2), min(x1, x2):max(x1, x2)]
        if region.size == 0:
            return
        chart_width = int(768 * histogram_zoom)
        chart = np.zeros((420, chart_width, 3), dtype=np.uint8)
        if histogram_mode == 'gray':
            channels = [(cv2.cvtColor(region, cv2.COLOR_BGR2GRAY), (255, 255, 255), 'Gray')]
        elif histogram_mode == 'cmyk':
            normalized = region.astype(np.float32) / 255
            channels = [
                ((1 - normalized[:, :, 2]) * 255, (255, 255, 0), 'C'),
                ((1 - normalized[:, :, 1]) * 255, (255, 0, 255), 'M'),
                ((1 - normalized[:, :, 0]) * 255, (0, 255, 255), 'Y'),
                ((1 - np.max(normalized, axis=2)) * 255, (255, 255, 255), 'K'),
            ]
        else:
            channels = [(region[:, :, 2], (0, 0, 255), 'R'), (region[:, :, 1], (0, 255, 0), 'G'), (region[:, :, 0], (255, 0, 0), 'B')]
        for channel_index, (values, color, label) in enumerate(channels):
            histogram = cv2.calcHist([values.astype(np.uint8)], [0], None, [256], [0, 256]).ravel()
            cv2.normalize(histogram, histogram, 0, 350, cv2.NORM_MINMAX)
            points = [(int(value * (chart_width - 1) / 255), 390 - int(height)) for value, height in enumerate(histogram)]
            for index in range(1, len(points)):
                cv2.line(chart, points[index - 1], points[index], color, 1)
            cv2.putText(chart, label, (10 + channel_index * 35, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1)
        cv2.putText(chart, f'{histogram_mode.upper()} histogram | region {abs(x2 - x1)} x {abs(y2 - y1)} px', (10, 410), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.imshow('Histogram', chart)

    # Display the image in a window
    #cv2.imshow("Loaded Image", img)
    
    #Brightness adjustment
    def update_brightness(value):
        beta = value - 100
        new_image = cv2.convertScaleAbs(img, alpha=1, beta=beta)
        render_image(new_image)

    #Contrast adjustment
    def update_contrast(value):
        alpha = value / 100.0
        new_image = cv2.convertScaleAbs(img, alpha=alpha, beta=0)
        render_image(new_image)

    #Rotation adjustment
    def update_rotation(value):
        angle = value - 100
        (h, w) = img.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        new_image = cv2.warpAffine(img, M, (w, h))
        render_image(new_image)

    #Translation adjustment
    def update_translate(value):
        # Define the source points for the affine transformation
        src_points = np.float32([[50, 50], [200, 50], [50, 200]])
        # Define the destination points based on the trackbar value
        dst_points = np.float32([[50 + value, 50], [200 + value, 50], [50 + value, 200]])
        M = cv2.getAffineTransform(src_points, dst_points)
        new_image = cv2.warpAffine(img, M, (img.shape[1], img.shape[0]))
        render_image(new_image)

    #Horizontal affine shear adjustment
    def update_shear(value):
        shear = value / 100.0
        h, w = img.shape[:2]
        M = np.float32([
            [1, shear, -shear * h / 2],
            [0, 1, 0],
        ])
        new_image = cv2.warpAffine(img, M, (w, h))
        render_image(new_image)

    #Filter adjustment
    def update_filter(value):
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        kernel = np.ones((3, 3), np.uint8)
        if value == 0:
            new_image = img.copy()
        elif value == 1:
            new_image = cv2.GaussianBlur(img, (5, 5), 0)
        elif value == 2:
            new_image = cv2.blur(img, (5, 5))
        elif value == 3:
            new_image = cv2.medianBlur(img, 5)
        elif value == 4:
            new_image = cv2.bilateralFilter(img, 9, 75, 75)
        elif value == 5:
            new_image = cv2.convertScaleAbs(img, alpha=1.4, beta=0)
        elif value == 6:
            new_image = cv2.cvtColor(cv2.equalizeHist(gray), cv2.COLOR_GRAY2BGR)
        elif value == 7:
            new_image = cv2.bitwise_not(img)
        elif value == 8:
            new_image = cv2.cvtColor(cv2.Canny(gray, 100, 200), cv2.COLOR_GRAY2BGR)
        elif value == 9:
            new_image = cv2.cvtColor(cv2.Sobel(gray, cv2.CV_8U, 1, 0, ksize=3), cv2.COLOR_GRAY2BGR)
        elif value == 10:
            new_image = cv2.cvtColor(cv2.Sobel(gray, cv2.CV_8U, 0, 1, ksize=3), cv2.COLOR_GRAY2BGR)
        elif value == 11:
            new_image = cv2.cvtColor(cv2.Laplacian(gray, cv2.CV_8U), cv2.COLOR_GRAY2BGR)
        elif value == 12:
            _, new_image = cv2.threshold(gray, 127, 255, cv2.THRESH_BINARY)
            new_image = cv2.cvtColor(new_image, cv2.COLOR_GRAY2BGR)
        elif value == 13:
            new_image = cv2.cvtColor(cv2.erode(gray, kernel), cv2.COLOR_GRAY2BGR)
        elif value == 14:
            new_image = cv2.cvtColor(cv2.dilate(gray, kernel), cv2.COLOR_GRAY2BGR)
        elif value == 15:
            new_image = cv2.cvtColor(cv2.morphologyEx(gray, cv2.MORPH_OPEN, kernel), cv2.COLOR_GRAY2BGR)
        elif value == 16:
            new_image = cv2.cvtColor(cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel), cv2.COLOR_GRAY2BGR)
        else:
            new_image = img.copy()
        render_image(new_image)

    def upload_image():
        global img, current_image, cursor_position, current_image_name, current_image_size

        image_path = filedialog.askopenfilename(
            title='Upload image',
            filetypes=[
                ('Image files', '*.png *.jpg *.jpeg *.bmp *.tif *.tiff'),
                ('All files', '*.*'),
            ],
        )

        if not image_path:
            return

        new_image = cv2.imread(image_path)
        if new_image is None:
            print('Could not load the selected image.')
            return

        img = new_image
        current_image_name = image_path.split('\\')[-1]
        current_image_size = os.path.getsize(image_path)
        current_image = img.copy()
        cursor_position = None
        cv2.setTrackbarPos('Brightness', 'Val Adjustment', 100)
        cv2.setTrackbarPos('Contrast', 'Val Adjustment', 100)
        cv2.setTrackbarPos('Rotation', 'Val Adjustment', 100)
        cv2.setTrackbarPos('Translate', 'Val Adjustment', 0)
        cv2.setTrackbarPos('Shear', 'Val Adjustment', 0)
        cv2.setTrackbarPos('Filter', 'Val Adjustment', 0)
        render_image(img)

    #Show RGB values of the pixel under the mouse cursor
    def show_rgb_values(event, x, y, flags, param):
        global cursor_position, selection_start, selection_box

        x = int(x / zoom_level)
        y = int(y / zoom_level)

        if event == cv2.EVENT_MOUSEMOVE:
            if 0 <= x < current_image.shape[1] and 0 <= y < current_image.shape[0]:
                cursor_position = (x, y)
                if selection_start is not None:
                    selection_box = (selection_start[0], selection_start[1], x, y)
                render_image(current_image)
        elif event == cv2.EVENT_LBUTTONDOWN:
            selection_start = (x, y)
            selection_box = (x, y, x, y)
        elif event == cv2.EVENT_LBUTTONUP:
            selection_start = None
            show_histogram()

        
    # Create a window and trackbars for brightness and contrast adjustment
    cv2.namedWindow('Val Adjustment')
    cv2.setMouseCallback('Val Adjustment', show_rgb_values)
    cv2.createTrackbar('Brightness', 'Val Adjustment', 100, 200, update_brightness)
    cv2.createTrackbar('Contrast', 'Val Adjustment', 100, 200, update_contrast)
    cv2.createTrackbar('Rotation', 'Val Adjustment', -180, 180, update_rotation)
    cv2.createTrackbar('Translate', 'Val Adjustment', 0, 100, update_translate)
    cv2.createTrackbar('Shear', 'Val Adjustment', 0, 200, update_shear)
    cv2.setTrackbarMin('Shear', 'Val Adjustment', -100)
    cv2.setTrackbarMax('Shear', 'Val Adjustment', 100)
    cv2.createTrackbar('Filter', 'Val Adjustment', 0, 16, update_filter)
    cv2.createTrackbar('Zoom', 'Val Adjustment', 10, 40, lambda value: None)

    root = tk.Tk()
    root.title('Function limits')
    root.withdraw()
    limits_window = tk.Toplevel(root)
    limits_window.title('Edit function limits')
    limits_window.protocol('WM_DELETE_WINDOW', limits_window.withdraw)
    tk.Label(limits_window, text='Function').grid(row=0, column=0, padx=8, pady=6)
    tk.Label(limits_window, text='Start').grid(row=0, column=1, padx=8, pady=6)
    tk.Label(limits_window, text='End').grid(row=0, column=2, padx=8, pady=6)

    for row, (name, values) in enumerate(limits.items(), start=1):
        tk.Label(limits_window, text=name).grid(row=row, column=0, padx=8, pady=3, sticky='w')
        start_entry = tk.Entry(limits_window, width=8)
        end_entry = tk.Entry(limits_window, width=8)
        start_entry.insert(0, str(values[0]))
        end_entry.insert(0, str(values[1]))
        start_entry.grid(row=row, column=1, padx=8, pady=3)
        end_entry.grid(row=row, column=2, padx=8, pady=3)
        limit_entries[name] = (start_entry, end_entry)

    def apply_limits():
        for name, (start_entry, end_entry) in limit_entries.items():
            try:
                start = int(start_entry.get())
                end = int(end_entry.get())
            except ValueError:
                continue
            if start >= end:
                continue
            limits[name] = [start, end]
            cv2.setTrackbarMin(name, 'Val Adjustment', start)
            cv2.setTrackbarMax(name, 'Val Adjustment', end)
            current_value = cv2.getTrackbarPos(name, 'Val Adjustment')
            cv2.setTrackbarPos(name, 'Val Adjustment', max(start, min(end, current_value)))

    tk.Button(limits_window, text='Apply limits', command=apply_limits).grid(
        row=len(limits) + 1, column=0, columnspan=3, padx=8, pady=10, sticky='ew')
    limits_window.withdraw()
    update_brightness(100)
    update_contrast(100)
    update_rotation(100)
    update_shear(0)
    update_filter(0)
    print("Press 'u' to upload an image or 'l' to edit function limits.")
    while True:
        root.update()
        key = cv2.waitKey(20) & 0xFF
        zoom_level = max(0.5, cv2.getTrackbarPos('Zoom', 'Val Adjustment') / 10)
        if key == ord('u'):
            upload_image()
        elif key == ord('l'):
            limits_window.deiconify()
        elif key == ord('h'):
            show_histogram()
        elif key == ord('m'):
            histogram_mode = {'rgb': 'cmyk', 'cmyk': 'gray', 'gray': 'rgb'}[histogram_mode]
            show_histogram()
        elif key in (ord('+'), ord('=')):
            histogram_zoom = min(4.0, histogram_zoom + 0.5)
            show_histogram()
        elif key == ord('-'):
            histogram_zoom = max(0.5, histogram_zoom - 0.5)
            show_histogram()
        elif key == 27:
            break
    root.destroy()
    cv2.destroyAllWindows()  # Close all OpenCV windows