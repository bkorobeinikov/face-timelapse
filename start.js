const fr = require('face-recognition');

const img = fr.loadImage('C:/Users/borysk/Documents/asia_trip/0966.jpg');
const detector = new fr.FrontalFaceDetector();
const faceRects = detector.detect(img);
const predictor = fr.FaceLandmark5Predictor();
const shapes = faceRects.map(rect => predictor.predict(img, rect));

var shape = faceRects[0];
var coords = [shape.top, shape.left, shape.top, shape.right, shape.bottom, shape.right, shape.bottom, shape.left];
var rotation = getRotation(coords)

var leftEye = shapes[0].getParts()[shapes[0].getParts().length - 3];
var rightEye = shapes[0].getParts()[0];

var deg = Math.atan( (leftEye.y - rightEye.y) / (leftEye.x - rightEye.x) ) * 180 / Math.PI;

global.console.log(deg);
// const win = new fr.ImageWindow();
// win.setImage(img);

// win.addOverlay(new fr.Rect(
//     leftEye.x - 50,
//     leftEye.y - 50,
//     leftEye.x + 50,
//     leftEye.y + 50
// ));

// win.addOverlay(new fr.Rect(
//     rightEye.x - 50,
//     rightEye.y - 50,
//     rightEye.x + 50,
//     rightEye.y + 50
// ));

// faceRects.forEach(rect => win.addOverlay(rect))
// // win.renderFaceDetections(faceRects)
// win.renderFaceDetections(shapes);
// fr.hitEnterToContinue();

function getRotation(coords) {
    // Get center as average of top left and bottom right
    var center = [(coords[0] + coords[4]) / 2,
                  (coords[1] + coords[5]) / 2];

    // Get differences top left minus bottom left
    var diffs = [coords[0] - coords[6], coords[1] - coords[7]];

    // Get rotation in degrees
    var rotation = Math.atan(diffs[0]/diffs[1]) * 180 / Math.PI;

    // Adjust for 2nd & 3rd quadrants, i.e. diff y is -ve.
    if (diffs[1] < 0) {
        rotation += 180;

    // Adjust for 4th quadrant
    // i.e. diff x is -ve, diff y is +ve
    } else if (diffs[0] < 0) {
        rotation += 360;
    }
    // return array of [[centerX, centerY], rotation];
    return [center, rotation];
}

// Given coordinages of [x1, y1, x2, y2, x3, y3, x4, y4]
//  *  where the corners are:
//  *            top left    : x1, y1
//  *            top right   : x2, y2
//  *            bottom right: x3, y3
//  *            bottom left : x4, y4