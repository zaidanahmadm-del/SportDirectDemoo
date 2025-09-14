import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUserData, getVoucherData } from "@/utils/storage";
import { useToast } from "@/hooks/use-toast";

interface StoreDetails {
  name: string;
  date: string;
  time: string;
  location: string;
  address: string;
  offers: string;
}

const storeDetails: StoreDetails = {
  name: "Sports Direct — New Store Opening",
  date: "Friday, 27 Sept",
  time: "10:00 AM",
  location: "Westfield Shopping Centre",
  address: "London, UK",
  offers: "Up to 50% off selected items",
};

export default function Win() {
  const [, setLocation] = useLocation();
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const { toast } = useToast();
  
  const userData = getUserData();
  const voucherData = getVoucherData();

  // Check if user has won
  useEffect(() => {
    if (!voucherData?.won) {
      setLocation("/game");
      return;
    }
  }, [voucherData, setLocation]);

  // Check for admin parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setShowAdminPanel(urlParams.get('admin') === '1');
  }, []);

  if (!userData || !voucherData) {
    return null;
  }

  const firstName = userData.fullName.split(' ')[0];

  const copyVoucherCode = async () => {
    try {
      await navigator.clipboard.writeText(voucherData.code);
      toast({
        title: "Copied!",
        description: "Voucher code copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the code manually",
        variant: "destructive",
      });
    }
  };

  const generateCalendarEvent = () => {
    const event = {
      title: "Sports Direct Store Opening",
      start: "20240927T100000",
      end: "20240927T180000",
      description: `Visit the new Sports Direct store opening! Bring voucher code: ${voucherData.code}`,
      location: `${storeDetails.location}, ${storeDetails.address}`,
    };

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Sports Direct//EN
BEGIN:VEVENT
UID:${Date.now()}@sportsdirect.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}
DTSTART:${event.start}
DTEND:${event.end}
SUMMARY:${event.title}
DESCRIPTION:${event.description}
LOCATION:${event.location}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sports-direct-opening.ics';
    link.click();
    URL.revokeObjectURL(url);
  };

  const getDirections = () => {
    const query = encodeURIComponent(`${storeDetails.location}, ${storeDetails.address}`);
    window.open(`https://maps.google.com/?q=${query}`, '_blank');
  };

  const downloadUserData = () => {
    const allUsers = JSON.parse(localStorage.getItem('sd_registrations') || '[]');
    const csvContent = [
      'Name,Email,Phone,Registration Date',
      ...allUsers.map((user: any) => 
        `"${user.fullName}","${user.email}","${user.phone}","${user.registrationDate || 'N/A'}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sports-direct-registrations.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="main-content premium-container py-12 fade-in">
      {/* Congratulations Header */}
      <section className="text-center mb-10 bounce-in">
        <h1 className="text-4xl md:text-5xl font-heading font-black text-sd-blue mb-4" data-testid="text-congratulations">
          CONGRATULATIONS,<br />{firstName.toUpperCase()}! 🎉
        </h1>
        <p className="text-xl font-bold text-sd-black/80">
          You've won an exclusive Sports Direct voucher.
        </p>
      </section>

      {/* Voucher Card */}
      <section className="bg-gradient-to-br from-sd-red via-purple-500 to-purple-700 p-8 rounded-lg shadow-xl mb-10 text-white bounce-in">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-heading font-black mb-4 uppercase tracking-wide">Your Voucher Code</h2>
          <div className="bg-white/20 p-6 rounded-lg shadow-inner">
            <code className="text-3xl font-mono font-black tracking-widest text-white" data-testid="text-voucher-code">
              {voucherData.code}
            </code>
          </div>
          <Button 
            onClick={copyVoucherCode}
            data-testid="button-copy-code"
            className="mt-4 premium-button bg-white text-sd-red hover:bg-gray-100 font-black"
          >
            📋 COPY CODE
          </Button>
        </div>
        <p className="text-lg text-white/95 text-center font-medium">
          Show this code at our new store opening to redeem.
        </p>
      </section>

      {/* Store Opening Details */}
      <section className="premium-card p-8 mb-10 bounce-in">
        <h3 className="text-2xl font-heading font-black text-sd-blue mb-6 text-center uppercase">
          {storeDetails.name}
        </h3>
        
        <div className="space-y-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-3xl">📅</span>
              <span className="text-sm font-bold text-sd-black/60 uppercase tracking-wide">When</span>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg text-sd-black" data-testid="text-event-date">
                {storeDetails.date}, {storeDetails.time}
              </p>
              <p className="text-sm text-sd-black/60 font-medium">Store Opening Day</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-3xl">📍</span>
              <span className="text-sm font-bold text-sd-black/60 uppercase tracking-wide">Where</span>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg text-sd-black" data-testid="text-event-location">
                {storeDetails.location}
              </p>
              <p className="text-sm text-sd-black/60 font-medium">{storeDetails.address}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-3xl">🎁</span>
              <span className="text-sm font-bold text-sd-black/60 uppercase tracking-wide">Offers</span>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg text-sd-black">Launch Offers Available</p>
              <p className="text-sm text-sd-black/60 font-medium" data-testid="text-offers">
                {storeDetails.offers}
              </p>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-4">
          <Button 
            onClick={generateCalendarEvent}
            data-testid="button-add-calendar"
            className="premium-button-secondary w-full h-14 text-lg"
          >
            📅 ADD TO CALENDAR
          </Button>
          
          <Button 
            onClick={getDirections}
            data-testid="button-get-directions"
            className="premium-button-secondary w-full h-14 text-lg"
          >
            🗺️ GET DIRECTIONS
          </Button>
        </div>
      </section>

      {/* Navigation */}
      <div className="text-center space-y-4 pt-6 border-t border-sd-light-border">
        <Button 
          onClick={() => setLocation("/")}
          data-testid="button-back-home"
          className="premium-button w-full h-14 text-lg"
        >
          BACK TO HOME
        </Button>
        
        <Button 
          onClick={() => setLocation("/game")}
          data-testid="link-play-again"
          variant="link"
          className="text-sd-red hover:text-sd-red/80 font-bold uppercase tracking-wide underline transition-colors"
        >
          PLAY AGAIN
        </Button>
      </div>

      {/* Privacy Modal Toggle */}
      <div className="fixed bottom-4 right-4">
        <Button 
          onClick={() => setShowPrivacyModal(true)}
          data-testid="button-privacy"
          size="sm"
          variant="outline"
          className="rounded-full p-2"
          title="Privacy Information"
        >
          🔒
        </Button>
      </div>

      {/* Admin Panel */}
      {showAdminPanel && (
        <div className="fixed bottom-4 left-4">
          <Button 
            onClick={downloadUserData}
            data-testid="button-export-csv"
            size="sm"
            variant="outline"
            className="text-xs"
            title="Download CSV"
          >
            📊 Export
          </Button>
        </div>
      )}

      {/* Privacy Modal */}
      <Dialog open={showPrivacyModal} onOpenChange={setShowPrivacyModal}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Privacy Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We store your registration data and game progress locally on your device. 
              No information is sent to external servers. You can clear this data anytime 
              by clearing your browser storage.
            </p>
            <Button 
              onClick={() => setShowPrivacyModal(false)}
              className="w-full"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
