[![Build Status](https://travis-ci.org/gazmull/kh-snek.svg?branch=master)](https://travis-ci.org/gazmull/kh-snek)
# 🐍

Used to download and process assets provided by [kamihime-database](https://github.com/gazmull/kamihime-database).

## Instructions
You don't.

### Flags Available

- `-g`, `--generics` — Download story assets only
- `-f`, `--force` — Forcefully download assets
- `--nohentai` — Make extractor do extraction for characters with no scenario (e.g. Haruhi Suzumiya).
- `--nodl` — Don't download assets (only parse scene info)
- `-l#`, `--latest=#` — Process the latest characters (`#` being number of characters) **not compatible with `--id`**
- `-i$`, `--id=$` — Process specific character (`$` being character ID) **not compatible with `--latest`**
- The following for only processing specific character class (**effectively used with any other flags except `--id`**):
  - `--eidolon`
  - `--soul`
  - `--ssr+`, `--ssr`, `--sr`, `--r`
