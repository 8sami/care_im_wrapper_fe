import { execFileSync } from "child_process";

/**
 * Creates a notification event for the dispatch tests.
 *
 * Events are only ever created by backend signal handlers, each needing its own domain
 * object to fire, so there is no API to POST one to. The backend's
 * `seed_notification_test_data --create-event` makes one directly and prints its id; this
 * shells into the container for it, the same way globalTeardown clears them again.
 *
 * `withRecipient: false` produces an event with nothing to send, which is how the
 * "nothing pending" states are reached.
 */
export function seedEvent(
  title: string,
  facilityId: string,
  { withRecipient = true }: { withRecipient?: boolean } = {},
): string {
  const container = process.env.CARE_BACKEND_CONTAINER || "care-backend-1";
  const args = [
    "exec",
    container,
    "python",
    "manage.py",
    "seed_notification_test_data",
    "--create-event",
    title,
    "--facility",
    facilityId,
  ];
  if (!withRecipient) args.push("--no-recipient");

  let stdout: string;
  try {
    stdout = execFileSync("docker", args, {
      stdio: "pipe",
      timeout: 60000,
      encoding: "utf-8",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not seed a notification event: ${message}`);
  }

  // The command writes its progress to stderr, so stdout holds the id alone.
  const eventId = stdout.trim().split("\n").pop()?.trim() ?? "";
  if (!eventId) {
    throw new Error(`Seeding printed no event id (stdout: ${stdout})`);
  }
  return eventId;
}
