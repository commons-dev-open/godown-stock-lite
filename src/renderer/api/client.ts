export function getElectron(): Window["electron"] {
  if (typeof window !== "undefined" && window.electron) return window.electron;
  throw new Error("Electron API not available");
}
