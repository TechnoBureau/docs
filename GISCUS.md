# giscus comments

This repository renders page comments with [giscus](https://giscus.app), backed by
GitHub Discussions in [`TechnoBureau/docs`](https://github.com/TechnoBureau/docs).

The integration is intentionally dependency-free: one custom script and one custom
stylesheet, loaded by Documentation.AI from `documentation.json`.

| File | Purpose |
| --- | --- |
| [`scripts/giscus.js`](scripts/giscus.js) | Mounts the widget, handles SPA navigation, theme sync, and per-page opt-out. |
| [`styles/giscus.css`](styles/giscus.css) | Styles the comments section and loading skeleton. |
| [`documentation.json`](documentation.json) | Registers the script (`scripts`) and stylesheet (`customCss`). |

## One-time setup

The code is already wired up, but giscus needs GitHub-side access before a thread
can appear.

1. **Enable Discussions.** Open **Settings → General → Features** in
   `https://github.com/TechnoBureau/docs` and turn on **Discussions**. GitHub
   creates the default categories, including **Announcements**.
2. **Install the giscus app.** Install <https://github.com/apps/giscus> and grant it
   access to `TechnoBureau/docs`. Visitors cannot comment or react until the app is
   installed.
3. **Copy the category ID.** Run the query below (or read the generated snippet on
   <https://giscus.app>) and copy the `DIC_…` id of the **Announcements** category.
4. **Paste it into the script.** Set `CONFIG.categoryId` in
   [`scripts/giscus.js`](scripts/giscus.js), publish, and open any documentation page.

```bash
gh api graphql -f query='
query {
  repository(owner: "TechnoBureau", name: "docs") {
    discussionCategories(first: 20) {
      nodes {
        id
        name
      }
    }
  }
}'
```

Until `categoryId` is filled in, the script stays inert and logs the setup steps in
the browser console instead of rendering a broken widget.

## Configuration

All knobs live in the `CONFIG` object at the top of `scripts/giscus.js`.

| Key | Default | Notes |
| --- | --- | --- |
| `repo` | `TechnoBureau/docs` | Public repository that stores the threads. |
| `repoId` | `R_kgDORdh4IA` | GraphQL node id of that repository. |
| `category` | `Announcements` | Category for new threads. Announcements restricts creation to maintainers and giscus. |
| `categoryId` | — | Required. `DIC_…` id from the step above. |
| `mapping` | `pathname` | One thread per documentation URL. |
| `strict` | `0` | Set to `1` only if existing threads contain the SHA-1 of their title. |
| `themes.light` / `themes.dark` | `light` / `dark` | Any giscus theme name or an HTTPS URL to a custom giscus theme stylesheet. |
| `excludedPaths` | `/`, `/README` | Paths without comments. A trailing `/*` matches every path under that prefix. |
| `heading`, `intro` | `Comments`, … | Visible copy above the thread. |

## How it works

- **Mount point.** The section is appended to the end of the Atlas article
  (`.dai-article`), which keeps it below the prose and above the previous/next
  navigation. If the article is not rendered yet, the script retries for a few
  seconds.
- **Client-side navigation.** Documentation.AI swaps MDX content without a full page
  load, so the script patches `history.pushState`/`replaceState`, listens for
  `popstate`, and watches the DOM. On a route change it unmounts the old thread,
  waits for the article content to actually change, then mounts the new one. Only one
  widget can exist at a time.
- **Theme sync.** giscus is loaded with the current site theme and receives a
  `setConfig` message (to `https://giscus.app`) when the reader toggles light/dark
  mode or the OS preference changes.
- **SEO and accessibility.** The section is a labelled `<section>` with an `<h2>`,
  uses the conventional `#comments` anchor when free, and includes a `<noscript>`
  fallback.

## Styling

`styles/giscus.css` reuses the site tokens from `styles/custom.css`
(`--brand`, `--heading`, `--body`, `--tb-radius`) and adapts to the `.dark` class.

The thread itself is a cross-origin iframe served by giscus, so page CSS cannot
restyle its internals. To change colours inside the thread, point
`CONFIG.themes.light` / `CONFIG.themes.dark` at a giscus theme name (for example
`noborder_light`, `noborder_dark`, `transparent_dark`) or at a hosted custom giscus
theme stylesheet, as described in the
[giscus theme docs](https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md#data-theme).

## Verify a deployment

1. Publish the site and open a documentation page (not the home page).
2. Confirm the **Comments** heading and the giscus iframe render below the article.
3. Toggle the site theme; the thread should switch between light and dark.
4. Navigate to another page and back; exactly one thread should render per page.
5. Sign in with GitHub and post a test comment, then delete it (or the discussion)
   in GitHub Discussions.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Nothing renders, console shows the setup hint | Enable Discussions, install the giscus app, and set `CONFIG.categoryId`. |
| Iframe shows “giscus is not installed on this repository” | Install <https://github.com/apps/giscus> for `TechnoBureau/docs`. |
| Iframe shows “Discussion not found” after renaming pages | The `pathname` mapping follows URLs. Rename the discussion title or keep the old URL. |
| Comments do not update after navigating | Hard refresh once; confirm `scripts/giscus.js` is listed in `documentation.json`. |
| Widget appears on the home page | Add its path to `CONFIG.excludedPaths`. |
| Styles missing | Confirm `styles/giscus.css` is in the `customCss` array and the file is under 1 MB. |
