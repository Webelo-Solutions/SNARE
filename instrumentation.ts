export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startScheduleLoop } = await import("./lib/server/scheduler");
  startScheduleLoop();
}
