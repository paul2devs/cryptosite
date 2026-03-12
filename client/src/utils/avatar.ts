export function generateInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (name.length >= 2) {
    return name.slice(0, 2).toUpperCase();
  }
  return name.toUpperCase().padEnd(2, name[0] || "?");
}

export function getAvatarColor(name: string): string {
  const colors = [
    "#C6A15B",
    "#FFD700",
    "#16C784",
    "#627EEA",
    "#F7931A",
    "#EA3943",
    "#00FFA3",
    "#8247E5",
    "#26A17B",
    "#F3BA2F"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
