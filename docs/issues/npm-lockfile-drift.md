# npm ci Lockfile Drift

If `npm ci` fails during updates due to lockfile drift:

- Keep `package-lock.json` in the repo.
- Refresh it from your source clone:

```bash
npm install
git add package-lock.json
git commit -m "chore: refresh lockfile"
git push
```

The update script already falls back to `npm install` if `npm ci` fails or `package-lock.json` is missing.