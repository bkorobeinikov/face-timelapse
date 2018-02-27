import * as fs from 'fs';
import * as jimp from 'jimp';
import * as path from 'path';

function copyFile(src, dest) {
    return new Promise((resolve, reject) => {
        fs.copyFile(src, dest, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function applyRotation(file: string, outputFile: string, deg: number) {
    return jimp.read(file).then(img => {
        const crop = getCropCoordinates(deg, { w: img.bitmap.width, h: img.bitmap.height });
        global.console.log(`[applyRotation] deg: ${deg}; output: ${outputFile}`)
        return new Promise((resolve, reject) => {
            img.rotate(deg * -1)
            .crop(crop.x, crop.y, crop.w, crop.h)
            .write(outputFile, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve();
                }
            });
        });
    });
}

function applyOffset(file: string, outputFile: string, scale: number, offset: { x: number, y: number}) {
    return jimp.read(file).then(img => {
        // const fileCenter = {
        //     x: img.bitmap.width / 2,
        //     y: img.bitmap.height / 2,
        // };

        const halfWidth = Math.min(offset.x, img.bitmap.width - offset.x);
        const halfHeight = Math.min(offset.y, img.bitmap.height - offset.y);

        const crop = {
            x: offset.x - halfWidth,
            y: offset.y - halfHeight,
            w: offset.x + halfWidth,
            h: offset.y + halfHeight,
        };

        // offset = {
        //     x: -500, // positive - move to the left
        //     y: 0, // positive - move to the top
        // };

        // offset = {
        //     x: offset.x > 0 ? Math.floor(offset.x / 2 * scale) : offset.x,
        //     y: offset.y > 0 ? Math.floor(offset.y / 2 * scale) : offset.y,
        // };

        // const crop = {
        //     x: Math.max(offset.x, 0),
        //     y: Math.max(offset.y, 0),
        //     w: Math.min(img.bitmap.width, img.bitmap.width - Math.abs(offset.x)),
        //     h: Math.min(img.bitmap.height, img.bitmap.height - Math.abs(offset.y)),
        // };

        global.console.log(`[applyOffset] scale: ${scale}; offset: ${offset.x}:${offset.y}; crop: ${crop.x}:${crop.y} ${crop.w}:${crop.h}; output: ${outputFile}`)
        return new Promise((resolve, reject) => {
            img
            .scale(scale)
            .crop(crop.x, crop.y, crop.w, crop.h)
            .write(outputFile, (err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve();
                }
            });
        });
    });
}

function getCropCoordinates(angleInDeg: number, imageDimensions: {h: number, w: number}) {
    const angleInRadians = angleInDeg * (Math.PI/180);
    var ang = angleInRadians;
    var img = imageDimensions;

    var quadrant = Math.floor(ang / (Math.PI / 2)) & 3;
    var sign_alpha = (quadrant & 1) === 0 ? ang : Math.PI - ang;
    var alpha = (sign_alpha % Math.PI + Math.PI) % Math.PI;

    var bb = {
        w: img.w * Math.cos(alpha) + img.h * Math.sin(alpha),
        h: img.w * Math.sin(alpha) + img.h * Math.cos(alpha)
    };

    var gamma = img.w < img.h ? Math.atan2(bb.w, bb.h) : Math.atan2(bb.h, bb.w);

    var delta = Math.PI - alpha - gamma;

    var length = img.w < img.h ? img.h : img.w;
    var d = length * Math.cos(alpha);
    var a = d * Math.sin(alpha) / Math.sin(delta);

    var y = a * Math.cos(gamma);
    var x = y * Math.tan(gamma);

    return {
        x: x,
        y: y,
        w: bb.w - 2 * x,
        h: bb.h - 2 * y
    };
}

export {
    applyRotation,
    copyFile,
    applyOffset,
}