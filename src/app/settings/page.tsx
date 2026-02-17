"use client";

import { useAuth } from "@/contexts/AuthContext";
import { AccountSection } from "@/components/settings/AccountSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { ClaimAddressSection } from "@/components/settings/ClaimAddressSection";
import { DangerZoneSection } from "@/components/settings/DangerZoneSection";

export default function SettingsPage() {
  const {
    address, ownedNames, isRegistered, metaAddress, stealthKeys,
    claimAddresses, claimAddressesInitialized,
    clearKeys, clearPin,
  } = useAuth();

  const viewingPublicKey = stealthKeys?.viewingPublicKey
    ? (stealthKeys.viewingPublicKey.startsWith("0x") ? stealthKeys.viewingPublicKey : `0x${stealthKeys.viewingPublicKey}`)
    : undefined;

  return (
    <div className="px-4 md:px-10 py-5 md:py-10 max-w-[780px] mx-auto">
      <div className="flex flex-col gap-7">
        <h1 className="text-2xl font-bold tracking-widest text-white font-mono mb-1 text-center">Settings</h1>

        <AccountSection address={address} ownedNames={ownedNames} isRegistered={isRegistered} />
        <SecuritySection metaAddress={metaAddress} viewingPublicKey={viewingPublicKey} />
        <ClaimAddressSection claimAddresses={claimAddresses} claimAddressesInitialized={claimAddressesInitialized} />
        <DangerZoneSection clearKeys={clearKeys} clearPin={clearPin} />
      </div>
    </div>
  );
}
