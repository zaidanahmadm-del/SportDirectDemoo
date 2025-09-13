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
    <main className="max-w-md mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="text-center mb-8">
        <h1 className="text-3xl font-bold text-sd-blue mb-3 leading-tight">
          Kick Off with Sports Direct
        </h1>
        <p className="text-lg text-muted-foreground mb-6">
          Register, score the winning goal, and unlock your opening-day voucher.
        </p>
      </section>

      {/* Registration Form */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border mb-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      data-testid="input-fullname"
                      placeholder="Enter your full name"
                      className="text-lg py-3"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      data-testid="input-email"
                      type="email"
                      placeholder="your.email@example.com"
                      className="text-lg py-3"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      data-testid="input-phone"
                      type="tel"
                      placeholder="07XXX XXXXXX"
                      className="text-lg py-3"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit"
              data-testid="button-start-game"
              className="w-full bg-sd-red hover:bg-sd-red/90 text-white py-4 text-lg font-bold"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Starting..." : "Start Game"}
            </Button>
          </form>
        </Form>
      </section>

      {/* Terms */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          By continuing you agree to the{" "}
          <a href="#" className="text-primary hover:underline">
            event T&Cs
          </a>
          .
        </p>
      </div>
    </main>
  );
}
