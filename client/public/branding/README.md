# SKANS branding files

| File | Used for |
|---|---|
| `skans-logo.jpg` | Printed papers (white background): top right on the SKANS CAF Examination format, top left on the SKANS Internal Test format |
| `skans-logo-dark.jpg` | The web application (sidebar and sign-in page) |

Artwork supplied by SKANS School System. To replace it, overwrite the files with the same names
(for printing, `skans-logo.png` or `.svg` is also accepted; the first of .png, .jpg, .jpeg, .svg
found is used). Use high-resolution artwork (at least 1200 px wide). Changes are picked up
immediately; check with `npm run pdf:samples -w server`.

Only SKANS artwork is used. No examining-body marks are printed on SKANS papers.

Back up this folder together with the database (`npm run db:backup` does this).
