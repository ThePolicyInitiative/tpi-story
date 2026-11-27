# Rebuilding Lebanon’s Fiscal Contract for a Fairer Society: scrollytelling page

A standalone page for The Policy Initiative (TPI), built from the roundtable concept note dated November 26, 2026. It uses no frameworks and has no dependencies. Node 18 or later is only needed to rebuild and preview it.

## Files

| File | What it is |
|---|---|
| `content/en.json` | **All copy and chart data.** Edit this file. |
| `build.mjs` | Turns `content/en.json` into `index.html`, then refreshes `dist/`. |
| `styles.css` | Layout and brand tokens. Colours are set at the top under `:root`. |
| `script.js` | Progressive enhancement only: sticky-chart states, inline reveals and the progress bar. |
| `assets/` | TPI wordmark (vector, taken from the concept-note letterhead), favicon and self-hosted Montserrat (SIL OFL). |
| `dist/` | Public files only. **This is the folder you deploy.** |
| `serve.mjs` | Local preview server. |

## Edit, preview, deploy

```powershell
node build.mjs
```

```powershell
node serve.mjs
```

Then open http://localhost:8080.

**Live link (GitHub Pages):** https://thepolicyinitiative.github.io/tpi-story/
Repository: https://github.com/ThePolicyInitiative/tpi-story. The `main` branch holds the source, and `gh-pages` holds the published page.

**To update the live page**, run these commands one after another in this folder:

```powershell
node build.mjs
```

```powershell
git add -A; git commit -m "Update story"; git push
```

```powershell
git subtree push --prefix dist origin gh-pages
```

GitHub republishes within a minute or two at the same URL.

**Alternative: Netlify**
1. Run `node build.mjs`.
2. Go to https://app.netlify.com/drop and drag the `dist` folder onto the page. Netlify returns a public URL, such as `something.netlify.app`, that you can send to anyone.
3. To update the page later, rebuild, open the site in Netlify and go to **Deploys**, then drag `dist` there again. The URL stays the same.

If the folder is in a Git repository connected to Netlify, `netlify.toml` already sets the build command (`node build.mjs`) and the publish folder (`dist`).

## How the content file works

- `prologue.lines`: the opening statements shown one per screen after the cover.
- `chapters[].teaser`: the line under each full-screen chapter title card. `closing`: the final "What should the budget be?" frame.
- `chapters[].steps[]`: each step is one story beat, with text paragraphs plus a `scene` and a `reveal` level. Text in `**double asterisks**` is shown in bold.
- `scenes{}`: one chart per scene, made of panels. The panel types are `bars`, `slope`, `share`, `waffle`, `stat`, `increase`, `note` and `unresolved`. Any panel, bar or line with `"from": n` appears when a step reaches `reveal: n`.
- `display` is the visible label (for example `~$7bn`). `sr` is how screen readers say it (for example "around 7 billion dollars").
- Each scene's `summary` is its text equivalent. It appears under a "Chart as text" toggle beneath the last step that uses the scene.
- `sources.cn.url` is empty because no verified TPI research URL was supplied. Add the URL and every source line will link to it.

## Behaviour

- **Desktop (≥ 960px, JavaScript on):** text sits on the left and a sticky chart on the right. The chart changes when a step crosses the middle of the screen, or when a step receives keyboard focus.
- **Mobile:** each figure sits directly below its text. In section 04, each step shows only the figure it introduces.
- **No JavaScript, reduced motion or print:** each figure is rendered as static HTML in its final state for that step. Nothing is hidden waiting for an animation.
- Normal scrolling is never intercepted.

## Arabic / RTL

The layout uses CSS logical properties throughout. Bars, slope lines, ticks and the progress bar have `[dir="rtl"]` mirroring rules. To add Arabic, copy `content/en.json` to `content/ar.json`, set `"lang": "ar"` and `"dir": "rtl"`, translate it and run `node build.mjs ar`. That writes `ar/index.html`, which is copied into `dist/ar/`. An Arabic typeface still needs to be added, because Montserrat has no Arabic glyphs. RTL has not been tested yet because there is no Arabic content.

## Provisional design decisions

- **Colours are provisional.** No approved palette was supplied. Navy is `#1B2B4B` and the muted teal accent is `#3D7A76` (with `#2F6662` for small text). Replace `--navy`, `--accent` and `--accent-text` in `styles.css`.
- **Typography:** Montserrat, matching the concept note.
- **Logo:** traced from the vector wordmark in the concept-note letterhead. Replace `assets/tpi-logo.svg` with the master file if you have one.
- The reference posters were not included with the request, so the design could not be checked against them.
