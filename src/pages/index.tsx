import { Geist, Geist_Mono } from "next/font/google";
import {
  ConnectButton,
  useCurrentAccount,
  useSignTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import {
  EstimateFee,
  ExecuteTransactionBlock,
  AppendCoinToTip,
  ShioFastRpcUrl,
} from "shio-fast-sdk";
import { Aftermath } from "aftermath-ts-sdk";
import { useState } from "react";

const client = new SuiClient({ url: ShioFastRpcUrl });
const mystenClient = new SuiClient({ url: getFullnodeUrl("mainnet") });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const [executionTimes, setExecutionTimes] = useState({
    normal: "",
    shio: "",
    hopper: "",
  });

  return (
    <main
      className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-gradient-to-b from-blue-300 to-white text-white font-[family-name:var(--font-geist-sans)]`}
    >
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center space-y-2">
          <div className="text-center mb-6">
            <h1 className="text-4xl text-black font-bold mb-4">
              Aftermath Shio Tip Swap
            </h1>
            <p className="text-gray-900 text-balance">
              Swap via different ways, and check their execution time. Swap ways
              include, Hopper way, Shio Tip way, and normal way.
            </p>
          </div>

          <div className="w-full max-w-md flex justify-center">
            <ConnectButton className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors" />
          </div>

          <div className="w-full gap-4 pt-8 flex flex-col items-center">
            {account && (
              <>
                <div className="w-full flex gap-4 justify-center">
                  <button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    onClick={() =>
                      executeTransaction(
                        "normal",
                        account.address,
                        signTransaction,
                        setExecutionTimes
                      ).catch((err) => {
                        console.log(err);
                      })
                    }
                  >
                    Execute Normal
                  </button>
                  <button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    onClick={() =>
                      executeTransaction(
                        "shio",
                        account.address,
                        signTransaction,
                        setExecutionTimes
                      ).catch((err) => {
                        console.log(err);
                      })
                    }
                  >
                    Execute Shio
                  </button>
                  <button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    onClick={() =>
                      executeTransaction(
                        "hopper",
                        account.address,
                        signTransaction,
                        setExecutionTimes
                      ).catch((err) => {
                        console.log(err);
                      })
                    }
                  >
                    Execute Hopper
                  </button>
                </div>
                <div className="w-full flex flex-col items-center gap-4 justify-center mt-4">
                  <div className="text-black">
                    {executionTimes.normal &&
                      `Normal Time: ${executionTimes.normal}`}
                  </div>
                  <div className="text-black">
                    {executionTimes.shio && `Shio Time: ${executionTimes.shio}`}
                  </div>
                  <div className="text-black">
                    {executionTimes.hopper &&
                      `Hopper Time: ${executionTimes.hopper}`}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = milliseconds % 1000;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
};

const executeTransaction = async (
  way: string,
  address: string,
  signTransaction: (tx: any) => Promise<any>,
  setExecutionTimes: React.Dispatch<
    React.SetStateAction<{ normal: string; shio: string; hopper: string }>
  >
) => {
  const afSdk = new Aftermath("MAINNET");
  const router = afSdk.Router();

  const route = await router.getCompleteTradeRouteGivenAmountIn({
    coinInAmount: BigInt(1_000_000),
    coinInType: "0x2::sui::SUI",
    coinOutType:
      "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  });

  const tx = await router.getTransactionForCompleteTradeRoute({
    completeRoute: route,
    slippage: 0.1,
    walletAddress: address,
  });

  if (way === "hopper") {
    tx.setSender(address);

    let estimatedFee = await EstimateFee({
      transaction: tx as any,
      client: client as any,
    });
    tx.setGasBudget(estimatedFee.gasBudget);
    let tipCoins = tx.splitCoins(tx.gas, [estimatedFee.tipAmount]);
    AppendCoinToTip(tx as any, tipCoins[0], estimatedFee.tipAmount);

    let builtTx = await tx.build({
      client,
    });

    const signed = await signTransaction({
      transaction: Transaction.from(builtTx),
    });

    let digest = await ExecuteTransactionBlock(client as any, signed).then(
      (result) => result.digest
    );

    const startTime = Date.now();

    await mystenClient.getTransactionBlock({ digest });

    setExecutionTimes((prev) => ({
      ...prev,
      hopper: formatTime(Date.now() - startTime),
    }));
  } else if (way === "shio") {
    tx.setSender(address);

    let estimatedFee = await EstimateFee({
      transaction: tx as any,
      client: client as any,
    });
    tx.setGasBudget(estimatedFee.gasBudget);
    let tipCoins = tx.splitCoins(tx.gas, [estimatedFee.tipAmount]);
    AppendCoinToTip(tx as any, tipCoins[0], estimatedFee.tipAmount);

    let builtTx = await tx.build({
      client,
    });

    const signed = await signTransaction({
      transaction: Transaction.from(builtTx),
    });

    const startTime = Date.now();

    await ExecuteTransactionBlock(client as any, signed);

    setExecutionTimes((prev) => ({
      ...prev,
      shio: formatTime(Date.now() - startTime),
    }));
  } else {
    const signed = await signTransaction({
      transaction: tx,
    });

    const startTime = Date.now();

    await ExecuteTransactionBlock(client as any, signed);

    setExecutionTimes((prev) => ({
      ...prev,
      normal: formatTime(Date.now() - startTime),
    }));
  }
};
