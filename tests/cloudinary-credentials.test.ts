import { describe, expect, it } from "vitest";

describe("Cloudinary credential configuration", () => {
  it("authenticates to the lightweight media listing endpoint", async () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    expect(cloudName, "CLOUDINARY_CLOUD_NAME is required").toBeTruthy();
    expect(apiKey, "CLOUDINARY_API_KEY is required").toBeTruthy();
    expect(apiSecret, "CLOUDINARY_API_SECRET is required").toBeTruthy();

    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName!)}/resources/image?max_results=1`,
      { headers: { Authorization: `Basic ${credentials}` } },
    );

    expect(response.ok, `Cloudinary credential check failed with ${response.status}`).toBe(true);
  }, 15_000);
});
