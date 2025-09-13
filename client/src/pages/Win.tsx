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
    <main className="max-w-md mx-auto px-4 py-6">
      {/* Congratulations Header */}
      <section className="text-center mb-8">
        <div className="relative mb-4">
          <h1 className="text-3xl font-bold text-sd-blue" data-testid="text-congratulations">
            Congratulations, {firstName}!
          </h1>
          <div className="absolute -top-2 -right-2 text-2xl">🎉</div>
        </div>
        <p className="text-lg text-muted-foreground">
          You've won a Sports Direct voucher.
        </p>
      </section>

      {/* Voucher Card */}
      <section className="bg-gradient-to-br from-sd-red to-sd-blue p-6 rounded-lg shadow-lg mb-6 text-white">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold mb-2">Your Voucher Code</h2>
          <div className="bg-white/20 p-4 rounded-md">
            <code className="text-2xl font-mono font-bold tracking-wider" data-testid="text-voucher-code">
              {voucherData.code}
            </code>
          </div>
          <Button 
            onClick={copyVoucherCode}
            data-testid="button-copy-code"
            variant="ghost"
            className="mt-2 text-sm bg-white/20 hover:bg-white/30 text-white"
          >
            📋 Copy Code
          </Button>
        </div>
        <p className="text-sm text-white/90 text-center">
          Show this code at our new store opening to redeem.
        </p>
      </section>

      {/* Store Opening Details */}
      <section className="bg-card p-6 rounded-lg border border-border mb-6">
        <h3 className="text-xl font-bold text-sd-blue mb-4 text-center">
          {storeDetails.name}
        </h3>
        
        <div className="space-y-3 mb-6">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📅</span>
            <div>
              <p className="font-medium" data-testid="text-event-date">
                {storeDetails.date}, {storeDetails.time}
              </p>
              <p className="text-sm text-muted-foreground">Store Opening Day</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📍</span>
            <div>
              <p className="font-medium" data-testid="text-event-location">
                {storeDetails.location}
              </p>
              <p className="text-sm text-muted-foreground">{storeDetails.address}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🎁</span>
            <div>
              <p className="font-medium">Launch Offers Available</p>
              <p className="text-sm text-muted-foreground" data-testid="text-offers">
                {storeDetails.offers}
              </p>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={generateCalendarEvent}
            data-testid="button-add-calendar"
            className="w-full bg-sd-blue hover:bg-sd-blue/90 text-white"
          >
            📅 Add to Calendar
          </Button>
          
          <Button 
            onClick={getDirections}
            data-testid="button-get-directions"
            variant="outline"
            className="w-full"
          >
            🗺️ Get Directions
          </Button>
        </div>
      </section>

      {/* Navigation */}
      <div className="text-center space-y-3">
        <Button 
          onClick={() => setLocation("/")}
          data-testid="button-back-home"
          className="w-full bg-sd-red hover:bg-sd-red/90 text-white font-bold"
        >
          Back to Home
        </Button>
        
        <Button 
          onClick={() => setLocation("/game")}
          data-testid="link-play-again"
          variant="link"
          className="text-primary hover:text-primary/80 font-medium underline"
        >
          Play Again
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
