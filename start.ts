import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as minimist from 'minimist';
import * as jimp from 'jimp';
import { maxBy, meanBy } from 'lodash';
import { getMetadata, getFacialLandmark } from './recognition'
import { applyRotation, copyFile } from './utils'

const args = minimist(process.argv.slice(2));
const sourcePath = args.path;

/**
 * Rotate pictures, so the eyes are aligned horizontally
 * @param sourceGlob source path
 */
function stage1(sourceGlob: string) {
    global.console.log('======== STAGE #1 ========');
    const outputDirName = './stage1';

    return new Promise((resolve, reject) => {
        glob(sourceGlob, {}, (err, files: string[]) => {
            // stage 1 - rotate files
            const stage1tasks = files.map(file => {
                const dir = path.dirname(file);
                const outputDir = path.resolve(dir, outputDirName);
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

stage1(sourcePath);