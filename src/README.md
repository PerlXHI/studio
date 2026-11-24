# Frontend source

Nunjucks templates and their source assets live here.

- `pages/`: one entry template per public page.
- `layouts/`: shared page shells and template inheritance.
- `components/`: reusable page sections and interface components.
- `styles/`: extracted stylesheets.
- `scripts/`: extracted browser-side JavaScript.

During migration, the build script falls back to the existing root HTML pages. A page is replaced in `dist/` only when its matching Nunjucks entry template exists. This allows incremental migration without deleting the working legacy pages.
