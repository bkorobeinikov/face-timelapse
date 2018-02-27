import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as minimist from 'minimist';
import * as jimp from 'jimp';
import { maxBy, meanBy } from 'lodash';
import { getMetadata, getFacialLandmark } from './recognition'
import { applyRotation, copyFile, applyOffset } from './utils'

const args = minimist(process.argv.slice(2));
const sourcePath = args.path;

const outputDirNameStage1 = './stage1';
const outputDirNameStage2 = './stage2';

/**
 * Rotate pictures, so the eyes are aligned horizontally
 * @param sourceGlob source path
 */
function stage1(sourceGlob: string) {
    global.console.log('======== STAGE #1 ========');

    return new Promise((resolve, reject) => {
        glob(sourceGlob, {}, (err, files: string[]) => {
            // stage 1 - rotate files
            const stage1tasks = files.map(file => {
                const dir = path.dirname(file);
                const outputDir = path.resolve(dir, outputDirNameStage1);
                const outputFile = path.resolve(outputDir, path.basename(file));
                const outputFailedDir = path.resolve(outputDir, './failed/');
                const outputFileFailed = path.resolve(outputFailedDir, path.basename(file));

                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir);
                }

                if (!fs.existsSync(path.dirname(outputFailedDir))) {
                    fs.mkdirSync(path.dirname(outputFailedDir));
                }

                const shape = getFacialLandmark(file);

                if (shape == null) {
                    global.console.warn(`${file} - not face landmark detected; copying original;`);
                    return copyFile(file, outputFileFailed);
                }

                return jimp.read(file)
                    .then(img => getMetadata(img, shape))
                    .then(metadata => {
                        global.console.log(`deg: ${metadata.rotation}; scale: ${metadata.scale}; dist: ${metadata.distance}; img: ${file}`);
                        return metadata;
                    })
                    .then(meta => applyRotation(file, outputFile, meta.rotation))
                    .catch(() => {
                        global.console.warn(`${file} - failed to apply rotation; copying original;`);
                        return copyFile(file, outputFileFailed);
                    });
            });

            Promise.all(stage1tasks).then(resolve).catch(reject);
        })
    });
}

function stage2(sourceGlob: string) {
    global.console.log('======== STAGE #2 ========');

    return new Promise((resolve, reject) => {
        glob(sourceGlob, {}, (err, files: string[]) => {
            // stage 1 - rotate files
            const stage2tasks = files.map(file => {
                const dir = path.dirname(file);
                const fileName = path.basename(file);
                const stage1Dir = path.resolve(dir, outputDirNameStage1)
                const stage2Dir = path.resolve(dir, outputDirNameStage2);
                const stage2DirFailed = path.resolve(stage2Dir, './failed');
                const outputFile = path.resolve(stage2Dir, path.basename(file));
                const outputFileFailed = path.resolve(stage2DirFailed, fileName);

                file = path.resolve(stage1Dir, fileName);

                if (!fs.existsSync(stage2Dir)) {
                    fs.mkdirSync(stage2Dir);
                }

                if (!fs.existsSync(stage2DirFailed)) {
                    fs.mkdirSync(stage2DirFailed);
                }

                const shape = getFacialLandmark(file);

                 if (shape == null) {
                    global.console.warn(`${file} - not face landmark detected; copying original;`);
                    return copyFile(file, outputFileFailed).then(() => null);
                }

                return jimp.read(file)
                    .then(img => getMetadata(img, shape))
                    .then(metadata => {
                        global.console.log(`center: ${metadata.center.x}:${metadata.center.y}; img: ${file}`);
                        return metadata;
                    })
                    .then(meta => {
                        return {
                            file,
                            ...meta
                        };
                    });
            });

            Promise.all(stage2tasks)
                .then(metas => metas.filter(meta => meta != null))
                .then(metas => {
                    const avgX = meanBy(metas, meta => meta.center.x);
                    const avgY = meanBy(metas, meta => meta.center.y);

                    const avgDist = meanBy(metas, meta => meta.distance);

                    global.console.log(`avg center: ${avgX}:${avgY}; avg dist: ${avgDist}`);

                    return {
                        avgDist,
                        avgCenter: {
                            x: avgX,
                            y: avgY,
                        },
                        metas: metas,
                    };
                }).then(data => {
                    const stage2tasks = data.metas.map(meta => {

                        const dir = path.dirname(meta.file);
                        const fileName = path.basename(meta.file);
                        const stage2Dir = path.resolve(dir, '../', outputDirNameStage2);
                        const stage2DirFailed = path.resolve(stage2Dir, './failed');
                        const outputFile = path.resolve(stage2Dir, fileName);
                        const outputFileFailed = path.resolve(stage2DirFailed, fileName);

                        const offset = {
                            x: data.avgCenter.x - meta.center.x,
                            y: data.avgCenter.y - meta.center.y,
                        };

                        const scale = data.avgDist / meta.distance;

                        applyOffset(meta.file, outputFile, scale, meta.center)
                            .catch(() => {
                                global.console.warn(`${meta.file} - failed to apply offset; copying original;`);
                                return copyFile(meta.file, outputFileFailed);
                            });
                    });

                    return Promise.all(stage2tasks);
                }).then(resolve).catch(reject);
        });
    });
}

stage1(sourcePath).then(() => stage2(sourcePath));