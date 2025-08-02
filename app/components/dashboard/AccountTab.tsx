"use client";
import { Check, ClipboardCopy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Account } from "../../lib/api";

export const AccountTab = ({ account }: { account: Account | null }) => {
  const [copied, setCopied] = useState("");
  const [balanceVisible, setBalanceVisible] = useState(true);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Account Details</h2>
      <div className="space-y-6">
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Total Balance</span>
            <button
              onClick={() => setBalanceVisible(!balanceVisible)}
              className="text-gray-400 hover:text-white"
            >
              {balanceVisible ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <div className="text-4xl font-bold mt-2">
            {balanceVisible
              ? `${account?.balance.toLocaleString() || 0} sats`
              : "••••••••••"}
          </div>
        </div>
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <label className="text-sm text-gray-400">Lightning Address</label>
          <div className="flex items-center mt-1">
            <p className="text-lg font-mono flex-grow truncate">
              {account?.alias || "loading..."}
            </p>
            <button
              onClick={() => copyToClipboard(account?.alias || "", "alias")}
              className="ml-4 p-2 rounded-md hover:bg-gray-600"
            >
              {copied === "alias" ? (
                <Check className="text-green-400" size={20} />
              ) : (
                <ClipboardCopy size={20} />
              )}
            </button>
          </div>
        </div>
        <div className="bg-gray-700/50 p-4 rounded-lg text-center">
          <h3 className="text-lg font-semibold mb-4">Your LNURL QR Code</h3>
          {account?.qr_code ? (
            <img
              src={`data:image/png;base64,${account.qr_code}`}
              alt="LNURL QR Code"
              className="mx-auto rounded-lg bg-white p-2"
            />
          ) : (
            <div className="w-48 h-48 bg-gray-600 mx-auto rounded-lg animate-pulse" />
          )}
          <button
            onClick={() => copyToClipboard(account?.lnurl || "", "lnurl")}
            className="mt-4 w-full bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-500 transition-colors flex items-center justify-center"
          >
            {copied === "lnurl" ? (
              <>
                <Check className="mr-2" /> Copied!
              </>
            ) : (
              <>
                <ClipboardCopy className="mr-2" /> Copy LNURL
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
