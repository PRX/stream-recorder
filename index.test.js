import { handler } from "./index";

describe("index", () => {
  describe(".handler", () => {
    it("works", async () => {
      const res = await handler();
      expect(res).toEqual(true);
    });
  });
});
