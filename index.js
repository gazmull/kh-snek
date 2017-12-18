const download = require('image-downloader');
const sql = require('sqlite');
const fs = require('fs');
const fsEx = require('mkdirp');

const kamihime = {

    intro: '94/76/',
    scene: 'de/59/',
    get: '76/89/'

};

const eidolon = {

    intro: '9f/51/',
    scene: 'd7/ad/',
    get: '9f/51/'

};

const soul = {

    intro: '67/01/',
    scene: 'ec/4d/',
    get: '3b/26/'

};

const baseURL = {

    scenarios: 'https://cf.static.r.kamihimeproject.dmmgames.com/scenarios/'

};

const sequences = ['a', 'b', 'c1', 'c2', 'c3', 'd'];

// https://cf.static.r.kamihimeproject.dmmgames.com/scenarios/d7/ad/a1ef0e1bc4d7da47935eae9c20e388b806f12ba16f14d7ad/0037-2-2_d.jpg
const baseDestination = __dirname + '/static/scenarios/';

start();

process.on('unhandledRejection', err => {
    console.log(err.stack);
});

async function start() {
    try {
        await sql.open('../eros/db/Eros.db');
        const row = await sql.all('SELECT khID, khHarem_hentai1Resource2, khHarem_hentai2Resource2 FROM kamihime WHERE khHarem_hentai1Resource2 IS NOT NULL ORDER BY khID DESC');
        for (let i = 0; i < row.length; i++) {
            if (row[i].khHarem_hentai1Resource2) {
                await fsEx(`${baseDestination}${row[i].khID}/${row[i].khHarem_hentai1Resource2}`, async err => {
                    if (err) return console.error(err);
                    for(const sequence of sequences) {
                        if(fs.existsSync(`${baseDestination}${row[i].khID}/${row[i].khHarem_hentai1Resource2}/${row[i].khID.slice(1)}-2-2_${sequence}.jpg`)) {
                            console.log(`Skipped: ${row[i].khID}-2-2_${sequence}.jpg`);
                            continue;
                        }
                        await download.image({
                            url:
                                `${ row[i].khID.startsWith('e')
                                    ? baseURL.scenarios + eidolon.scene
                                    : row[i].khID.startsWith('s')
                                        ? baseURL.scenarios + soul.scene
                                        : baseURL.scenarios + kamihime.scene }${row[i].khHarem_hentai1Resource2}/${row[i].khID.slice(1)}-2-2_${sequence}.jpg`,
                            dest: `${baseDestination}${row[i].khID}/${row[i].khHarem_hentai1Resource2}`
                        }).then(res => {
                            console.log(`Downloaded: ${res.filename}`);
                        }).catch(err => {
                            console.log(`Error: ${err}`);
                        });
                    }
                });
            }

            if (row[i].khHarem_hentai2Resource2) {
                await fsEx(`${baseDestination}${row[i].khID}/${row[i].khHarem_hentai2Resource2}`, async err => {
                    if (err) return console.error(err);
                    for(const sequence of sequences) {
                        if(fs.existsSync(`${baseDestination}${row[i].khID}/${row[i].khHarem_hentai2Resource2}/${row[i].khID.slice(1)}-3-2_${sequence}.jpg`)) {
                            console.log(`Skipped: ${row[i].khID}-3-2_${sequence}.jpg`);
                            continue;
                        }
                        await download.image({
                            url:
                                `${ row[i].khID.startsWith('e')
                                    ? baseURL.scenarios + eidolon.scene
                                    : row[i].khID.startsWith('s')
                                        ? baseURL.scenarios + soul.scene
                                        : baseURL.scenarios + kamihime.scene }${row[i].khHarem_hentai2Resource2}/${row[i].khID.slice(1)}-3-2_${sequence}.jpg`,
                            dest: `${baseDestination}${row[i].khID}/${row[i].khHarem_hentai2Resource2}`
                        }).then(res => {
                            console.log(`Downloaded: ${res.filename}`);
                        }).catch(err => {
                            console.log(`Error: ${err}`);
                        });
                    }
                });
            }

            else {
                if (i === row.length) console.log('Finished.');
                else continue;
            }
        }
    }
    catch (err) { console.log(err.stack); }
}

