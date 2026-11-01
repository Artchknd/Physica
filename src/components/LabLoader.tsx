"use client";
import dynamic from "next/dynamic";

const LabApp = dynamic(() => import("./LabApp"), {
  ssr: false,
  loading: () => <div className="boot"><div className="spinner" /></div>,
});

export default function LabLoader() {
  return <LabApp />;
}
