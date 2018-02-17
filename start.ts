import * as glob from 'glob';
import * as minimist from 'minimist';
import { loadImage, FrontalFaceDetector, FaceLandmark5Predictor, FullObjectDetection } from 'face-recognition';

const args = minimist(process.argv.slice(2));
const path = args.path;

glob(path, {}, (err, files: string[]) => {
    files.forEach(file => {
        const shape = getFacialLandmark(file);

        if (shape == null) {
            global.console.warn(`${file} - not face landmark detected`);
            return;
        }

        const rotation = getRotationOfFacialLandmark(shape);

        global.console.log(`rotation: ${rotation}; image: ${file}`);
    });
});

function getFacialLandmark(imagePath: string) {
    const img = loadImage(imagePath);
    const detector = new FrontalFaceDetector();
    const faceRects = detector.detect(img);

    if (faceRects.length == 0) {
        return null;
    }

    const predictor = FaceLandmark5Predictor();
    const shapes = faceRects.map(rect => predictor.predict(img, rect));

    if (shapes.length == 0) {
        return null;
    }

    return shapes[0];
}

function getRotationOfFacialLandmark(shape: FullObjectDetection) {
    const parts = shape.getParts();
    var leftEye = parts[parts.length - 3];
    var rightEye = parts[0];

    return Math.atan( (leftEye.y - rightEye.y) / (leftEye.x - rightEye.x) ) * 180 / Math.PI;
}