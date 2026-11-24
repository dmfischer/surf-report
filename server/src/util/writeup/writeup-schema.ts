import { z } from "zod";
import { Writeup } from "../../model/writeup";

// The shape the model must reply with, as a Zod schema. The SDK turns it into a JSON schema for the
// API (structured outputs: the model can only produce JSON that fits it), and checks the reply against
// it again when it arrives, giving us a typed object instead of text to parse.
//
// Each .describe() becomes the field's description in the JSON schema, so the model reads it.
//
// Deliberately no .max(3) on bestBets: the API can't enforce maxItems (the SDK only turns it into a
// hint in the description), and Zod would then reject the whole reply over one extra best bet.
// Validation trims it instead (util/writeup/writeup-validation.ts).
export const WriteupSchema = z.object({
    headline: z.string().describe("One sentence on the whole week, including any flat stretches."),
    days: z
        .array(
            z.object({
                // format "date" only (not z.iso.date(), whose leap-year regex the API can't use, so the
                // SDK would paste it into the description). The API enforces the format; validation
                // then checks the date is one of the summary's.
                date: z.string().meta({ format: "date" }).describe("Local date from the summary, YYYY-MM-DD."),
                summary: z.string().describe("One to three sentences on that day."),
                bestBets: z
                    .array(
                        z.object({
                            spotId: z.string().describe("Exact spot id from the summary."),
                            block: z.enum(["dawn", "morning", "afternoon", "evening"]),
                        }),
                    )
                    .describe("Spot and block combinations rated fair or good that day, best first, at most 3."),
            }),
        )
        .describe("Only days with at least one block rated fair or good, in date order."),
    caveats: z.array(z.string()).describe("Limits of the data behind this outlook; empty if none."),
});

// Compile-time check that the schema and model/writeup.ts describe the same shape. If either one
// changes without the other, `npx tsc --noEmit` fails on one of these two lines. (Nothing runs: a
// function that's never called costs nothing.)
// - fromSchema: anything the schema accepts is a valid Writeup.
// - toSchema: every Writeup would be accepted by the schema.
function fromSchema(parsed: z.infer<typeof WriteupSchema>): Writeup { return parsed; }
function toSchema(writeup: Writeup): z.infer<typeof WriteupSchema> { return writeup; }
void fromSchema;
void toSchema;
