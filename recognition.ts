import * as jimp from 'jimp';
import { maxBy, meanBy } from 'lodash';
import { loadImage, FrontalFaceDetector, FaceLandmark5Predictor, FullObjectDetection } from 'face-recognition';

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

    return maxBy(shapes, shape => shape.rect.area)
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

function getMetadata(img: jimp, shape: FullObjectDetection) {
    const { leftEye, rightEye } = getEyes(shape);

    return Promise.resolve(img).then((img) => {
        const rotation = Math.atan( (leftEye.y - rightEye.y) / (leftEye.x - rightEye.x) ) * 180 / Math.PI;
        const distance = rightEye.x - leftEye.x;
        const scale = (rightEye.x - leftEye.x) / img.bitmap.width;

        return {
            rotation,
            distance,
            scale,
        }
    });
}

export {
    getMetadata,
    getFacialLandmark,
}