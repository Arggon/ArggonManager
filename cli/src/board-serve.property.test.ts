/**
 * Property: bounded UTF-8 detail clipping never splits a code point, respects
 * the byte cap, and preserves valid text.
 *
 * Under test: `clipDetailText` in `cli/src/board-serve.ts` — the serve-mode
 * detail drawer's clipper, the ONLY byte-capped clipper in the product
 * (`MAX_DETAIL_PROSE_BYTES` / `MAX_DETAIL_COMMENT_BYTES`). It lives in the CLI
 * adapter, not in `lib/src`, because the kernel's own bound
 * (`sanitizeHumanValue` / `clipHumanValue`, `MAX_HUMAN_VALUE_CHARS`) caps
 * CHARACTERS, not bytes, and the plugin's `boundedNativeText` caps characters
 * too — so a byte-cap property can only be expressed here, against the real
 * helper rather than a re-implementation of it.
 *
 * INVARIANTS (asserted per generated run):
 *   1. PREFIX: the result is a whole-CODE-POINT prefix of the input, so no code
 *      point is ever split (a split would leave a lone surrogate, which cannot
 *      survive a UTF-8 round trip).
 *   2. BYTE CAP: the result is at most `maxBytes` UTF-8 bytes.
 *   3. VERDICT: `truncated` is true exactly when the input exceeds the cap, and
 *      text that already fits is returned byte-identical (valid text preserved).
 *   4. MAXIMALITY: when the clip is truncated, adding the next code point would
 *      exceed the cap — the clip never drops text it could have kept.
 *   5. IDEMPOTENCE: re-clipping an already-clipped text keeps it byte-identical.
 *
 * The generator emits well-formed text (code points, never a lone surrogate),
 * which is what a UTF-8 file can hold; a lone surrogate is not representable
 * input for this helper. Representative multibyte input is the point: the atom
 * table carries 1-, 2-, 3- and 4-byte code points, combining marks, and the
 * control code points a hostile value could carry.
 */
import { describe, expect, it } from "vitest";
import { clipDetailText, MAX_DETAIL_COMMENT_BYTES, MAX_DETAIL_PROSE_BYTES } from "./board-serve.js";
import { fc, checkProperty } from "../../test/property-runner.js";

/** One code point per atom, across every UTF-8 length the clipper must handle. */
const CODE_POINT_ATOMS: readonly string[] = [
  // 1 byte
  "a",
  "Z",
  "0",
  " ",
  "\n",
  "\t",
  "~",
  // 2 bytes (Latin-1 supplement)
  "é",
  "ü",
  "ß",
  "±",
  // 3 bytes (Latin Extended / punctuation / CJK)
  "ā",
  "€",
  "—",
  "日",
  "本",
  "語",
  // 4 bytes (astral)
  "\u{1f600}",
  "\u{1f389}",
  "\u{10ffff}",
  // combining marks (multi-code-point graphemes: a code-point-safe clipper must
  // not try to be grapheme-safe, and must not break UTF-8 doing so)
  "́",
  "‍",
];

const codePoints = fc
  .array(fc.constantFrom(...CODE_POINT_ATOMS), { maxLength: 24 })
  .map((atoms) => atoms.join(""));

const byteLength = (text: string): number => Buffer.byteLength(text, "utf8");

/**
 * True when `value` carries a UTF-16 code unit that is not half of a valid
 * pair — i.e. a code point the clipper SPLIT. (A plain `/[\uD800-\uDFFF]/`
 * would also match a well-formed astral pair, so the pairing is checked.)
 */
function hasLoneSurrogate(value: string): boolean {
  for (let at = 0; at < value.length; at++) {
    const unit = value.charCodeAt(at);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(at + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      at++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

const cap = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: 0, max: 64 }) },
  { weight: 1, arbitrary: fc.constantFrom(MAX_DETAIL_COMMENT_BYTES, MAX_DETAIL_PROSE_BYTES) },
);

describe("clipDetailText (property)", () => {
  it("clips at a code-point boundary inside the byte cap, maximally", () => {
    checkProperty(
      "utf-8 detail clip",
      fc.property(codePoints, cap, (text, maxBytes) => {
        const out = clipDetailText(text, maxBytes);
        const inputCodePoints = [...text];
        const outCodePoints = [...out.text];

        // (1) PREFIX: whole code points only, in order.
        expect(outCodePoints).toEqual(inputCodePoints.slice(0, outCodePoints.length));
        expect(hasLoneSurrogate(out.text)).toBe(false);
        expect(Buffer.from(out.text, "utf8").toString("utf8")).toBe(out.text);
        // (2) BYTE CAP.
        expect(byteLength(out.text)).toBeLessThanOrEqual(maxBytes);
        // (3) VERDICT + text preservation.
        expect(out.truncated).toBe(byteLength(text) > maxBytes);
        if (!out.truncated) expect(out.text).toBe(text);
        // (4) MAXIMALITY: one more code point would not have fit.
        if (out.truncated && maxBytes >= 4) {
          const next = inputCodePoints[outCodePoints.length];
          expect(next).toBeDefined();
          expect(byteLength(out.text + next!)).toBeGreaterThan(maxBytes);
        }
        // (5) IDEMPOTENCE: re-clipping the result keeps the same text (the
        // `truncated` flag resets, because the clipped text now fits the cap).
        expect(clipDetailText(out.text, maxBytes).text).toBe(out.text);
      }),
    );
  });

  it("keeps the production caps honest on long multibyte prose", () => {
    checkProperty(
      "utf-8 detail clip production caps",
      fc.property(codePoints, (prose) => {
        // A body-sized value: mixed-width code points plus an ASCII run, so the
        // corpus always exceeds both production caps whatever `prose` is.
        const body = `${prose}${"a".repeat(64)}`.repeat(200);
        const bodyCodePoints = [...body];
        expect(byteLength(body)).toBeGreaterThan(MAX_DETAIL_PROSE_BYTES);
        for (const capBytes of [MAX_DETAIL_PROSE_BYTES, MAX_DETAIL_COMMENT_BYTES]) {
          const out = clipDetailText(body, capBytes);
          // (2) The production byte cap holds …
          expect(byteLength(out.text)).toBeLessThanOrEqual(capBytes);
          expect(out.truncated).toBe(true);
          // (1) … on a code-point boundary …
          const kept = [...out.text];
          expect(kept).toEqual(bodyCodePoints.slice(0, kept.length));
          expect(hasLoneSurrogate(out.text)).toBe(false);
          // (4) … maximally (one more code point would not fit) …
          expect(byteLength(out.text + bodyCodePoints[kept.length]!)).toBeGreaterThan(capBytes);
          // (3) … and text that exactly fits is preserved byte for byte.
          const atCap = kept.slice(0, -1).join("");
          expect(clipDetailText(atCap, byteLength(atCap))).toEqual({ text: atCap, truncated: false });
        }
      }),
    );
  });
});
