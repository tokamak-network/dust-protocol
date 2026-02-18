"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { UsernameStep } from "./steps/UsernameStep";
import { PinStep } from "./steps/PinStep";
import { AlertCircleIcon } from "../stealth/icons";

type Step = "username" | "pin" | "activating";
const STEPS: Step[] = ["username", "pin"];

export function OnboardingWizard() {
  const router = useRouter();
  const { address, deriveKeysFromWallet, setPin: storePinEncrypted, registerMetaAddress, registerName } = useAuth();
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const activatingRef = useRef(false);

  const currentIndex = step === "activating" ? 2 : STEPS.indexOf(step);

  const handlePinComplete = async (pin: string) => {
    if (activatingRef.current) return;
    activatingRef.current = true;
    setStep("activating");
    setError(null);

    try {
      const result = await deriveKeysFromWallet(pin);
      if (!result) throw new Error("Please approve the signature in your wallet");

      const pinStored = await storePinEncrypted(pin, result.sig);
      if (!pinStored) throw new Error("Failed to store PIN");

      const [nameTx] = await Promise.all([
        registerName(username, result.metaAddress),
        registerMetaAddress().catch(() => null),
      ]);
      if (!nameTx) throw new Error("Failed to register name");

      if (address) {
        localStorage.setItem('dust_onboarded_' + address.toLowerCase(), 'true');
      }

      router.replace("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Activation failed";
      setError(msg);
      setStep("pin");
      activatingRef.current = false;
    }
  };

  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden">
        {/* Progress dots */}
        <div className="flex gap-[6px] justify-center pt-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="w-[6px] h-[6px] rounded-full transition-all"
              style={{
                backgroundColor:
                  i < currentIndex
                    ? "rgba(0,255,65,0.5)"
                    : i === currentIndex
                    ? "rgba(255,255,255,0.8)"
                    : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-7 md:px-9 pt-6 pb-8">
          {step === "username" && (
            <UsernameStep
              onNext={(name) => { setUsername(name); setStep("pin"); }}
              initialName={username}
            />
          )}
          {step === "pin" && (
            <PinStep onNext={handlePinComplete} />
          )}
          {step === "activating" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <p className="text-[20px] font-semibold text-white tracking-tight">
                  Setting up your wallet
                </p>
                <p className="text-[13px] text-[rgba(255,255,255,0.4)]">
                  {error ? "Activation failed" : "Creating your private identity..."}
                </p>
              </div>

              {!error && (
                <div className="flex items-center gap-2 justify-center py-8">
                  {/* Spinner */}
                  <svg
                    className="animate-spin w-4 h-4 text-[rgba(0,255,65,0.8)]"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span className="text-[13px] text-[rgba(255,255,255,0.5)] font-mono">
                    Please wait...
                  </span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-[6px] pl-[2px]">
                  <AlertCircleIcon size={12} color="#ef4444" />
                  <span className="text-[12px] text-[#ef4444] font-mono">{error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
