# Horizon Forge Systems

Complete Horizon Forge portfolio website and playable Ember Solitaire web beta.

## Deploy on Vercel

Import this repository. Use Framework Preset **Other**, Build Command
**node build.mjs**, Output Directory **dist**, and leave Install Command empty.
The included vercel.json supplies these settings. No packages, database or
API keys are needed. The build script uses only built-in Node.js modules.

## Source files

`site-source.tar.gz` contains the complete editable HTML, CSS, JavaScript and
images under `dist/`, including `/ember-solitaire/` and its privacy page.
The archive preserves the nested asset layout during browser upload.
Run `node build.mjs` locally to extract all source files.

To update: extract, edit dist, then replace the archive with the modified dist
folder packaged as USTAR tar.gz. On Windows, Python can create this archive:

```python
import tarfile
with tarfile.open('site-source.tar.gz', 'w:gz', format=tarfile.USTAR_FORMAT) as t:
    t.add('dist', arcname='dist')
```

Alternatively commit the extracted dist folder, remove buildCommand from
vercel.json (or set it to an empty string), and maintain the static files directly.
For game updates, revise the cache VERSION in dist/ember-solitaire/sw.js.

Ads remain disabled. Contact inquiries use the visitor's email app.
Game saves are browser-local. This repository does not include the private
access restrictions of the original ChatGPT Sites deployment.

Before switching horizonforgesystems.com, test the Vercel preview URL, gameplay,
privacy page and contact flow. Browser gameplay testing remains outstanding.
