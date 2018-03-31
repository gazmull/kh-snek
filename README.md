[![Build Status](https://travis-ci.org/gazmull/kh-snek.svg?branch=master)](https://travis-ci.org/gazmull/kh-snek)
# kh-snek

Used in conjunction with [Kamihime Database](https://github.com/gazmull/kamihime-database)

This is the Node.JS + Web port of Eliont's Builder Script ([Kamihime Player Offline](https://harem-battle.club/kamihime-project/3605-love-scenes-collecting.html))
> To use this without the Kamihime Database verifier (API) for offline purposes, use the `scripts-offline` branch instead.

# How to Use
* `$ git clone -b scripts --single-branch https://github.com/gazmull/kh-snek.git`
* `$ cd kh-snek`
* `$ npm install`
* Paste harem files to `static/scenarios/scripts`.
  * Folder of each harem files of a character shall be named according to `type_Name`
    * Example: `kamihime_Mars`
* `$ node .`

# Finally
* Please use this wisely.
* If you liked the game's scenes (or somehow; most of them are cheesy anyway :lul:), support the developers!

# Contributing
* You have to fork this repository, and follow the project's ESLint configuration. Run `npm test` or `yarn test` to verify if your build is passing. Failing build will be rejected.
  * `npm install eslint` or `yarn add eslint` to install ESLint.

# License
  MIT
