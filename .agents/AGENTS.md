# My Health Memoir - Agent Rules

## 1. Version Control & Tracking
- **Version Bumping**: With every update or significant feature implementation, you MUST update the `APP_VERSION` string in `src/config/version.ts` (e.g., from `v1.2.1` to `v1.2.2`).
- **Update Tracking**: Maintain a proper track record of all changes. Make sure to log what was done so it is easy to understand the history of the project's evolution.

## 2. Strict Mobile Optimization
- **Mobile First**: Every single UI change or new feature MUST be fully mobile-optimized. 
- **Layout Checks**: Always ensure elements wrap correctly on small screens, inputs do not cause auto-zoom, and no elements overflow the screen width to cause horizontal scrolling or clipping of other UI elements.

## 3. Mandatory Deployment Protocol
- **Dual Deployment**: GitHub Actions for Firebase auto-deployment is disabled. Therefore, every time work is completed and verified, you MUST push it to BOTH:
  1. **GitHub**: `git add .`, `git commit -m "..."`, and `git push origin master`
  2. **Firebase**: `npm run build` and `firebase deploy --only hosting`
- **Visibility**: This ensures the user and everyone else can immediately see the updated version online at the live URL.
