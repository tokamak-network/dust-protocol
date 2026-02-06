import { useAccount, useConnect, useDisconnect } from "wagmi";

export const useWalletConnect = () => {
  const { address, isConnected, chain, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { connectors, connect } = useConnect();

  return {
    address,
    isConnected,
    chain,
    chainId,
    disconnect,
    connect,
    connectors,
  };
};
