import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { PublicPassport } from "./pages/PublicPassport.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { PricingPage } from "./pages/PricingPage.tsx";
import "./i18n";
import "./index.css";

const passportMatch = window.location.pathname.match(/^\/passport\/([^/]+)\/?$/);
const homeMatch = window.location.pathname.match(/^\/$/);
const pricingMatch = window.location.pathname.match(/^\/pricing\/?$/);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {passportMatch ? (
      <PublicPassport slug={decodeURIComponent(passportMatch[1])} />
    ) : homeMatch ? (
      <HomePage />
    ) : pricingMatch ? (
      <PricingPage />
    ) : (
      <App />
    )}
  </StrictMode>
);
