# ericrayanderson.com

Personal website for Eric Anderson. Static HTML, CSS, and JavaScript. There is no build step.

## Preview locally

From the repository root:

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

Any static file server works the same way. Opening `index.html` directly in a browser also works, because the pages use relative links.

## Pages

| File | Page |
| --- | --- |
| `index.html` | Home |
| `games.html` | Games |
| `helicopter.html` | Helicopter |
| `putt.html` | Mini putt |
| `about.html` | About |
| `projects.html` | Projects |
| `contact.html` | Contact |
| `404.html` | Unknown paths on GitHub Pages |

Shared files:

- `assets/css/site.css` — layout, type, light and dark themes
- `assets/js/site.js` — theme toggle, header clock, small-screen menu, and the game dialog
- `assets/js/helicopter.js` — cave flyer
- `assets/js/putt.js` — top-view mini putt
- `assets/fonts/` — self-hosted Fraunces and Source Sans 3 (SIL Open Font License)
- `CNAME` — custom domain for GitHub Pages
- `.nojekyll` — tells GitHub Pages to serve the files as-is

The theme follows the system setting until a visitor chooses light or dark. That choice is stored in `localStorage` under the key `theme`.

The header shows the local date and time, including seconds.

From Home and Games, Helicopter and Mini putt open in a dialog on the page. Closing it, with the button or Escape, stops that game. `helicopter.html` and `putt.html` still run the same games on their own, including when the link is opened in a new tab.

## What to edit

Copy stays inside what is already public: Wake Forest, North Carolina, the old one-line introduction, Learning Games, and the CRAN packages shinymaterial and shinyglass. Placeholders are marked on the page with a Placeholder label, and in the HTML with `class="slot"`.

- About: replace the biography slot with Eric’s own words.
- Games: Helicopter and mini putt are playable in the browser. One placeholder on that page is reserved for a future extra.
- Projects: Learning Games is described, with a comment where a demo or source link should go.
- Contact: `eric.ray.anderson@gmail.com`, already public on GitHub and CRAN.

## Publish with GitHub Pages

The site is meant to be published from the root of `main`.

1. On GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch `main` and folder `/ (root)`, then save.
4. After the first deploy, set **Custom domain** to `ericrayanderson.com`. The root `CNAME` file already contains that name. Keep a single `CNAME`; it should be exactly:

   ```
   ericrayanderson.com
   ```

5. When the DNS check succeeds, turn on **Enforce HTTPS**.

GitHub Pages from a **private** repository needs GitHub Pro, GitHub Team, GitHub Enterprise Cloud, or GitHub Enterprise Server. On GitHub Free, Pages is available for public repositories. This site only includes information that is already public.

Until the custom domain is attached, a project site is served at:

`https://ericrayanderson.github.io/ericrayanderson.com/`

Links are relative, so that path and `https://ericrayanderson.com/` both work.

### Point ericrayanderson.com at GitHub Pages

Add the custom domain in the repository **before** changing DNS. Verify the domain on GitHub as well, so another project cannot claim it. GitHub’s notes:

- [Managing a custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Verifying your custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)

The domain has been serving other hosting. Replace those records when you are ready for this site to go live. Do not leave the old website host in place alongside these records.

**Apex domain** (`ericrayanderson.com`). Add all four `A` records, and the `AAAA` records if you want IPv6:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

Some DNS hosts use an `ALIAS` or `ANAME` record instead of `A`/`AAAA`. In that case, point `@` at `ericrayanderson.github.io`.

**www.** Add one `CNAME` so `www.ericrayanderson.com` redirects to the apex (GitHub does this when the `CNAME` file names the apex):

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `www` | `ericrayanderson.github.io` |

Point `www` at `ericrayanderson.github.io`, not at the project path and not at a `*.pages.github.io` host. Avoid wildcard DNS such as `*.ericrayanderson.com`.

Check the apex after DNS propagates:

```bash
dig ericrayanderson.com +noall +answer -t A
dig www.ericrayanderson.com +nostats +nocomments +nocmd
```

The `A` answers should be the four GitHub Pages addresses above. The `www` answer should be a `CNAME` to `ericrayanderson.github.io`.
