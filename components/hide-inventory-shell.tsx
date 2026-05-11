"use client";

import { useEffect } from "react";

export default function HideInventoryShell() {
  useEffect(() => {
    document.body.classList.add("hide-inventory-shell");

    return () => {
      document.body.classList.remove("hide-inventory-shell");
    };
  }, []);

  return null;
}