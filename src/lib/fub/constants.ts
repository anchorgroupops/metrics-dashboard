/**
 * Tenant-specific FUB constants for The Anchor Group.
 *
 * Zillow Preferred leads surface in this FUB instance as "Premier Agent"
 * (Zillow's product name) and "Zillow". Stage ids are empirically observed and
 * are tenant-specific — adjust here (or via env at the call site) if the FUB
 * stage list changes.
 */

export const ZILLOW_SOURCE_ID = 15;
export const ZILLOW_SOURCE_NAMES = ["premier agent", "zillow"] as const;

export const STAGE_NEW = 26;
export const APPT_STAGE_IDS = [29, 30] as const;
