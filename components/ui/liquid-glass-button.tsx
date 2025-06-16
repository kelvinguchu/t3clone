import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface LiquidGlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "default" | "compact";
  showIcon?: boolean;
  iconPosition?: "left" | "right";
  customIcon?: React.ReactNode;
  transparency?: number; // 0-100, controls overall glass transparency
  noise?: number; // 0-200, controls noise distortion strength
  color?: "purple" | "blue" | "green" | "custom"; // Color theme
  customColors?: {
    shadow?: string;
    innerGlow?: string;
    tint?: string;
    backdrop?: string;
  };
}

const LiquidGlassButton = forwardRef<HTMLButtonElement, LiquidGlassButtonProps>(
  (
    {
      children,
      className,
      variant = "default",
      showIcon = false,
      iconPosition = "left",
      customIcon,
      transparency = 15,
      noise = 85,
      color = "purple",
      customColors,
      ...props
    },
    ref,
  ) => {
    const colorThemes = {
      purple: {
        shadow: "rgba(94, 23, 235, 0.4)",
        innerGlow: "rgba(185, 164, 248, 0.8)",
        tint: `rgba(125, 62, 236, ${transparency / 100})`,
        backdrop: "rgba(94, 23, 235, 0.08)",
      },
      blue: {
        shadow: "rgba(59, 130, 246, 0.4)",
        innerGlow: "rgba(147, 197, 253, 0.8)",
        tint: `rgba(59, 130, 246, ${transparency / 100})`,
        backdrop: "rgba(59, 130, 246, 0.08)",
      },
      green: {
        shadow: "rgba(34, 197, 94, 0.4)",
        innerGlow: "rgba(134, 239, 172, 0.8)",
        tint: `rgba(34, 197, 94, ${transparency / 100})`,
        backdrop: "rgba(34, 197, 94, 0.08)",
      },
      custom: customColors || {
        shadow: "rgba(0, 0, 0, 0.4)",
        innerGlow: "rgba(255, 255, 255, 0.8)",
        tint: `rgba(255, 255, 255, ${transparency / 100})`,
        backdrop: "rgba(0, 0, 0, 0.08)",
      },
    };

    const currentTheme = colorThemes[color];

    // Use React's useId for stable, unique filter ID that's consistent between server and client
    const filterId = useId();

    const baseClasses =
      "liquid-glass-button relative rounded-full font-medium transition-all duration-200 pointer-events-auto transform hover:scale-105 cursor-pointer text-purple-950 dark:text-purple-200";

    const variantClasses = {
      default: "px-6 py-3 text-sm",
      compact: "px-4 py-2 text-xs",
    };

    // Create stable style objects to prevent hydration mismatches
    const buttonStyle = {
      isolation: "isolate" as const,
      boxShadow: `0px 8px 32px ${currentTheme.shadow}`,
      overflow: "hidden" as const,
    };

    const glassBackgroundStyle = {
      zIndex: 0,
      boxShadow: `inset 0 0 20px -10px ${currentTheme.innerGlow}`,
      backgroundColor: currentTheme.tint,
    };

    const backdropBlurStyle = {
      zIndex: -1,
      backdropFilter: "blur(4px) saturate(1.2)",
      WebkitBackdropFilter: "blur(4px) saturate(1.2)",
      filter: `url(#${filterId})`,
      WebkitFilter: `url(#${filterId})`,
      isolation: "isolate" as const,
      backgroundColor: currentTheme.backdrop,
    };

    return (
      <div className="relative">
        {/* SVG Filter for Liquid Glass Effect with configurable noise */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="0"
          height="0"
          style={{ position: "absolute", overflow: "hidden" }}
        >
          <defs>
            <filter id={filterId} x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012 0.012"
                numOctaves="3"
                seed="42"
                result="noise"
              />
              <feGaussianBlur in="noise" stdDeviation="1.5" result="blurred" />
              <feDisplacementMap
                in="SourceGraphic"
                in2="blurred"
                scale={noise.toString()}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>

        <button
          ref={ref}
          className={cn(baseClasses, variantClasses[variant], className)}
          style={buttonStyle}
          {...props}
        >
          {/* Glass background with configurable tint */}
          <div
            className="absolute inset-0 rounded-full"
            style={glassBackgroundStyle}
          />

          {/* Backdrop blur with configurable noise distortion */}
          <div
            className="absolute inset-0 rounded-full"
            style={backdropBlurStyle}
          />

          {/* Button content */}
          <span className="relative z-10 flex items-center gap-2">
            {showIcon && iconPosition === "left" && customIcon}
            <span className="font-medium">{children}</span>
            {showIcon && iconPosition === "right" && customIcon}
          </span>
        </button>
      </div>
    );
  },
);

LiquidGlassButton.displayName = "LiquidGlassButton";

export { LiquidGlassButton };
export type { LiquidGlassButtonProps };
