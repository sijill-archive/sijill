export function editDeadline(createdAt: string): Date {
  const deadline = new Date(createdAt);
  const originalDay = deadline.getUTCDate();
  deadline.setUTCDate(1);
  deadline.setUTCMonth(deadline.getUTCMonth() + 1);
  const finalDay = new Date(Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth() + 1, 0)).getUTCDate();
  deadline.setUTCDate(Math.min(originalDay, finalDay));
  return deadline;
}

export function canEditUntilMonth(createdAt: string, now = Date.now()): boolean {
  return now <= editDeadline(createdAt).getTime();
}
