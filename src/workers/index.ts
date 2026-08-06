/**
 * Background worker entry point.
 * Runs on Railway in production; locally via `npm run worker:dev`.
 *
 * Processes BullMQ jobs: agent runs, document export, webhook retries.
 */
async function main() {
  console.log("[worker] Erasmus AI background worker starting...");
  console.log("[worker] Environment:", process.env.NODE_ENV);
  console.log("[worker] Redis:", process.env.REDIS_URL ? "configured" : "missing");

  // Job queue processors will be registered here in Phase 2-3
  console.log("[worker] Waiting for job processors (Phase 2)...");

  process.on("SIGTERM", () => {
    console.log("[worker] Shutting down gracefully...");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
