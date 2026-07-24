"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ url, size = 128 }: { url: string; size?: number }) {
  const [dataUri, setDataUri] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(url, { width: size, margin: 2 }).then(setDataUri).catch(() => setDataUri(null));
  }, [url, size]);

  if (!dataUri) return null;

  return <img src={dataUri} alt="Payment QR code" width={size} height={size} className="rounded-md border" />;
}
