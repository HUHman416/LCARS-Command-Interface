import React from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";
import "../app/v23-1.css";

const nativeFetch: typeof window.fetch = window.fetch.bind(window);
const compatFallback = {
  distro: "Windows",
  desktop: "Windows Desktop",
  session: "native",
  capabilities: {},
  restrictions: [],
};

window.fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const response = await nativeFetch(input, init);
  if (url.includes("127.0.0.1:8765/api/compat") && !response.ok) {
    console.warn(
      "LCARS compatibility endpoint unavailable; using Windows hotfix fallback.",
    );
    return new Response(JSON.stringify(compatFallback), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return response;
};

createRoot(document.getElementById("root")!).render(<Home />);
