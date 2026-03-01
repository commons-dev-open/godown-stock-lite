/**
 * Flag set when ledger data (lends/deposits) is mutated, so the Mahajans list
 * can show "updates available" on the Fetch latest button after navigation.
 */
let ledgerUpdatesAvailable = false;

export function getLedgerUpdatesAvailable(): boolean {
  return ledgerUpdatesAvailable;
}

export function setLedgerUpdatesAvailable(value: boolean): void {
  ledgerUpdatesAvailable = value;
}
