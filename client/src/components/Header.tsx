export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-sd-light-border z-50">
      <div className="premium-container py-4 flex justify-center items-center">
        {/* Official Sports Direct Logo */}
        <img 
          src="/sports-direct-logo.jpg" 
          alt="Sports Direct" 
          className="h-10 w-auto object-contain"
          data-testid="logo-sports-direct"
        />
      </div>
    </header>
  );
}
