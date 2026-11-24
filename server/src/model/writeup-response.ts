import { Writeup } from "./writeup";

// What GET /api/writeup returns. It's a "discriminated union": either of two shapes, told apart by
// the `status` field. After `if (response.status === "ok")`, TypeScript knows writeup etc. exist;
// in the else branch it knows there's only a message. That's safer than one shape with nullable
// fields, where nothing stops code from reading writeup when there isn't one.
//
// "Not available yet" is a normal answer (200), like status "unknown_zip" in ConditionsResponse:
// right after a first start, or if generation failed, there's simply no write-up to show.
export type WriteupResponse =
    | {
          status: "ok";
          region: string;
          // ISO 8601 UTC instant it was generated. The client should show it ("Written Mon 12:00 PM"),
          // because the forecasts behind it can move on during the hours between refreshes.
          generatedAt: string;
          writeup: Writeup;
      }
    | {
          status: "not_available";
          message: string;
      };
