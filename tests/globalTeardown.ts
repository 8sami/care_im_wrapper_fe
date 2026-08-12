import { execFileSync } from "child_process";

/**
 * Deletes every event the suite created against the seeded trigger.
 *
 * This is a safety step, not tidiness. Dispatching only queues a Celery task, so with the
 * worker stopped (which is how the suite must be run) the recipients these tests create stay
 * at `latest_status = null` forever. The backend's periodic sweep,
 * `dispatch_pending_notification_recipients`, picks up every such recipient regardless of
 * facility — so leaving them behind means real WhatsApp messages go out to the fixture
 * patients, whose numbers are real, as soon as the worker is started again.
 *
 * care_fe's own suite shells out to a script for database work (scripts/playwright-db.sh), so
 * reaching for the backend container here follows the same precedent.
 */
async function globalTeardown() {
  const container = process.env.CARE_BACKEND_CONTAINER || "care-backend-1";

  try {
    execFileSync(
      "docker",
      [
        "exec",
        container,
        "python",
        "manage.py",
        "seed_notification_test_data",
        "--reset",
      ],
      { stdio: "pipe", timeout: 60000, encoding: "utf-8" },
    );
    console.log("✅ Cleared notification events created by the suite");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      [
        "",
        "⚠️  COULD NOT CLEAN UP NOTIFICATION EVENTS",
        `    ${message}`,
        "",
        "    Events created by this run still have undelivered recipients. Starting the",
        "    Celery worker will send them as real messages within ~2 minutes.",
        "    Run this before starting the worker:",
        `      docker exec ${container} python manage.py seed_notification_test_data --reset`,
        "",
      ].join("\n"),
    );
  }
}

export default globalTeardown;
