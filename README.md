[![Build Status](https://travis-ci.org/gazmull/kh-snek.svg?branch=master)](https://travis-ci.org/gazmull/kh-snek)
# kh-snek

Used in conjunction with [Kamihime Player](https://github.com/gazmull/kamihime-player)

This is the Node.JS port of Eliont's Builder Script ([Kamihime Player Offline](https://harem-battle.club/kamihime-project/3605-love-scenes-collecting.html))

# How to Use
* `$ git clone -b scripts-offline --single-branch https://github.com/gazmull/kh-snek.git`
* `$ cd kh-snek`
* `$ npm install`
* Paste harem files to `kamihime-player/src/static/scripts`.
  * **Your `scripts` folder shall be structured according to:**
    * Take note that `ssra` / `ssr` / `sr` / `r` folder shall contain `Kamihime`-type characters only. Nothing else.
    <pre>+-- scripts
    |  -- soul
    |  -- eidolon
    |  -- ssra
    |  -- ssr
    |  -- sr
    |  -- r</pre>
    * Then paste the character folders according to their type / rarity (Kamihime-type only).
  * Folder of each character shall be named according to their proper name.
    * Example: `Susanoo [Awakened]` and `[Apostle of Light] Satan`; structure:
    * ***Please***, let the files stay as they were downloaded without modifying their name.
      <pre>+-- scripts
      |  +-- ssra
      |  |  +-- Susanoo [Awakened]
      |  |  |  -- 638_harem-character
      |  |  |  -- 639_harem-character
      |  |  |  -- 640_harem-character
      |  +-- ssr
      |  |  +-- [Apostle of Light] Satan
      |  |  |  -- 524_harem-character
      |  |  |  -- 525_harem-character
      |  |  |  -- 526_harem-character
      |  |  |  -- 527_harem-character
      |  |  |  -- 528_harem-character
      </pre>
* Configure `auth.js`. Take the template from `auth.example.js`
* `$ node .`

# Finally
* Please use this wisely.
* If you liked the game's scenes (or somehow; most of them are cheesy anyway :lul:), support the developers!

# Contributing
* You have to fork this repository, and follow the project's ESLint configuration. Run `npm test` or `yarn test` to verify if your build is passing. Failing build will be rejected.
  * `npm install eslint` or `yarn add eslint` to install ESLint.

# License
  MIT
