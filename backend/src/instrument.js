// Sentry must be initialized before anything else in the app — this file
// exists specifically so it can be required first, before Express, routes,
// or any other code that might throw an error we want Sentry to catch.
require("dotenv").config();
const Sentry = require("@sentry/node");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
  });
} else {
  console.log("ℹ️  SENTRY_DSN not set — error monitoring is disabled. Add it to .env to enable.");
}
