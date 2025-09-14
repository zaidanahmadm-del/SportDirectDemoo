import { useEffect, useRef } from "react";
export default function Header() {
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const setPad = () => {
      const h = headerRef.current?.offsetHeight || 0;
      document.body.style.paddingTop = h ? `${h}px` : "";
    };
    setPad();
    window.addEventListener("resize", setPad);
    return () => window.removeEventListener("resize", setPad);
  }, []);
  return (
    <header ref={headerRef} className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-sd-light-border z-50">
      <div className="premium-container py-4 flex justify-center items-center">
        {/* Official Sports Direct Logo */}
        <img 
          src="/sports-direct-logo.jpg" 
          alt="Sports Direct" 
          className="h-28 md:h-32 w-auto object-contain"
          data-testid="logo-sports-direct"
        />
      </div>
    </header>
  );
}
