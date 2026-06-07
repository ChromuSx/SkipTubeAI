# Chrome Web Store Marketplace Assets

This folder is the source of truth for the Chrome Web Store listing.

## Listing URL

https://chromewebstore.google.com/detail/skiptube-ai/jinbffngeajdaalfakephodepnmpocbi

## Text

- `listing-description.md` - detailed store description, paste into the Chrome Web Store description field.
- `listing-fields.md` - name, summary, category, support URL, homepage URL, and privacy URL.
- `privacy-dashboard.md` - single purpose, permission justifications, host permission justification, and privacy policy URL.
- `video/` - Remotion source for the global promotional video.

## Images

### Screenshots

Chrome Web Store allows a maximum of 5 screenshots. These are all PNG RGB, no alpha.

- `screenshots/1-extension-settings.png` - 640 x 400
- `screenshots/2-advanced-configuration.png` - 640 x 400
- `screenshots/3-statistics-dashboard.png` - 640 x 400
- `screenshots/4-cache-viewer.png` - 1280 x 800
- `screenshots/5-whitelist-manager.png` - 640 x 400

### Promotional Images

- `promotional-images/small-promo-tile-440x280.png` - Small promotional tile, 440 x 280
- `promotional-images/featured-promo-tile-1400x560.png` - Featured promotional tile, 1400 x 560

### Promotional Video

- `promotional-video/skiptube-ai-promo.mp4` - global promotional video, upload to YouTube.
- `promotional-video/skiptube-ai-promo-thumbnail.png` - suggested YouTube thumbnail.
- `promotional-video/youtube-upload-metadata.md` - paste-ready title, description, tags, hashtags, and upload settings.
- After upload, paste the YouTube URL into the Chrome Web Store global promotional video field.

## Notes

- The public privacy policy remains `PRIVACY.md` in the repository root.
- The extension package loaded into Chrome must still come from `dist/`.
- Keep marketplace copy consistent with `src/manifest.json`, `PRIVACY.md`, and the actual permissions requested by the extension.
