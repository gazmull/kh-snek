[![Build Status](https://travis-ci.org/gazmull/kh-snek.svg?branch=master)](https://travis-ci.org/gazmull/kh-snek)
# 🐍

Used to download and process assets provided by [kamihime-database](https://github.com/gazmull/kamihime-database).

## Instructions
You don't.

### Flags Available

- `-d`, `--dig` — Don't ask for user token (Pure brute force method)
- `-g`, `--generics` — Download story assets only
- `-f`, `--force` — Forcefully download assets
- `--nohentai` — Make extractor do extraction for characters with no scenario (e.g. Haruhi Suzumiya)
- `--nodl` — Don't download assets (only parse scene info)
- `--nomp3` — Don't download sound files
- `--nowebp` — Don't make webp version of images
- `-l#`, `--latest=#` — Process the latest characters (`#` being number of characters) **not compatible with `--id`**
- `-i$`, `--id=$` — Process specific character (`$` being character ID). **not compatible with `--latest`**
  - For multiple specific characters, separate IDs by **`-`**.
- The following for only processing specific character class (**effectively used with any other flags except `--id`**):
  - `--eidolon`
  - `--soul`
  - `--ssr+`, `--ssr`, `--sr`, `--r`
