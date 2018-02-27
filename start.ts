import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as minimist from 'minimist';
import * as jimp from 'jimp';
import { maxBy, meanBy } from 'lodash';
import { getMetadata, getFacialLandmark } from './recognition'
import { applyRotation, copyFile, applyOffset, ensureDir } from './utils'

import { createSystem, Actor } from 'comedy';

const args = minimist(process.argv.slice(2));
const sourcePath = args.path;

const outputDirNameStage1 = './stage1';
const outputDirNameStage2 = './stage2';

const actorSystem = createSystem({});

interface IPoint {
    x: number;
    y: number;
}

interface ISize {
    width: number;
    height: number;
}

interface IDetectionMetadata {
    rotation: number;
    center: IPoint;
}

interface IImageAnalysis {
    source: string;

    size: ISize;

    metadata: IDetectionMetadata;
}

class ImageAnalyzerActor {
    detect(source: string): Promise<IImageAnalysis> {
        const shape = getFacialLandmark(source);

        return jimp.read(source)
            .then(img => Promise.all([getMetadata(img, shape), Promise.resolve(img)]))
            .then(([metadata, img]) => {
                return {
                    source: source,
                    size: {
                        width: img.bitmap.width,
                        height: img.bitmap.height,
                    },
                    metadata: metadata ? {
                        rotation: metadata.rotation,
                        center: metadata.center,
                    } : null,
                };
            })
            .then((pic: IImageAnalysis) => {
                if (!pic.metadata) {
                    global.console.warn(`file: ${pic.source}; NO METADATA`);
                } else {
                    global.console.log(`file: ${pic.source}; deg: ${pic.metadata.rotation}; center: ${pic.metadata.center.x}:${pic.metadata.center.y}`);
                }

                return pic;
            });
    }
}

class ImageRotationActor {
    rotate(pic: IImageAnalysis): Promise<string> {
        const source = pic.source;
        const dir = path.dirname(pic.source);
        const dest = path.resolve(dir, './output', path.basename(source));
        const destFail = path.resolve(dir, './output/failed', path.basename(source));

        if (!pic.metadata) {
            ensureDir(destFail);
            return copyFile(source, destFail)
                .then(() => null);
        }

        return applyRotation(source, dest, pic.metadata.rotation)
            .then(() => dest)
            .catch(() => {
                global.console.warn(`${source} - failed to apply rotation; copying original;`);
                return copyFile(source, destFail).then(() => null);
            });
    }
}

function run(files: string[]): Promise<any> {
    let sourcePictures: IImageAnalysis[] = null;
    let outputImages: IImageAnalysis[] = null;

    let rootActor: Actor = null;
    let imgActor: Actor = null;

    return actorSystem.rootActor()
        .then(root => rootActor = root)
        .then(root => root.createChild(ImageAnalyzerActor, {
            mode: 'in-memory',
            clusterSize: 3,
        }))
        .then(actor => imgActor = actor)
        .then(actor => Promise.all(files.map(f => actor.sendAndReceive('detect', f))))
        .then((result: IImageAnalysis[]) => {
            sourcePictures = result;
        })
        .then(() => rootActor.createChild(ImageRotationActor, {
            mode: 'in-memory',
            clusterSize: 3,
        }))
        .then(rotateActor => Promise.all(sourcePictures.map(pic => rotateActor.sendAndReceive('rotate', pic))))
        .then((outputFiles: string[]) => Promise.all(outputFiles.map(file => imgActor.sendAndReceive('detect', file))))
        .then((result: IImageAnalysis[]) => {
            outputImages = result;
        })
        .then(() => global.console.log('all done'))
        .then(() => actorSystem.destroy());
}

/**
 * Rotate pictures, so the eyes are aligned horizontally
 * @param sourceGlob source path
 */
function stage1(sourceGlob: string): Promise<any> {
    global.console.log('======== STAGE #1 ========');

    return new Promise((resolve, reject) => {
        glob(sourceGlob, {}, (err, files: string[]) => {
            if (err) {
                reject(err)
            } else {
                resolve(files);
            }
        });
    }).then((files: string[]) => run(files));
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

// stage1(sourcePath).then(() => stage2(sourcePath));
stage1(sourcePath);
