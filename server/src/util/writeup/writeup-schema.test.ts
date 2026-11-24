import { readFileSync } from "node:fs";
import path from "node:path";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describe, expect, it } from "vitest";
import { WriteupSchema } from "./writeup-schema";

const valid = {
    headline: "Flat until Friday.",
    days: [
        {
            date: "2026-11-27",
            summary: "Clean southeast swell.",
            bestBets: [{ spotId: "point-judith", block: "afternoon" }],
        },
    ],
    caveats: [],
};

describe("WriteupSchema", () => {
    it("accepts a valid write-up", () => {
        expect(WriteupSchema.safeParse(valid).success).toBe(true);
    });

    it("accepts the example write-up the client is developed against", () => {
        const file = path.join(__dirname, "..", "..", "..", "fixtures", "example-writeup.json");
        const example = JSON.parse(readFileSync(file, "utf8"));
        expect(WriteupSchema.safeParse(example.writeup).success).toBe(true);
    });

    it("accepts a week with no days (flat all week)", () => {
        expect(WriteupSchema.safeParse({ ...valid, days: [] }).success).toBe(true);
    });

    it("rejects an unknown block", () => {
        const bad = { ...valid, days: [{ ...valid.days[0], bestBets: [{ spotId: "x", block: "night" }] }] };
        expect(WriteupSchema.safeParse(bad).success).toBe(false);
    });

    it("rejects a missing field", () => {
        const { caveats: _caveats, ...bad } = valid;
        expect(WriteupSchema.safeParse(bad).success).toBe(false);
    });
});

describe("the JSON schema sent to the API", () => {
    const schema = JSON.stringify(zodOutputFormat(WriteupSchema));

    it("keeps the date format and the block enum as real constraints", () => {
        expect(schema).toContain('"format":"date"');
        expect(schema).toContain('"enum":["dawn","morning","afternoon","evening"]');
    });

    it("leaves no unsupported constraints pasted into descriptions", () => {
        // The SDK moves constraints the API can't enforce into the description as "{key: value}".
        expect(schema).not.toMatch(/\{(pattern|maxItems|minLength|maxLength):/);
    });

    it("forbids extra fields", () => {
        expect(schema).toContain('"additionalProperties":false');
    });
});
