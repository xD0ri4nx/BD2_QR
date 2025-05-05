// Import jsQR from a CDN that supports ES modules
import jsQR from 'https://cdn.skypack.dev/jsqr';

document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('qr-video');
    const videoContainer = document.getElementById('video-container');
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const resultDiv = document.getElementById('result');
    const resultText = document.getElementById('result-text');
    const status = document.getElementById('status'); // Correct variable name used later

    const canvas = document.createElement('canvas');
    // Add optimization hint for frequent reads
    const canvasContext = canvas.getContext('2d', { willReadFrequently: true });

    let videoStream = null;
    let scanning = false;
    let animationFrameId = null; // To cancel the animation frame

    // Check if videoElement exists (already done, good)
    if (!(videoElement instanceof HTMLVideoElement)) {
        // Maybe display error in status?
        status.textContent = 'Error: Video element not found!';
        throw new Error('Element with ID "qr-video" is not a valid HTMLVideoElement.');
    }

    async function startScanner() {
        // Clear previous results and hide result div
        resultDiv.classList.add('hidden');
        resultText.textContent = '';
        status.textContent = 'Requesting camera access...';
        startButton.disabled = true; // Disable button immediately

        try {
            // Request access to the camera - Let browser choose default for laptop
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true });

            // Set the video stream as the source of the video element
            videoElement.srcObject = videoStream;
            // Use a promise to wait for metadata, ensures dimensions are available
            await new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    resolve();
                };
            });
            await videoElement.play(); // Ensure the video element starts playing

            scanning = true;
            videoContainer.classList.remove('hidden');
            // startButton.disabled = true; // Already disabled
            stopButton.disabled = false;
            status.textContent = 'Scanning for QR code...';

            scanQRCode(); // Begin scanning loop
        } catch (err) {
            console.error("Camera Error:", err);
            status.textContent = `Error: ${err.name}. Unable to access camera. Check permissions.`;
            startButton.disabled = false; // Re-enable start button on error
            stopButton.disabled = true;
            videoContainer.classList.add('hidden');
        }
    }

    function stopScanner() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId); // Stop the loop
            animationFrameId = null;
        }
        if (videoStream) {
            videoStream.getTracks().forEach((track) => track.stop()); // Stop all tracks
            videoStream = null; // Clear the stream variable
        }

        scanning = false;
        videoContainer.classList.add('hidden');
        startButton.disabled = false;
        stopButton.disabled = true;

        // Update status based on whether a result was shown
        if (!resultDiv.classList.contains('hidden')) {
            status.textContent = 'Scan complete. Result shown below.';
        } else {
            status.textContent = 'Scanner stopped.';
        }
    }

    function scanQRCode() {
        // Ensure scanning is still active
        if (!scanning) return;

        // Check if video has dimensions and is ready
        const width = videoElement.videoWidth;
        const height = videoElement.videoHeight;

        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA && width && height) {
            // Set canvas size to match video dimensions
            if (canvas.width !== width) canvas.width = width;
            if (canvas.height !== height) canvas.height = height;

            // Draw the current video frame onto the canvas
            // Remember video is flipped via CSS transform: scaleX(-1);
            // jsQR usually handles this fine.
            canvasContext.drawImage(videoElement, 0, 0, width, height);

            // Extract image data from the canvas
            try { // Add try-catch around jsQR as it might throw errors on unusual images
                const imageData = canvasContext.getImageData(0, 0, width, height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert", // Optional: attempt inverted codes too 'dontInvert' | 'onlyInvert' | 'attemptBoth'
                }); // Decode QR code

                if (code && code.data) { // Check code and data exist
                    status.textContent = 'QR Code successfully scanned!';
                    resultText.textContent = code.data; // Display QR code result
                    resultDiv.classList.remove('hidden');
                    stopScanner(); // Stop scanning after success
                    return; // Exit loop
                }
            } catch (err) {
                console.error("jsQR Error:", err);
                // Optionally update status or just continue scanning
            }
        }

        // Continue scanning if still active
        if (scanning) {
            animationFrameId = requestAnimationFrame(scanQRCode);
        }
    }

    // Add event listeners for start and stop buttons
    startButton.addEventListener('click', startScanner);
    stopButton.addEventListener('click', stopScanner);

    // Optional: Add cleanup if the page is closed/unloaded
    window.addEventListener('beforeunload', stopScanner);
});