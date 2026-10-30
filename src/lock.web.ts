// The fingerprint / PIN lock needs the installed phone app.
export async function canLock(): Promise<boolean> {
  return false;
}

export async function authenticate(): Promise<boolean> {
  return true;
}
