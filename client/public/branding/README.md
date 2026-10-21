# Authorised branding files

Papers print a logo **only** when an authorised file is present in this folder, or in the folder
set by `BRANDING_DIR` in `server/.env`. The application ships without any logo.

| File name (first match wins: .png, .jpg, .jpeg, .svg) | Used by | Printed where |
|---|---|---|
| `skans-logo.png` | Templates whose header logo is `skans` (SKANS Internal Test) | Top left of the header |
| `exam-body-logo.png` | Templates whose header logo is `exam-body` (CAF Examination Paper) | Top right of the header |

Rules:

- Add only artwork that the school administration has authorised in writing. Do **not** add the
  ICAP crest or any other examining-body mark without written permission.
- Use a high-resolution PNG (at least 600 px wide), or an SVG whose text has been converted to outlines.
- If there is no SKANS logo file, the SKANS header prints the institute name as text. If there is
  no exam-body logo, the CAF header prints no logo.
- The files are re-read whenever they change, so new artwork appears straight away. To check the
  result, generate a sample with `npm run pdf:samples -w server`.
- Back up this folder together with the database.
