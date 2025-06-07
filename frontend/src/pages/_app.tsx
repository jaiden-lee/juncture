import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { inter } from "@/utils/fonts";
import { Toaster } from "@/components/ui/sonner";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={` ${inter.className}`}>
      <Component {...pageProps} />
      <Toaster expand={true} richColors theme="dark"/>
    </div>
  );
}
