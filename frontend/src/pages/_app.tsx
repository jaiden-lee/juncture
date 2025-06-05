import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { inter } from "@/utils/fonts";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={` ${inter.className}`}>
      <Component {...pageProps} />
    </div>
  );
}
