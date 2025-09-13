import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BrandButtonProps extends Omit<ButtonProps, 'variant'> {
  brandVariant?: "primary" | "secondary";
}

export default function BrandButton({ 
  brandVariant = "primary", 
  className, 
  children, 
  ...props 
}: BrandButtonProps) {
  return (
    <Button 
      className={cn(
        "font-bold rounded-md transition-colors",
        brandVariant === "primary" && "bg-sd-red hover:bg-sd-red/90 text-white",
        brandVariant === "secondary" && "bg-sd-blue hover:bg-sd-blue/90 text-white",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
