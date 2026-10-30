// Background alerts need the installed phone app; browsers can't run them when closed.
export async function enableAlerts(): Promise<boolean> {
  return false;
}

export async function disableAlerts(): Promise<void> {}
