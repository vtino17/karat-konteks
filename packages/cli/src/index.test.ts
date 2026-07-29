import { afterEach, describe, expect, it, vi } from "vitest";
import { run } from "./index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CLI entrypoint", () => {
  it("treats --help as a successful command", async () => {
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await expect(run(["--help"])).resolves.toBe(0);
    expect(stdout).toHaveBeenCalledWith(
      expect.stringContaining("HandoffSeal"),
    );
  });
});
