import * as glob from 'glob';
import * as minimist from 'minimist';
import * as sharp from 'sharp';
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
        const distance = getDistanceBetweenEyes(shape);

        var img = sharp(file);
        const scale = getFaceScale(img, shape);
        const offset = getFaceOffset(img, shape);

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

function getEyes(shape: FullObjectDetection) {
    const parts = shape.getParts();
    var leftEye = parts[parts.length - 3];
    var rightEye = parts[0];

    return {
        leftEye,
        rightEye,
    };
}

function getRotationOfFacialLandmark(shape: FullObjectDetection) {
    const { leftEye, rightEye } = getEyes(shape);
    return Math.atan( (leftEye.y - rightEye.y) / (leftEye.x - rightEye.x) ) * 180 / Math.PI;
}

function getDistanceBetweenEyes(shape: FullObjectDetection) {
    const { leftEye, rightEye } = getEyes(shape);
    return rightEye.x - leftEye.x;
}

/**
 * Gets face scale and offset relative to the image center
 * @param shape 
 */
function getFaceScale(img: sharp.SharpInstance, shape: FullObjectDetection) {
    const { leftEye, rightEye } = getEyes(shape);

    const distance = getDistanceBetweenEyes(shape);

    return distance / img.
}