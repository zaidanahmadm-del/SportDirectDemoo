import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { setUserData } from "@/utils/storage";

const normalizePhone = (v:string) => v.replace(/\s+/g, "");

const registrationSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().regex(/^(\+44|0)[0-9]{10,11}$/, "Please enter a valid UK phone number"),
});

type RegistrationForm = z.infer<typeof registrationSchema>;

export default function Landing() {
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
    },
  });

  const onSubmit = async (data: RegistrationForm) => {
    setIsSubmitting(true);
    try {
      // Save user data to localStorage
      setUserData(data);
      
      // Navigate to game
      setLocation("/game");
    } catch (error) {
      console.error("Registration failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="main-content premium-container py-12 fade-in">
      {/* Hero Section */}
      <section className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-heading font-black text-sd-blue mb-4 leading-tight">
          KICK OFF WITH<br />SPORTS DIRECT
        </h1>
        <p className="text-lg text-sd-black/70 mb-8 font-medium">
          Register, score the winning goal, and unlock your exclusive opening-day voucher.
        </p>
      </section>

      {/* Registration Form */}
      <section className="premium-card p-8 mb-8 bounce-in">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sd-black font-bold text-sm uppercase tracking-wide mb-2">Full Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => field.onChange(normalizePhone(e.target.value))}
                      data-testid="input-fullname"
                      placeholder="Enter your full name"
                      className="premium-input"
                    />
                  </FormControl>
                  <FormMessage className="text-red-600 font-medium" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sd-black font-bold text-sm uppercase tracking-wide mb-2">Email Address *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => field.onChange(normalizePhone(e.target.value))}
                      data-testid="input-email"
                      type="email"
                      placeholder="your.email@example.com"
                      className="premium-input"
                    />
                  </FormControl>
                  <FormMessage className="text-red-600 font-medium" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sd-black font-bold text-sm uppercase tracking-wide mb-2">Phone Number *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => field.onChange(normalizePhone(e.target.value))}
                      data-testid="input-phone"
                      type="tel"
                      placeholder="+971 5XXXXXXXX"
                      className="premium-input"
                    />
                  </FormControl>
                  <FormMessage className="text-red-600 font-medium" />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit"
              data-testid="button-start-game"
              className="premium-button w-full h-14 text-lg mt-6"
              disabled={isSubmitting}
            >
              {isSubmitting ? "STARTING..." : "START GAME"}
            </Button>
          </form>
        </Form>
      </section>

      {/* Terms */}
      <div className="text-center pt-6 border-t border-sd-light-border mt-8">
        <p className="text-sm text-sd-black/60 font-medium">
          By continuing you agree to the{" "}
          <a href="#" className="text-sd-red hover:text-sd-red/80 font-bold transition-colors">
            event T&Cs
          </a>
          .
        </p>
      </div>
    </main>
  );
}
