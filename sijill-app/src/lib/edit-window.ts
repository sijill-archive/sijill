const EDIT_WINDOW_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

export function editDeadline(publishedAt: string | null | undefined, createdAt: string): Date {
  const base = new Date(publishedAt ?? createdAt);
  return new Date(base.getTime() + EDIT_WINDOW_DAYS * DAY_MS);
}

export function hasEditWindowExpired(
  status: string,
  publishedAt: string | null | undefined,
  createdAt: string,
  now = Date.now(),
): boolean {
  const publicationDate = publishedAt ?? (status === "published" || status === "archived" ? createdAt : null);
  return publicationDate !== null && now > editDeadline(publicationDate, createdAt).getTime();
}

export function canEditContribution(
  status: string,
  publishedAt: string | null | undefined,
  createdAt: string,
  now = Date.now(),
): boolean {
  return !hasEditWindowExpired(status, publishedAt, createdAt, now);
}
