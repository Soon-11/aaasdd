# Game Calendar Site

`site/` is a static game calendar website built from the scraped Inven calendar data.

## Structure

- `../examples/inven_calendar_scraper.py`
  - Scrapes list/detail data into raw JSON or CSV files.
- `../examples/build_inven_dataset.py`
  - Merges many scraped files into one final dataset.
- `../examples/localize_site_images.py`
  - Downloads external images into `site/assets/images` and rewrites dataset image paths.
- `./data/inven_dataset.json`
  - Final dataset used by the website.
- `./index.html`
  - Static site entrypoint.
- `./app.js`
  - UI logic for filters, monthly/weekly calendar views, highlights, and the detail modal.
- `./styles.css`
  - Site styles.

## Update Workflow

From the repository root:

1. Scrape raw data

```powershell
& "C:\Users\pjcki\AppData\Local\Programs\Python\Python312\python.exe" ".\examples\inven_calendar_scraper.py" --year 2026 --all-months --all-types
```

2. Build the merged dataset

```powershell
& "C:\Users\pjcki\AppData\Local\Programs\Python\Python312\python.exe" ".\examples\build_inven_dataset.py" --input-glob "C:\Users\pjcki\inven_calendar_*.json"
```

3. Localize images

```powershell
& "C:\Users\pjcki\AppData\Local\Programs\Python\Python312\python.exe" ".\examples\localize_site_images.py"
```

## Run Locally

From the repository root:

```powershell
& "C:\Users\pjcki\AppData\Local\Programs\Python\Python312\python.exe" -m http.server 8000
```

Open:

- `http://localhost:8000/site/`

Use `Ctrl+F5` after data or UI updates.

## Current Features

- Horizontal filter bar
- Monthly / weekly calendar view
- Quick status filters
- Highlight cards for near-term releases
- Day-based schedule list
- Click-to-open detail modal
- Local image assets for stable rendering

## Add Content Directly In HTML

You can also add data directly inside `site/index.html`.

There are two JSON blocks near the bottom of the file:

- `embedded-calendar-data`
  - If you paste the full dataset there, the page can run without `site/data/inven_dataset.json`.
- `manual-calendar-data`
  - Add only extra games/events there and they will be merged into the loaded dataset.

Recommended use:

- keep the main scraped dataset in `site/data/inven_dataset.json`
- add hand-made or temporary entries in `manual-calendar-data`

## Deployment

The `site/` folder is ready for static hosting.

- GitHub Pages: publish the contents of `site/`
- Netlify / Vercel static hosting: use `site` as the publish directory
- Any static web server: serve the `site` folder directly

## When Data Changes

Rerun only these two commands:

```powershell
& "C:\Users\pjcki\AppData\Local\Programs\Python\Python312\python.exe" ".\examples\build_inven_dataset.py" --input-glob "C:\Users\pjcki\inven_calendar_*.json"
& "C:\Users\pjcki\AppData\Local\Programs\Python\Python312\python.exe" ".\examples\localize_site_images.py"
```
