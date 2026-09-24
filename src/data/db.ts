// Type-level entry point. Metro resolves db.native.ts (iOS/Android) or
// db.web.ts (browser) before this file.
export { createDatabase } from './db.native';
