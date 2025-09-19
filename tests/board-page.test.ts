import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveBoardChannelTarget } from "../app/[boardId]/page";

describe("resolveBoardChannelTarget", () => {
  it("prefers the default channel slug when present", () => {
    const result = resolveBoardChannelTarget({
      defaultChannel: { slug: "default" },
      fallbackChannel: null,
    });

    assert.deepStrictEqual(result, {
      type: "redirect",
      slug: "default",
    });
  });

  it("flags a blank default channel slug as invalid", () => {
    const result = resolveBoardChannelTarget({
      defaultChannel: { slug: "   " },
      fallbackChannel: null,
    });

    assert.deepStrictEqual(result, {
      type: "invalid",
      reason: "blank-slug",
      source: "default",
    });
  });

  it("redirects using the first channel when no default is configured", () => {
    const result = resolveBoardChannelTarget({
      defaultChannel: null,
      fallbackChannel: { slug: "alpha" },
    });

    assert.deepStrictEqual(result, {
      type: "redirect",
      slug: "alpha",
    });
  });

  it("does not treat a blank first channel slug as an empty board", () => {
    const result = resolveBoardChannelTarget({
      defaultChannel: null,
      fallbackChannel: { slug: " \t\n" },
    });

    assert.deepStrictEqual(result, {
      type: "invalid",
      reason: "blank-slug",
      source: "first",
    });
  });

  it("returns an empty-state signal only when there is no channel row", () => {
    const result = resolveBoardChannelTarget({
      defaultChannel: null,
      fallbackChannel: null,
    });

    assert.deepStrictEqual(result, { type: "empty" });
  });
});
