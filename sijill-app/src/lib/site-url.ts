/**
 * Use the deployed canonical URL for authentication emails, including when
 * an account is created from a local development copy of the site.
 */
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const SITE_URL = (
  configuredSiteUrl?.startsWith("https://")
    ? configuredSiteUrl
    : "https://sijill-flame.vercel.app"
).replace(/\/$/, "");
