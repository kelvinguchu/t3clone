"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState, useRef } from "react";
import { useMutation } from "convex/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle,
  Crown,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { api } from "@/convex/_generated/api";

// Define types for IntaSend SDK
interface IntaSendResult {
  id?: string;
  invoice?: {
    invoice_id?: string;
  };
  failed_reason?: string;
}

type IntaSendEvent =
  | "COMPLETE"
  | "FAILED"
  | "IN-PROGRESS"
  | "CANCELLED"
  | "PENDING";

interface IntaSendInstance {
  on(event: IntaSendEvent, callback: (results: IntaSendResult) => void): this;
}

interface IntaSendConstructor {
  new (options: { publicAPIKey?: string; live: boolean }): IntaSendInstance;
}

declare global {
  interface Window {
    IntaSend: IntaSendConstructor;
  }
}

export function UpgradeSection() {
  const { user } = useUser();
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "processing" | "success" | "failed" | "cancelled"
  >("idle");
  const [paymentError, setPaymentError] = useState<string>("");
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const paymentButtonRef = useRef<HTMLDivElement>(null);

  const updateUserPlan = useMutation(api.users.updateUserPlan);

  const currentPlan = (user?.publicMetadata?.plan as string) || "free";
  const isProUser = currentPlan === "pro";

  // Load IntaSend script
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://unpkg.com/intasend-inlinejs-sdk@3.0.3/build/intasend-inline.js";
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Initialize IntaSend when script is loaded
  useEffect(() => {
    if (!isScriptLoaded || !paymentButtonRef.current) return;

    // Clear any existing buttons first
    if (paymentButtonRef.current.firstChild) {
      paymentButtonRef.current.innerHTML = "";
    }

    // Create the button element
    const button = document.createElement("button");
    button.className = "intaSendPayButton";
    button.setAttribute("data-method", "CARD-PAYMENT");
    button.setAttribute("data-amount", "8");
    button.setAttribute("data-currency", "USD");
    button.setAttribute(
      "data-email",
      user?.emailAddresses[0]?.emailAddress || "customer@example.com",
    );
    button.setAttribute("data-first_name", user?.firstName || "Customer");
    button.setAttribute("data-last_name", user?.lastName || "");
    button.setAttribute("data-address", "Online");
    button.setAttribute("data-city", "Global");
    button.setAttribute("data-state", "Online");
    button.setAttribute("data-zipcode", "00100");
    button.setAttribute("data-country", "US");
    button.textContent =
      paymentStatus === "processing"
        ? "Processing..."
        : "Upgrade to Pro - $8/month";

    // Style the button to match our design
    button.style.width = "100%";
    button.style.padding = "0.625rem 1rem";
    button.style.background =
      "linear-gradient(to right, rgb(147 51 234), rgb(219 39 119))";
    button.style.color = "white";
    button.style.fontWeight = "500";
    button.style.borderRadius = "0.5rem";
    button.style.border = "none";
    button.style.boxShadow =
      "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)";
    button.style.transition = "all 0.2s ease";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.gap = "0.5rem";
    button.style.cursor = "pointer";
    button.style.fontSize = "0.875rem";

    // Add hover effect
    button.onmouseenter = () => {
      button.style.background =
        "linear-gradient(to right, rgb(126 34 206), rgb(190 24 93))";
    };
    button.onmouseleave = () => {
      button.style.background =
        "linear-gradient(to right, rgb(147 51 234), rgb(219 39 119))";
    };

    // Add credit card icon
    const icon = document.createElement("span");
    icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="m2 10 10 5 10-5"/></svg>`;
    button.insertBefore(icon, button.firstChild);

    // Disable button during processing
    button.disabled = paymentStatus === "processing";
    if (paymentStatus === "processing") {
      button.style.opacity = "0.5";
      button.style.cursor = "not-allowed";
    }

    // Append button to container
    paymentButtonRef.current.appendChild(button);

    // Initialize IntaSend
    const intaSend = new window.IntaSend({
      publicAPIKey: process.env.NEXT_PUBLIC_INTASEND_PUBLIC_KEY,
      live: false,
    });

    intaSend
      .on("COMPLETE", async (results: IntaSendResult) => {
        setPaymentStatus("success");

        // Update user plan in Convex
        if (user?.id) {
          try {
            await updateUserPlan({
              userId: user.id,
              plan: "pro",
              paymentId: results.invoice?.invoice_id || results.id || "N/A",
              paymentMethod: "CARD-PAYMENT",
              paymentAmount: 800, // $8.00 in cents
            });
          } catch {
            setPaymentError(
              "Failed to activate Pro plan. Please contact support.",
            );
            setPaymentStatus("failed");
          }
        }
      })
      .on("FAILED", (results: IntaSendResult) => {
        setPaymentStatus("failed");
        setPaymentError(
          results.failed_reason || "Payment failed. Please try again.",
        );
      })
      .on("IN-PROGRESS", () => {
        setPaymentStatus("processing");
      })
      .on("CANCELLED", () => {
        setPaymentStatus("cancelled");
      })
      .on("PENDING", () => {
        setPaymentStatus("processing");
      });
  }, [
    isScriptLoaded,
    user?.emailAddresses,
    user?.firstName,
    user?.lastName,
    user?.id,
    updateUserPlan,
    paymentStatus,
  ]);

  const resetPayment = () => {
    setPaymentStatus("idle");
    setPaymentError("");
  };

  return (
    <Card className="border-purple-200/60 dark:border-purple-800/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg flex items-center justify-center">
            <Crown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-purple-900 dark:text-purple-100">
              {isProUser ? "Pro Plan Active" : "Upgrade to Pro"}
            </CardTitle>
            <CardDescription>
              {isProUser
                ? "You're enjoying all Pro features"
                : "Unlock unlimited conversations and advanced features"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isProUser ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-purple-700 dark:text-purple-300">
                  Unlimited messages
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-purple-700 dark:text-purple-300">
                  Priority support
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-purple-700 dark:text-purple-300">
                  Advanced AI models
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-purple-700 dark:text-purple-300">
                  Custom API keys
                </span>
              </div>
            </div>
            <div className="pt-4">
              {paymentStatus === "success" ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900 dark:text-green-100">
                      Payment Successful!
                    </span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Your Pro plan has been activated. You now have unlimited
                    access!
                  </p>
                </div>
              ) : paymentStatus === "failed" ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-900 dark:text-red-100">
                      Payment Failed
                    </span>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {paymentError || "Please try again or contact support."}
                  </p>
                  <button
                    onClick={resetPayment}
                    className="mt-2 text-xs text-red-600 hover:text-red-700 underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Try again
                  </button>
                </div>
              ) : paymentStatus === "cancelled" ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-900 dark:text-yellow-100">
                      Payment Cancelled
                    </span>
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    You cancelled the payment. You can try again anytime.
                  </p>
                  <button
                    onClick={resetPayment}
                    className="mt-2 text-xs text-yellow-600 hover:text-yellow-700 underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Try again
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentStatus === "processing" && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Processing payment...
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={paymentButtonRef} className="w-full">
                    {!isScriptLoaded && (
                      <div className="text-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto text-purple-600" />
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          Loading payment options...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-purple-900 dark:text-purple-100">
                Pro Plan Active
              </span>
            </div>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              You have access to all Pro features including unlimited messages,
              priority support, and custom API keys.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
