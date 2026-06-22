import { cn } from "./cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm border border-sandy-shore-dark/30 p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <div className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: CardProps) {
  return (
    <h3
      className={cn("text-xl font-heading text-clear-water", className)}
      style={{ fontFamily: "'Collier', Georgia, 'Times New Roman', serif" }}
      {...props}
    >
      {children}
    </h3>
  );
}
