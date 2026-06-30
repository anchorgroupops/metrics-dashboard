/**
 * Anchor Team brand palette + typography — single source of truth for the
 * dashboard, mirroring `config/settings.py::BRAND` in the pipeline repo.
 * Clear Water teal primary, Pearl Aqua accent, Sandy Shore cream background.
 */
export const BRAND = {
  color_primary: "#046568", // Clear Water — deep teal
  color_secondary: "#82C8C3", // Pearl Aqua — lighter aqua
  color_accent: "#F7ECE1", // Sandy Shore — warm cream
  color_bg: "#F7ECE1",
  color_text: "#1A1A1A",
  // Traffic-light status colors
  color_green: "#2ECC71",
  color_yellow: "#F0A500",
  color_red: "#E05C4B",
  // Tier accents
  color_elite: "#046568", // deepest brand tone stands in for the "ceiling"
  color_boz: "#5DC8BE",
  font_heading: "'Collier', Georgia, 'Times New Roman', serif",
  font_body: "'Dax Pro', 'Helvetica Neue', Arial, sans-serif",
} as const;
