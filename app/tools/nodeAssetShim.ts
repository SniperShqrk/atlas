/**
 * `require('*.jpg')` in artworkAssets.ts is Metro's asset syntax — Metro
 * special-cases it into a bundled image reference at build time. Plain
 * Node/tsx has no such loader, so any tool script that imports
 * `src/share/artwork.ts` (which imports artworkAssets.ts) needs a stand-in
 * for image extensions or the `require` throws trying to parse JPEG bytes
 * as JavaScript.
 *
 * Every tool that hits this path only checks `artworkImage(id) != null` —
 * none of them read actual pixel data through the RN require object (Metro's
 * require also returns an asset descriptor, not raw bytes) — so a truthy
 * dummy object is a faithful stand-in. Import this file before anything that
 * transitively imports artwork.ts.
 */
for (const ext of ['.jpg', '.jpeg', '.png']) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require as any).extensions[ext] = (mod: NodeModule) => {
    mod.exports = { uri: 'node-shim-asset' };
  };
}
