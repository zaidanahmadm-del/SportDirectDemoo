export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-border sticky top-0 z-40">
      <div className="max-w-md mx-auto px-4 py-3 flex justify-center items-center">
        {/* Sports Direct Logo */}
        <div className="flex flex-col" data-testid="logo-sports-direct">
          <div className="bg-sd-blue px-6 py-2 text-white font-bold text-lg tracking-tight">
            SPORTS
          </div>
          <div className="bg-sd-red px-6 py-2 text-white font-bold text-lg tracking-tight">
            DIRECT
          </div>
        </div>
      </div>
    </header>
  );
}
