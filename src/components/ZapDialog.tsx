import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "../lib/toast";

const PRESETS = [21, 100, 500, 1000, 5000];

/**
 * NIP-57 zap composer. Picks an amount, asks the parent to mint a bolt11
 * invoice from the author's lightning address, then hands the invoice off to a
 * wallet (QR / `lightning:` link / clipboard). Payment confirmation arrives
 * out-of-band as a zap receipt, so the dialog just closes after handoff.
 */
export function ZapDialog({
  open,
  onClose,
  recipientName,
  requestInvoice,
}: {
  open: boolean;
  onClose: () => void;
  recipientName: string;
  requestInvoice: (amountSats: number, comment: string) => Promise<string>;
}) {
  const [amount, setAmount] = useState<number>(100);
  const [custom, setCustom] = useState("");
  const [comment, setComment] = useState("");
  const [invoice, setInvoice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(100);
      setCustom("");
      setComment("");
      setInvoice(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const effective = custom ? parseInt(custom, 10) || 0 : amount;

  const mint = async () => {
    if (effective <= 0) return;
    setLoading(true);
    try {
      const pr = await requestInvoice(effective, comment);
      setInvoice(pr);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create invoice.");
    } finally {
      setLoading(false);
    }
  };

  const copyInvoice = async () => {
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(invoice);
      toast.success("Invoice copied.");
    } catch {
      toast.error("Couldn't access the clipboard.");
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet zap-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sheet-head">
          <h2 className="zap-title">
            {invoice ? "Pay invoice" : `Zap ${recipientName}`}
          </h2>
          <button className="icon-btn sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="sheet-body">
          {!invoice ? (
            <>
              <div className="zap-presets">
                {PRESETS.map((amt) => (
                  <button
                    key={amt}
                    className={`zap-amount${effective === amt ? " active" : ""}`}
                    onClick={() => {
                      setAmount(amt);
                      setCustom("");
                    }}
                  >
                    ⚡ {amt.toLocaleString()}
                  </button>
                ))}
              </div>
              <input
                className="search"
                inputMode="numeric"
                placeholder="Custom amount (sats)"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
              />
              <input
                className="search zap-comment"
                placeholder="Comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                className="btn zap-go"
                onClick={mint}
                disabled={effective <= 0 || loading}
              >
                {loading
                  ? "Getting invoice…"
                  : `Zap ${effective.toLocaleString()} sats`}
              </button>
            </>
          ) : (
            <div className="zap-invoice">
              <div className="zap-qr">
                <QRCodeSVG value={invoice.toUpperCase()} size={220} level="M" />
              </div>
              <p className="zap-invoice-str">{invoice.slice(0, 64)}…</p>
              <div className="zap-invoice-actions">
                <button className="btn ghost" onClick={copyInvoice}>
                  Copy invoice
                </button>
                <a className="btn" href={`lightning:${invoice}`}>
                  Open wallet
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
