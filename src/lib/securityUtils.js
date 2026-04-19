export const INCIDENT_TYPES = {
  fire_alarm: { label: "Fire Alarm", icon: "Flame", color: "red" },
  medical: { label: "Medical", icon: "Heart", color: "red" },
  panic: { label: "Panic", icon: "AlertTriangle", color: "red" },
  intrusion: { label: "Intrusion", icon: "ShieldAlert", color: "orange" },
  unattended_bag: { label: "Unattended Bag", icon: "Package", color: "orange" },
  theft: { label: "Theft", icon: "Ban", color: "yellow" },
  vandalism: { label: "Vandalism", icon: "Hammer", color: "yellow" },
  suspicious_behavior: { label: "Suspicious Behavior", icon: "Eye", color: "yellow" },
  access_violation: { label: "Access Violation", icon: "Lock", color: "blue" },
  other: { label: "Other", icon: "HelpCircle", color: "blue" },
};

export const STATUS_CONFIG = {
  active: { label: "Active", color: "red", dot: true },
  responding: { label: "Responding", color: "orange", dot: true },
  contained: { label: "Contained", color: "yellow", dot: false },
  resolved: { label: "Resolved", color: "green", dot: false },
  false_alarm: { label: "False Alarm", color: "blue", dot: false },
};

export const SEVERITY_COLORS = {
  critical: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
  high: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30" },
  medium: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" },
  low: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30" },
};

export function getSeverityLevel(score) {
  if (score >= 8) return "critical";
  if (score >= 6) return "high";
  if (score >= 4) return "medium";
  return "low";
}

export function getSeverityColor(score) {
  return SEVERITY_COLORS[getSeverityLevel(score)];
}

export const AIRPORT_CENTER = [1.3644, 103.9915]; // Singapore Changi Airport
export const AIRPORT_ZONES = [
  { name: "Terminal 1 - Gate 12", lat: 1.3610, lng: 103.9900 },
  { name: "Terminal 1 - Departure", lat: 1.3615, lng: 103.9905 },
  { name: "Terminal 2 - Food Court", lat: 1.3640, lng: 103.9915 },
  { name: "Terminal 2 - Baggage Claim", lat: 1.3650, lng: 103.9920 },
  { name: "Terminal 2 - Departure", lat: 1.3645, lng: 103.9925 },
  { name: "Terminal 3 - Parking", lat: 1.3660, lng: 103.9930 },
  { name: "Terminal 3 - Departure", lat: 1.3665, lng: 103.9935 },
  { name: "Concourse A", lat: 1.3620, lng: 103.9890 },
  { name: "Concourse B", lat: 1.3650, lng: 103.9920 },
  { name: "Security Checkpoint A", lat: 1.3620, lng: 103.9890 },
  { name: "Control Tower", lat: 1.3600, lng: 103.9880 },
  { name: "Runway 1", lat: 1.3700, lng: 103.9950 },
  { name: "Runway 2", lat: 1.3450, lng: 103.9700 },
  { name: "Control Tower", lat: 1.3580, lng: 103.9810 },
];