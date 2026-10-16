/**
 * Lets the Wheelers app use passkeys for wheelersng.com on Android: Google
 * reads this file (served at /.well-known/assetlinks.json, see next.config.ts).
 * It names the app by its package and the SHA-256 fingerprint of the key Google
 * Play signs it with (Play Console > Test and release > App integrity > App
 * signing), set in Vercel as ANDROID_CERT_SHA256 (several, comma separated).
 * Without it the list is empty and Android passkeys simply stay off.
 */
const ANDROID_PACKAGES = ["com.timmy133.wheelers.driver"];

export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));
  const statements = fingerprints.length
    ? ANDROID_PACKAGES.map((packageName) => ({
        relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
        target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints },
      }))
    : [];
  return Response.json(statements, { headers: { "cache-control": "public, max-age=3600" } });
}
