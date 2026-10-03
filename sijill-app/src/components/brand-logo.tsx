import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  /** Keep the white mark on pages that always use a dark background. */
  tone?: "adaptive" | "white";
};

export function BrandLogo({ className = "", priority = false, tone = "adaptive" }: BrandLogoProps) {
  const color = tone === "white" ? "brightness-0 invert" : "brightness-0 dark:invert";

  return (
    <Image
      src="/logo.png"
      alt="سِجِلّ"
      width={512}
      height={512}
      priority={priority}
      className={`object-contain ${color} ${className}`}
    />
  );
}
