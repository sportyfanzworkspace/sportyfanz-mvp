/**
 * Legacy reward redemption endpoint.
 *
 * Delegate to the canonical redemption handler so both
 * routes share the same authentication, accounting locks,
 * validation, ledger entries and notifications.
 */
import { POST as redeemReward } from "../rewards/redeem/route";

export async function POST(request: Request) {
  return redeemReward(request);
}
