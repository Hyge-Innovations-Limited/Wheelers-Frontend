/**
 * Lets the Wheelers app use passkeys for wheelersng.com on iPhone: Apple reads
 * this file (served at /.well-known/apple-app-site-association, see
 * next.config.ts) before the app may make or use one. Team ID and bundle ids
 * are the App Store app's; they are public, not secrets.
 */
const APPLE_TEAM_ID = "N3F7PRGY83";
const IOS_APPS = ["com.timmy133.wheelers.driver", "com.timmy133.wheelers"];

export const dynamic = "force-static";

export function GET() {
  return Response.json(
    { webcredentials: { apps: IOS_APPS.map((bundle) => `${APPLE_TEAM_ID}.${bundle}`) } },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
