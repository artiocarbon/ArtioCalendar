import { describe, expect, it } from "vitest";

import { getDefaultEvent } from "./defaultEvents";

describe("dynamic default event locations", () => {
  it("uses fixed location order without hardcoded credentialId", () => {
    const event = getDefaultEvent("non-existent-dynamic-slug");

    expect(event.locations).toEqual([
      { type: "integrations:google:meet" },
      { type: "attendeeInPerson", customLabel: "Suggest a Location" },
      { type: "inPerson", address: "Lloyds of London", displayLocationPublicly: true },
    ]);
  });
});
