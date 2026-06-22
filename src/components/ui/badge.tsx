import { cn } from "./cn";

type BadgeVariant = "green" | "yellow" | "red" | "neutral" | "teal";

const variantStyles: Record<BadgeVariant, string> = {
  green: "bg-status-green/15 text-green-800 border-status-green/30",
  yellow: "bg-status-yellow/15 text-yellow-800 border-status-yellow/30",
  red: "bg-status-red/15 text-red-800 border-status-red/30",
  neutral: "bg-sandy-shore-mid text-gray-700 border-sandy-shore-dark/30",
  teal: "bg-pearl-aqua/15 text-clear-water border-pearl-aqua/30",
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
