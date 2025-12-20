---
'@config-store/core': minor
---

Removed react from core dependencies, locked zod peerDependency at ^4.0.0. Updated pnpm to 10.26.0. Fix package.json imports. Make store public on ConfigManager. In save method, any error other than conflict will reject. Fix test scripts. Fix tsconfig and turbo tasks.
